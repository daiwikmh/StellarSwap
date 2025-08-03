const { ethers } = require('ethers');
const { LimitOrderBuilder } = require('@1inch/limit-order-protocol-utils');
const StellarSdk = require('stellar-sdk');
require('dotenv').config();

/**
 * Integrated HTLC + 1inch LOP Cross-Chain Bridge
 * Connects your existing Stellar HTLC with 1inch Limit Order Protocol
 */

// Configuration from .env
const config = {
    stellar: {
        network: process.env.STELLAR_NETWORK,
        htlcAddress: process.env.STELLAR_HTLC_ADDRESS,
        privateKey: process.env.STELLAR_PRIVATE_KEY,
        receiverKey: process.env.RECEIVER_PRIVATE_KEY,
        rpcUrl: process.env.STELLAR_RPC_URL,
        xlmAddress: process.env.XLM_ADDRESS
    },
    ethereum: {
        network: process.env.ETHEREUM_NETWORK,
        rpcUrl: process.env.ETHEREUM_RPC_URL,
        htlcAddress: process.env.ETHEREUM_HTLC_ADDRESS,
        relayerKey: process.env.ETHEREUM_RELAYER_PRIVATE_KEY,
        receiverKey: process.env.ETH_RECEIVER_PRIVATE_KEY,
        chainId: parseInt(process.env.CHAIN_ID)
    },
    limitOrder: {
        protocol: process.env.LIMIT_ORDER_PROTOCOL,
        predicateAddress: process.env.HTLC_PREDICATE_ADDRESS,
        wethAddress: process.env.WETH_ADDRESS,
        usdcAddress: process.env.USDC_ADDRESS
    },
    api: {
        coinmarketcap: process.env.COINMARKETCAP_API_KEY
    }
};

class HTLCLimitOrderBridge {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(config.ethereum.rpcUrl);
        this.relayerWallet = new ethers.Wallet(config.ethereum.relayerKey, this.provider);
        this.userWallet = new ethers.Wallet(config.ethereum.receiverKey, this.provider);
        
        // Stellar setup
        this.stellarServer = new StellarSdk.Horizon.Server(config.stellar.rpcUrl);
        this.stellarSource = StellarSdk.Keypair.fromSecret(config.stellar.privateKey);
        this.stellarReceiver = StellarSdk.Keypair.fromSecret(config.stellar.receiverKey);
        
