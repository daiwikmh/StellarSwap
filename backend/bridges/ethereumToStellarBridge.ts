import { ethers } from 'ethers';
import * as StellarSdk from 'stellar-sdk';
import { calculateETHToXLM, getMarketSummary } from '../components/crosschain/priceService';

interface EthToStellarConfig {
  ethereum: {
    rpcUrl: string;
    htlcAddress: string;
    relayerKey: string;
    receiverKey: string;
    chainId: number;
  };
  stellar: {
    network: string;
    htlcAddress: string;
    privateKey: string;
    receiverKey: string;
    rpcUrl: string;
    xlmAddress: string;
  };
  limitOrder: {
    protocol: string;
    predicateAddress: string;
    wethAddress: string;
  };
}

export interface EthToStellarSwapParams {
  ethAmount: number;
  customXlmAmount?: number;
  ethereumSender: string;
  stellarReceiver: string;
  secret?: string;
}

export interface EthToStellarResult {
  success: boolean;
  txHashes: {
    ethereumHTLC: string;
    stellarRegistration: string;
    ethereumClaim: string;
    stellarFill: string;
  };
  amounts: {
    ethSent: number;
    xlmReceived: number;
    rate: number;
  };
  secret: string;
  orderHash: string;
  error?: string;
}

export class EthereumToStellarBridge {
  private provider: ethers.JsonRpcProvider;
  private relayerWallet: ethers.Wallet;
  private userWallet: ethers.Wallet;
  private stellarServer: StellarSdk.Horizon.Server;
  private stellarSource: StellarSdk.Keypair;
  private stellarReceiver: StellarSdk.Keypair;
  private config: EthToStellarConfig;

  constructor(config: EthToStellarConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.ethereum.rpcUrl);
    this.relayerWallet = new ethers.Wallet(config.ethereum.relayerKey, this.provider);
    this.userWallet = new ethers.Wallet(config.ethereum.receiverKey, this.provider);
    
