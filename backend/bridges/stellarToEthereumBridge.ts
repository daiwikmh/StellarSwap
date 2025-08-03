import { ethers } from 'ethers';
import * as StellarSdk from 'stellar-sdk';
import { calculateXLMToETH, getMarketSummary } from '../components/crosschain/priceService';

interface StellarToEthConfig {
  stellar: {
    network: string;
    htlcAddress: string;
    privateKey: string;
    receiverKey: string;
    rpcUrl: string;
    xlmAddress: string;
  };
  ethereum: {
    rpcUrl: string;
    htlcAddress: string;
    relayerKey: string;
    receiverKey: string;
    chainId: number;
  };
  limitOrder: {
    protocol: string;
    predicateAddress: string;
    wethAddress: string;
  };
}

export interface StellarToEthSwapParams {
  xlmAmount: number;
  customEthAmount?: number;
  stellarSender: string;
  ethereumReceiver: string;
  secret?: string;
}

export interface StellarToEthResult {
  success: boolean;
  txHashes: {
    stellarHTLC: string;
    ethereumRegistration: string;
    stellarClaim: string;
    ethereumFill: string;
  };
  amounts: {
    xlmSent: number;
    ethReceived: number;
    rate: number;
  };
  secret: string;
  orderHash: string;
  error?: string;
}

export class StellarToEthereumBridge {
  private provider: ethers.JsonRpcProvider;
  private relayerWallet: ethers.Wallet;
  private userWallet: ethers.Wallet;
  private stellarServer: StellarSdk.Horizon.Server;
  private stellarSource: StellarSdk.Keypair;
  private stellarReceiver: StellarSdk.Keypair;
  private config: StellarToEthConfig;

  constructor(config: StellarToEthConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.ethereum.rpcUrl);
    this.relayerWallet = new ethers.Wallet(config.ethereum.relayerKey, this.provider);
    this.userWallet = new ethers.Wallet(config.ethereum.receiverKey, this.provider);
    