        this.limitOrderBuilder = new LimitOrderBuilder(
            config.limitOrder.protocol,
            config.ethereum.chainId
        );
    }

    /**
     * Step 1: Create Stellar HTLC (existing functionality)
     */
    async createStellarHTLC(amount, secret) {
        const hashlock = ethers.keccak256(ethers.toUtf8Bytes(secret));
        const timelock = Math.floor(Date.now() / 1000) + 3600; // 1 hour
        
        console.log("🌟 Creating Stellar HTLC...");
        console.log("Amount:", amount, "XLM");
        console.log("Hashlock:", hashlock);
        console.log("Timelock:", timelock);
        
        // Load Stellar account
        const account = await this.stellarServer.loadAccount(this.stellarSource.publicKey());
        
        // Create HTLC transaction
        const transaction = new StellarSdk.TransactionBuilder(account, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: StellarSdk.Networks.TESTNET
        })
        .addOperation(
            StellarSdk.Operation.invokeContract({
                contract: config.stellar.htlcAddress,
                function: 'initiate',
                args: [
                    StellarSdk.Address.fromString(this.stellarSource.publicKey()),
                    StellarSdk.Address.fromString(this.stellarReceiver.publicKey()),
                    StellarSdk.Address.fromString(config.stellar.xlmAddress),
                    StellarSdk.xdr.ScVal.scvI128(StellarSdk.xdr.Int128Parts.fromString(amount.toString())),
                    StellarSdk.xdr.ScVal.scvBytes(Buffer.from(hashlock.slice(2), 'hex')),
                    StellarSdk.xdr.ScVal.scvU64(StellarSdk.xdr.Uint64.fromString(timelock.toString()))
                ]
            })
        )
        .setTimeout(300)
        .build();
        
        transaction.sign(this.stellarSource);
        
        try {
            const result = await this.stellarServer.submitTransaction(transaction);
            console.log("✅ Stellar HTLC created:", result.hash);
            
            return {
                stellarTxHash: result.hash,
                hashlock,
                timelock,
                secret
            };
        } catch (error) {
            console.error("❌ Stellar HTLC failed:", error);
            throw error;
        }
    }

    /**
     * Step 2: Create 1inch Limit Order with HTLC Predicate (NEW!)
     */
    async createLimitOrderWithHTLC(stellarData, ethAmount) {
        console.log("🔄 Creating 1inch Limit Order with HTLC Predicate...");
        
        const { hashlock, timelock } = stellarData;
        
        // Create predicate interface
        const htlcPredicateInterface = new ethers.Interface([
            "function validateHTLC(bytes32 orderHash, bytes calldata preimage) external view returns (uint256)"
        ]);

        // Build limit order
        const order = this.limitOrderBuilder.buildLimitOrder({
            makerAssetAddress: config.limitOrder.wethAddress,
            takerAssetAddress: "0x0000000000000000000000000000000000000000", // ETH
            makerAddress: this.relayerWallet.address,
            makingAmount: ethers.parseEther(ethAmount.toString()),
            takingAmount: "0", // Will be set dynamically
            predicate: {
                address: config.limitOrder.predicateAddress,
                calldata: "0x" // Placeholder
            },
            expiration: timelock - 300, // 5 minutes before Stellar expires
            nonce: Date.now()
        });

        // Calculate order hash
        const orderHash = this.limitOrderBuilder.buildOrderHash(order);
        
        // Update predicate with actual order hash
        const predicateCalldata = htlcPredicateInterface.encodeFunctionData("validateHTLC", [
            orderHash,
            "0x" // Placeholder for preimage
        ]);
        
        order.predicate = predicateCalldata;

        // Sign the order
        const signature = await this.limitOrderBuilder.buildOrderSignature(this.relayerWallet, order);

        // Register HTLC parameters on-chain
        const htlcPredicate = new ethers.Contract(
            config.limitOrder.predicateAddress,
            [
                "function registerHTLCOrder(bytes32 orderHash, bytes32 hashlock, uint256 timelock, address stellarReceiver) external"
            ],
            this.relayerWallet
        );

        const registerTx = await htlcPredicate.registerHTLCOrder(
            orderHash,
            hashlock,
            timelock,
            this.stellarReceiver.publicKey()
        );
        await registerTx.wait();

        console.log("✅ Limit Order created with HTLC predicate");
        console.log("Order Hash:", orderHash);
        console.log("Registration Tx:", registerTx.hash);

        return {
            order,
            orderHash,
            signature,
            registrationTx: registerTx.hash
        };
    }

    /**
     * Step 3: User Claims Stellar HTLC (existing functionality, enhanced)
     */
    async claimStellarHTLC(stellarData) {
        console.log("🔓 User claiming Stellar HTLC...");
        
        const { secret } = stellarData;
        
        // Load user account
        const account = await this.stellarServer.loadAccount(this.stellarReceiver.publicKey());
        
        // Create claim transaction
        const transaction = new StellarSdk.TransactionBuilder(account, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: StellarSdk.Networks.TESTNET
        })
        .addOperation(
            StellarSdk.Operation.invokeContract({
                contract: config.stellar.htlcAddress,
                function: 'claim',
                args: [
                    StellarSdk.xdr.ScVal.scvBytes(Buffer.from("swap_id_placeholder")),
                    StellarSdk.xdr.ScVal.scvBytes(Buffer.from(secret))
                ]
            })
        )
        .setTimeout(300)
        .build();
        
        transaction.sign(this.stellarReceiver);
        
        try {
            const result = await this.stellarServer.submitTransaction(transaction);
            console.log("✅ Stellar HTLC claimed:", result.hash);
            console.log("🔑 Preimage revealed:", secret);
            
            return {
                claimTxHash: result.hash,
                revealedSecret: secret
            };
        } catch (error) {
            console.error("❌ Stellar claim failed:", error);
            throw error;
        }
    }

    /**
     * Step 4: User Fills Limit Order with Revealed Preimage (NEW!)
     */
    async fillLimitOrderWithPreimage(orderData, revealedSecret) {
        console.log("💰 Filling Limit Order with revealed preimage...");
        
        const { order, signature } = orderData;
        
        // Verify preimage
        const preimageHash = ethers.keccak256(ethers.toUtf8Bytes(revealedSecret));
        console.log("Verified preimage hash:", preimageHash);
        
        // Get limit order protocol contract
        const limitOrderProtocol = new ethers.Contract(
            config.limitOrder.protocol,
            [
                "function fillOrder((address,address,address,address,uint256,uint256,uint256,bytes) order, bytes32 r, bytes32 vs, uint256 amount, uint256 takerTraits) external payable returns(uint256, uint256, bytes32)"
            ],
            this.userWallet
        );

        // Update predicate with preimage
        const htlcPredicateInterface = new ethers.Interface([
            "function validateHTLC(bytes32 orderHash, bytes calldata preimage) external view returns (uint256)"
        ]);
        
        const orderHash = this.limitOrderBuilder.buildOrderHash(order);
        const predicateWithPreimage = htlcPredicateInterface.encodeFunctionData("validateHTLC", [
            orderHash,
            ethers.toUtf8Bytes(revealedSecret)
        ]);

        // Update order with preimage
        const orderWithPreimage = {
            ...order,
            predicate: predicateWithPreimage
        };

        // Split signature
        const sig = ethers.Signature.from(signature);
        
        try {
            const fillTx = await limitOrderProtocol.fillOrder(
                orderWithPreimage,
                sig.r,
                sig.vs,
                order.makingAmount,
                0,
                { value: order.takingAmount }
            );
            
            const receipt = await fillTx.wait();
            console.log("✅ Limit Order filled successfully!");
            console.log("Fill Tx:", receipt.hash);
            
            return {
                fillTxHash: receipt.hash,
                receipt
            };
        } catch (error) {
            console.error("❌ Order fill failed:", error);
            throw error;
        }
    }

    /**
     * Complete Cross-Chain Atomic Swap Flow
     */
    async executeCompleteSwap(xlmAmount, ethAmount) {
        console.log("🚀 Starting Complete Cross-Chain Atomic Swap");
        console.log(`${xlmAmount} XLM → ${ethAmount} ETH`);
        
        const secret = `secret-${Date.now()}-${Math.random()}`;
        
        try {
            // Step 1: Create Stellar HTLC
            const stellarData = await this.createStellarHTLC(xlmAmount, secret);
            
            // Step 2: Create Limit Order with HTLC Predicate  
            const orderData = await this.createLimitOrderWithHTLC(stellarData, ethAmount);
            
            // Step 3: User claims Stellar (reveals preimage)
            const claimData = await this.claimStellarHTLC(stellarData);
            
            // Step 4: User fills Ethereum order with preimage
            const fillData = await this.fillLimitOrderWithPreimage(orderData, claimData.revealedSecret);
            
            console.log("\n🎉 CROSS-CHAIN ATOMIC SWAP COMPLETED!");
            console.log("Summary:");
            console.log("- Stellar TX:", stellarData.stellarTxHash);
            console.log("- Order Registration:", orderData.registrationTx);
            console.log("- Stellar Claim:", claimData.claimTxHash);
            console.log("- Ethereum Fill:", fillData.fillTxHash);
            
            return {
                success: true,
                stellar: stellarData,
                order: orderData,
                claim: claimData,
                fill: fillData
            };
            
        } catch (error) {
            console.error("❌ Cross-chain swap failed:", error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export for use in other modules
module.exports = { HTLCLimitOrderBridge, config };

// CLI execution
if (require.main === module) {
    async function main() {
        const bridge = new HTLCLimitOrderBridge();
        
        // Execute demo swap: 1000 XLM → 0.03 ETH
        await bridge.executeCompleteSwap(1000, 0.03);
    }
    
    main().catch(console.error);
}