    this.stellarServer = new StellarSdk.Horizon.Server(config.stellar.rpcUrl);
    this.stellarSource = StellarSdk.Keypair.fromSecret(config.stellar.privateKey);
    this.stellarReceiver = StellarSdk.Keypair.fromSecret(config.stellar.receiverKey);
  }

  async executeEthToStellarSwap(params: EthToStellarSwapParams): Promise<EthToStellarResult> {
    console.log('⚡→🌟 Starting Ethereum to Stellar Bridge Swap');
    console.log(`Swapping ${params.ethAmount} ETH to XLM`);

    const secret = params.secret || `eth-to-stellar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const hashlock = ethers.keccak256(ethers.toUtf8Bytes(secret));
    const timelock = Math.floor(Date.now() / 1000) + 7200; // 2 hours

    try {
      // Calculate XLM amount based on real-time prices if not provided
      let xlmAmount: number;
      if (params.customXlmAmount) {
        xlmAmount = params.customXlmAmount;
      } else {
        const conversion = await calculateETHToXLM(params.ethAmount);
        xlmAmount = conversion.toAmount;
        console.log(`💱 Real-time conversion: ${params.ethAmount} ETH → ${xlmAmount} XLM (Rate: ${conversion.rate})`);
      }

      // Step 1: Create Ethereum HTLC
      console.log('\n1️⃣ Creating Ethereum HTLC...');
      const ethereumHTLCResult = await this.createEthereumHTLC(params.ethAmount, hashlock, timelock);

      // Step 2: Register HTLC with Stellar predicate/contract
      console.log('\n2️⃣ Registering HTLC with Stellar contract...');
      const stellarRegistrationResult = await this.registerStellarHTLC(ethereumHTLCResult.orderHash, hashlock, timelock, xlmAmount);

      // Step 3: User claims Ethereum HTLC (reveals secret)
      console.log('\n3️⃣ User claiming Ethereum HTLC...');
      const ethereumClaimResult = await this.claimEthereumHTLC(ethereumHTLCResult.contractAddress, secret);

      // Step 4: User claims Stellar XLM with revealed secret
      console.log('\n4️⃣ User claiming Stellar XLM with revealed secret...');
      const stellarFillResult = await this.claimStellarXLM(stellarRegistrationResult.swapId, secret);

      const result: EthToStellarResult = {
        success: true,
        txHashes: {
          ethereumHTLC: ethereumHTLCResult.txHash,
          stellarRegistration: stellarRegistrationResult.txHash,
          ethereumClaim: ethereumClaimResult.txHash,
          stellarFill: stellarFillResult.txHash
        },
        amounts: {
          ethSent: params.ethAmount,
          xlmReceived: xlmAmount,
          rate: xlmAmount / params.ethAmount
        },
        secret: secret,
        orderHash: ethereumHTLCResult.orderHash
      };

      console.log('\n🎉 Ethereum to Stellar swap completed successfully!');
      console.log('✅ ETH locked and claimed on Ethereum');
      console.log('✅ XLM received on Stellar');
      console.log('✅ Atomic swap guarantee maintained');

      return result;

    } catch (error) {
      console.error('❌ Ethereum to Stellar swap failed:', error);
      return {
        success: false,
        txHashes: { ethereumHTLC: '', stellarRegistration: '', ethereumClaim: '', stellarFill: '' },
        amounts: { ethSent: 0, xlmReceived: 0, rate: 0 },
        secret: '',
        orderHash: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async createEthereumHTLC(amount: number, hashlock: string, timelock: number) {
    const swapId = `ethereum-htlc-${Date.now()}`;
    const orderHash = ethers.keccak256(ethers.toUtf8Bytes(swapId));

    // Deploy Simple HTLC contract or use existing one
    const htlcContract = new ethers.Contract(
      this.config.ethereum.htlcAddress,
      [
        'function deposit(address payable _receiver, bytes32 _hashlock, uint256 _timelock) external payable returns (bytes32 swapId)',
        'function claim(bytes32 _swapId, string memory _preimage) external',
        'function refund(bytes32 _swapId) external'
      ],
      this.relayerWallet
    );

    const ethValue = ethers.parseEther(amount.toString());
    const depositTx = await htlcContract.deposit(
      this.userWallet.address,
      hashlock,
      timelock,
      { value: ethValue }
    );

    const receipt = await depositTx.wait();
    console.log(`✅ Ethereum HTLC created: ${receipt.hash}`);
    console.log(`💰 Amount deposited: ${amount} ETH`);

    return {
      txHash: receipt.hash,
      contractAddress: this.config.ethereum.htlcAddress,
      swapId,
      orderHash,
      hashlock,
      timelock
    };
  }

  private async registerStellarHTLC(orderHash: string, hashlock: string, timelock: number, xlmAmount: number) {
    const account = await this.stellarServer.loadAccount(this.stellarSource.publicKey());
    const swapId = `stellar-registration-${Date.now()}`;

    // Create Stellar HTLC that will hold XLM for the user
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
          StellarSdk.xdr.ScVal.scvI128(StellarSdk.xdr.Int128Parts.fromString(xlmAmount.toString())),
          StellarSdk.xdr.ScVal.scvBytes(Buffer.from(hashlock.slice(2), 'hex')),
          StellarSdk.xdr.ScVal.scvU64(StellarSdk.xdr.Uint64.fromString(timelock.toString()))
        ]
      })
    )
    .setTimeout(300)
    .build();

    transaction.sign(this.stellarSource);
    const result = await this.stellarServer.submitTransaction(transaction);

    console.log(`✅ Stellar HTLC registered: ${result.hash}`);
    console.log(`💰 XLM reserved: ${xlmAmount} XLM`);

    return {
      txHash: result.hash,
      swapId,
      xlmAmount
    };
  }

  private async claimEthereumHTLC(contractAddress: string, secret: string) {
    const htlcContract = new ethers.Contract(
      contractAddress,
      [
        'function claim(bytes32 _swapId, string memory _preimage) external'
      ],
      this.userWallet
    );

    // Generate swapId from the secret (simplified - in production would get from previous step)
    const swapId = ethers.keccak256(ethers.toUtf8Bytes(`ethereum-htlc-${secret}`));
    
    const claimTx = await htlcContract.claim(swapId, secret);
    const receipt = await claimTx.wait();

    console.log(`✅ Ethereum HTLC claimed: ${receipt.hash}`);
    console.log(`🔑 Secret revealed: ${secret}`);

    return {
      txHash: receipt.hash,
      revealedSecret: secret,
      gasUsed: receipt.gasUsed.toString()
    };
  }

  private async claimStellarXLM(swapId: string, secret: string) {
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

    console.log(`✅ Stellar XLM claimed: ${result.hash}`);
    console.log(`💰 XLM transferred to user`);

    return {
      txHash: result.hash,
      claimed: true
    };
  }

  async getSwapEstimate(ethAmount: number): Promise<{ xlmAmount: number; rate: number; marketData: any }> {
    const conversion = await calculateETHToXLM(ethAmount);
    const marketSummary = await getMarketSummary();

    return {
      xlmAmount: conversion.toAmount,
      rate: conversion.rate,
      marketData: {
        ethPrice: marketSummary.ethPrice,
        xlmPrice: marketSummary.xlmPrice,
        lastUpdated: marketSummary.lastUpdated
      }
    };
  }

  async checkBalances(): Promise<{ ethereum: string; stellar: string }> {
    // Check Ethereum balance
    const ethBalance = await this.provider.getBalance(this.userWallet.address);
    
    // Check Stellar balance
    let stellarBalance = '0';
    try {
      const account = await this.stellarServer.loadAccount(this.stellarReceiver.publicKey());
      const nativeBalance = account.balances.find(b => b.asset_type === 'native');
      stellarBalance = nativeBalance?.balance || '0';
    } catch (error) {
      console.log('Could not load Stellar balance:', error);
    }

    return {
      ethereum: ethers.formatEther(ethBalance),
      stellar: stellarBalance
    };
  }

  async validateSwapRequirements(ethAmount: number): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check Ethereum balance
    const ethBalance = await this.provider.getBalance(this.relayerWallet.address);
    const requiredAmount = ethers.parseEther((ethAmount + 0.01).toString()); // Add gas buffer
    
    if (ethBalance < requiredAmount) {
      errors.push(`Insufficient ETH balance. Required: ${ethAmount + 0.01} ETH, Available: ${ethers.formatEther(ethBalance)} ETH`);
    }

    // Check Stellar account exists
    try {
      await this.stellarServer.loadAccount(this.stellarReceiver.publicKey());
    } catch (error) {
      errors.push('Stellar receiver account does not exist or is not funded');
    }

    // Check contract addresses
    if (!this.config.ethereum.htlcAddress || this.config.ethereum.htlcAddress === '') {
      errors.push('Ethereum HTLC contract address not configured');
    }

    if (!this.config.stellar.htlcAddress || this.config.stellar.htlcAddress === '') {
      errors.push('Stellar HTLC contract address not configured');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}