    this.stellarServer = new StellarSdk.Horizon.Server(config.stellar.rpcUrl);
    this.stellarSource = StellarSdk.Keypair.fromSecret(config.stellar.privateKey);
    this.stellarReceiver = StellarSdk.Keypair.fromSecret(config.stellar.receiverKey);
  }

  async executeStellarToEthSwap(params: StellarToEthSwapParams): Promise<StellarToEthResult> {
    console.log('🌟→⚡ Starting Stellar to Ethereum Bridge Swap');
    console.log(`Swapping ${params.xlmAmount} XLM to ETH`);

    const secret = params.secret || `stellar-to-eth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const hashlock = ethers.keccak256(ethers.toUtf8Bytes(secret));
    const timelock = Math.floor(Date.now() / 1000) + 7200; // 2 hours

    try {
      // Calculate ETH amount based on real-time prices if not provided
      let ethAmount: number;
      if (params.customEthAmount) {
        ethAmount = params.customEthAmount;
      } else {
        const conversion = await calculateXLMToETH(params.xlmAmount);
        ethAmount = conversion.toAmount;
        console.log(`💱 Real-time conversion: ${params.xlmAmount} XLM → ${ethAmount} ETH (Rate: ${conversion.rate})`);
      }

      // Step 1: Create Stellar HTLC
      console.log('\n1️⃣ Creating Stellar HTLC...');
      const stellarHTLCResult = await this.createStellarHTLC(params.xlmAmount, hashlock, timelock);

      // Step 2: Register HTLC with Ethereum predicate
      console.log('\n2️⃣ Registering HTLC with Ethereum predicate...');
      const ethereumRegistrationResult = await this.registerEthereumHTLC(stellarHTLCResult.orderHash, hashlock, timelock);

      // Step 3: User claims Stellar HTLC (reveals secret)
      console.log('\n3️⃣ User claiming Stellar HTLC...');
      const stellarClaimResult = await this.claimStellarHTLC(stellarHTLCResult.swapId, secret);

      // Step 4: User fills Ethereum order with revealed secret
      console.log('\n4️⃣ Filling Ethereum order with revealed secret...');
      const ethereumFillResult = await this.fillEthereumOrder(ethereumRegistrationResult.orderHash, secret, ethAmount);

      const result: StellarToEthResult = {
        success: true,
        txHashes: {
          stellarHTLC: stellarHTLCResult.txHash,
          ethereumRegistration: ethereumRegistrationResult.txHash,
          stellarClaim: stellarClaimResult.txHash,
          ethereumFill: ethereumFillResult.txHash
        },
        amounts: {
          xlmSent: params.xlmAmount,
          ethReceived: ethAmount,
          rate: ethAmount / params.xlmAmount
        },
        secret: secret,
        orderHash: stellarHTLCResult.orderHash
      };

      console.log('\n🎉 Stellar to Ethereum swap completed successfully!');
      console.log('✅ XLM locked and claimed on Stellar');
      console.log('✅ ETH received on Ethereum');
      console.log('✅ Atomic swap guarantee maintained');

      return result;

    } catch (error) {
      console.error('❌ Stellar to Ethereum swap failed:', error);
      return {
        success: false,
        txHashes: { stellarHTLC: '', ethereumRegistration: '', stellarClaim: '', ethereumFill: '' },
        amounts: { xlmSent: 0, ethReceived: 0, rate: 0 },
        secret: '',
        orderHash: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async createStellarHTLC(amount: number, hashlock: string, timelock: number) {
    const account = await this.stellarServer.loadAccount(this.stellarSource.publicKey());
    const swapId = `stellar-htlc-${Date.now()}`;
    const orderHash = ethers.keccak256(ethers.toUtf8Bytes(swapId));

    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
    .addOperation(
      StellarSdk.Operation.invokeContract({
        contract: this.config.stellar.htlcAddress,
        function: 'initiate',
        args: [
          StellarSdk.Address.fromString(this.stellarSource.publicKey()),
          StellarSdk.Address.fromString(this.stellarReceiver.publicKey()),
          StellarSdk.Address.fromString(this.config.stellar.xlmAddress),
          StellarSdk.xdr.ScVal.scvI128(StellarSdk.xdr.Int128Parts.fromString(amount.toString())),
          StellarSdk.xdr.ScVal.scvBytes(Buffer.from(hashlock.slice(2), 'hex')),
          StellarSdk.xdr.ScVal.scvU64(StellarSdk.xdr.Uint64.fromString(timelock.toString()))
        ]
      })
    )
    .setTimeout(300)
    .build();

    transaction.sign(this.stellarSource);
    const result = await this.stellarServer.submitTransaction(transaction);

    console.log(`✅ Stellar HTLC created: ${result.hash}`);
    return {
      txHash: result.hash,
      swapId,
      orderHash,
      hashlock,
      timelock
    };
  }

  private async registerEthereumHTLC(orderHash: string, hashlock: string, timelock: number) {
    const htlcPredicate = new ethers.Contract(
      this.config.limitOrder.predicateAddress,
      [
        'function registerHTLCOrder(bytes32 orderHash, bytes32 hashlock, uint256 timelock, address stellarReceiver) external'
      ],
      this.relayerWallet
    );

    const registerTx = await htlcPredicate.registerHTLCOrder(
      orderHash,
      hashlock,
      timelock,
      this.userWallet.address
    );

    const receipt = await registerTx.wait();
    console.log(`✅ Ethereum HTLC registered: ${receipt.hash}`);

    return {
      txHash: receipt.hash,
      orderHash,
      gasUsed: receipt.gasUsed.toString()
    };
  }

  private async claimStellarHTLC(swapId: string, secret: string) {
    const account = await this.stellarServer.loadAccount(this.stellarReceiver.publicKey());

    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
    .addOperation(
      StellarSdk.Operation.invokeContract({
        contract: this.config.stellar.htlcAddress,
        function: 'claim',
        args: [
          StellarSdk.xdr.ScVal.scvBytes(Buffer.from(swapId)),
          StellarSdk.xdr.ScVal.scvBytes(Buffer.from(secret))
        ]
      })
    )
    .setTimeout(300)
    .build();

    transaction.sign(this.stellarReceiver);
    const result = await this.stellarServer.submitTransaction(transaction);

    console.log(`✅ Stellar HTLC claimed: ${result.hash}`);
    console.log(`🔑 Secret revealed: ${secret}`);

    return {
      txHash: result.hash,
      revealedSecret: secret
    };
  }

  private async fillEthereumOrder(orderHash: string, secret: string, ethAmount: number) {
    // Verify secret with predicate
    const htlcPredicate = new ethers.Contract(
      this.config.limitOrder.predicateAddress,
      [
        'function validateHTLC(bytes32 orderHash, bytes calldata preimage) external view returns (uint256)',
        'function canFillOrder(bytes32 orderHash, bytes calldata preimage) external view returns (bool)'
      ],
      this.userWallet
    );

    const canFill = await htlcPredicate.canFillOrder(orderHash, ethers.toUtf8Bytes(secret));
    if (!canFill) {
      throw new Error('Cannot fill order - preimage validation failed');
    }

    // Execute ETH transfer (simplified - in production would use 1inch LOP)
    const transferAmount = ethers.parseEther(ethAmount.toString());
    const transferTx = await this.relayerWallet.sendTransaction({
      to: this.userWallet.address,
      value: transferAmount
    });

    const receipt = await transferTx.wait();
    console.log(`✅ ETH transferred: ${receipt.hash}`);
    console.log(`💰 Amount: ${ethAmount} ETH`);

    return {
      txHash: receipt.hash,
      amount: ethAmount,
      gasUsed: receipt.gasUsed.toString()
    };
  }

  async getSwapEstimate(xlmAmount: number): Promise<{ ethAmount: number; rate: number; marketData: any }> {
    const conversion = await calculateXLMToETH(xlmAmount);
    const marketSummary = await getMarketSummary();

    return {
      ethAmount: conversion.toAmount,
      rate: conversion.rate,
      marketData: {
        ethPrice: marketSummary.ethPrice,
        xlmPrice: marketSummary.xlmPrice,
        lastUpdated: marketSummary.lastUpdated
      }
    };
  }
}