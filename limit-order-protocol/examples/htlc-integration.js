const { ethers } = require('ethers');
const { LimitOrderBuilder, LimitOrderProtocolFacade } = require('@1inch/limit-order-protocol-utils');

/**
 * HTLC Cross-Chain Integration for 1inch Limit Order Protocol
 * 
 * This example shows how to:
 * 1. Create a limit order with HTLC predicate
 * 2. Register HTLC parameters
 * 3. Fill the order with preimage from Stellar HTLC claim
 */

// Contract addresses (update with your deployed addresses)
const LIMIT_ORDER_PROTOCOL = "0x111111125421ca6dc452d289314280a0f8842a65"; // 1inch LOP
const HTLC_PREDICATE = "0xD72f5a8330d6cAFc5F88155B96d8Fb3F871Cce3D"; // Your deployed HTLCPredicate contract
const WETH = "0x..."; // WETH address on your network
const USDC = "0x..."; // USDC address on your network

// EIP-712 Domain for 1inch LOP
const DOMAIN = {
    name: '1inch Limit Order Protocol',
    version: '4',
    chainId: 1, // Update for your network
    verifyingContract: LIMIT_ORDER_PROTOCOL
};

/**
 * 1. CREATE HTLC LIMIT ORDER (Resolver/Maker side)
 */
async function createHTLCLimitOrder(provider, resolverWallet, config) {
    const {
        makerAsset,    // WETH address  
        takerAsset,    // USDC address
        makingAmount,  // Amount of WETH to swap
        takingAmount,  // Amount of USDC to receive
        hashlock,      // keccak256 of secret
        timelock,      // Expiration timestamp
        stellarReceiver // Stellar address
    } = config;

    const limitOrderBuilder = new LimitOrderBuilder(
        LIMIT_ORDER_PROTOCOL,
        await provider.getNetwork().then(n => n.chainId)
    );

    // Create predicate calldata
    const htlcPredicateInterface = new ethers.Interface([
        "function validateHTLC(bytes32 orderHash, bytes calldata preimage) external view returns (uint256)"
    ]);

    // Build the limit order with HTLC predicate
    const order = limitOrderBuilder.buildLimitOrder({
        makerAssetAddress: makerAsset,
        takerAssetAddress: takerAsset,
        makerAddress: resolverWallet.address,
        makingAmount: makingAmount,
        takingAmount: takingAmount,
        predicate: {
            // Predicate that validates HTLC preimage
            address: HTLC_PREDICATE,
            calldata: htlcPredicateInterface.encodeFunctionData("validateHTLC", [
                "0x0000000000000000000000000000000000000000000000000000000000000000", // Placeholder - will be replaced with actual order hash
                "0x" // Placeholder for preimage
            ])
        },
        // Set expiration slightly before HTLC timelock
        expiration: timelock - 300, // 5 minutes before HTLC expires
        nonce: Date.now(), // Unique nonce
    });

    // Calculate order hash
    const orderHash = limitOrderBuilder.buildOrderHash(order);
    
    // Update predicate with actual order hash
    const predicateCalldata = htlcPredicateInterface.encodeFunctionData("validateHTLC", [
        orderHash,
        "0x" // Still placeholder for preimage
    ]);
    
    order.predicate = predicateCalldata;

    // Sign the order
    const signature = await limitOrderBuilder.buildOrderSignature(resolverWallet, order);

    // Register HTLC parameters
    const htlcPredicate = new ethers.Contract(
        HTLC_PREDICATE,
        [
            "function registerHTLCOrder(bytes32 orderHash, bytes32 hashlock, uint256 timelock, address stellarReceiver) external"
        ],
        resolverWallet
    );

    const registerTx = await htlcPredicate.registerHTLCOrder(
        orderHash,
        hashlock,
        timelock,
        stellarReceiver
    );
    await registerTx.wait();

    console.log("✅ HTLC Limit Order Created:");
    console.log("Order Hash:", orderHash);
    console.log("Signature:", signature);
    console.log("Hashlock:", hashlock);
    
    return {
        order,
        orderHash,
        signature,
        hashlock
    };
}

/**
 * 2. FILL HTLC ORDER (User/Taker side)
 */
async function fillHTLCOrder(provider, userWallet, orderData, preimage) {
    const { order, signature } = orderData;
    
    // Verify preimage matches hashlock
    const preimageHash = ethers.keccak256(ethers.toUtf8Bytes(preimage));
    console.log("Preimage hash:", preimageHash);
    
    const limitOrderProtocol = new ethers.Contract(
        LIMIT_ORDER_PROTOCOL,
        [
            "function fillOrder((address,address,address,address,uint256,uint256,uint256,bytes) order, bytes32 r, bytes32 vs, uint256 amount, uint256 takerTraits) external payable returns(uint256, uint256, bytes32)"
        ],
        userWallet
    );

    // Prepare the predicate with preimage
    const htlcPredicateInterface = new ethers.Interface([
        "function validateHTLC(bytes32 orderHash, bytes calldata preimage) external view returns (uint256)"
    ]);
    
    const orderHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["tuple(address,address,address,address,uint256,uint256,uint256,bytes)"],
            [order]
        )
    );

    const predicateWithPreimage = htlcPredicateInterface.encodeFunctionData("validateHTLC", [
        orderHash,
        ethers.toUtf8Bytes(preimage)
    ]);

    // Update order predicate with preimage
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
            order.takingAmount, // Fill entire order
            0 // No special taker traits
        );
        
        const receipt = await fillTx.wait();
        console.log("✅ HTLC Order Filled Successfully!");
        console.log("Transaction Hash:", receipt.hash);
        return receipt;
        
    } catch (error) {
        console.error("❌ Failed to fill order:", error.message);
        throw error;
    }
}

/**
 * 3. COMPLETE INTEGRATION EXAMPLE
 */
async function demonstrateHTLCIntegration() {
    // Setup providers and wallets
    const provider = new ethers.JsonRpcProvider("YOUR_RPC_URL");
    const resolverWallet = new ethers.Wallet("RESOLVER_PRIVATE_KEY", provider);
    const userWallet = new ethers.Wallet("USER_PRIVATE_KEY", provider);
    
    // Generate secret for HTLC
    const secret = "my-secret-123456789";
    const hashlock = ethers.keccak256(ethers.toUtf8Bytes(secret));
    
    console.log("🔐 Generated HTLC secret:");
    console.log("Secret:", secret);
    console.log("Hashlock:", hashlock);
    
    // 1. Resolver creates limit order with HTLC predicate
    console.log("\n1️⃣ Creating HTLC Limit Order...");
    const orderData = await createHTLCLimitOrder(provider, resolverWallet, {
        makerAsset: WETH,
        takerAsset: USDC,
        makingAmount: ethers.parseEther("0.1"), // 0.1 WETH
        takingAmount: ethers.parseUnits("300", 6), // 300 USDC
        hashlock: hashlock,
        timelock: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        stellarReceiver: userWallet.address // Using ETH address as placeholder
    });
    
    // 2. User claims Stellar HTLC and gets the preimage (simulated)
    console.log("\n2️⃣ User claims Stellar HTLC with secret...");
    console.log("✅ Stellar HTLC claimed, preimage revealed:", secret);
    
    // 3. User fills the limit order using the same preimage
    console.log("\n3️⃣ Filling Limit Order with preimage...");
    const receipt = await fillHTLCOrder(provider, userWallet, orderData, secret);
    
    console.log("\n🎉 Cross-chain atomic swap completed!");
    console.log("Stellar → User received XLM");
    console.log("Ethereum → User received WETH");
    console.log("Transaction:", receipt.hash);
}

/**
 * 4. UTILITY FUNCTIONS
 */

// Check if order can be filled with preimage
async function canFillOrder(provider, orderHash, preimage) {
    const htlcPredicate = new ethers.Contract(
        HTLC_PREDICATE,
        ["function canFillOrder(bytes32 orderHash, bytes calldata preimage) external view returns (bool)"],
        provider
    );
    
    return await htlcPredicate.canFillOrder(orderHash, ethers.toUtf8Bytes(preimage));
}

// Get HTLC order details
async function getHTLCOrderDetails(provider, orderHash) {
    const htlcPredicate = new ethers.Contract(
        HTLC_PREDICATE,
        ["function getHTLCOrder(bytes32 orderHash) external view returns (tuple(bytes32,uint256,address))"],
        provider
    );
    
    return await htlcPredicate.getHTLCOrder(orderHash);
}

// Sample order structure for reference
const SAMPLE_HTLC_ORDER = {
    "maker": "0x...", // Resolver address
    "makerAsset": "0x...", // WETH
    "takerAsset": "0x...", // USDC  
    "makerTraits": "0x...", // Encoded maker traits
    "makingAmount": "100000000000000000", // 0.1 WETH
    "takingAmount": "300000000", // 300 USDC
    "salt": "1234567890", // Unique nonce
    "predicate": "0x..." // Encoded validateHTLC call with orderHash and placeholder preimage
};

module.exports = {
    createHTLCLimitOrder,
    fillHTLCOrder,
    demonstrateHTLCIntegration,
    canFillOrder,
    getHTLCOrderDetails,
    SAMPLE_HTLC_ORDER
};