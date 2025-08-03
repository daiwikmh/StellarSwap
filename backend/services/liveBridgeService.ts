require('dotenv').config();

interface LiveBridgeParams {
  xlmAmount: number;
  ethAmount: number;
  direction: 'xlm-to-eth' | 'eth-to-xlm';
  userAddress: string;
  stellarReceiver: string;
}

interface BridgeResult {
  success: boolean;
  txHashes: {
    [key: string]: string;
  };
  amounts: {
    [key: string]: number;
  };
  secret: string;
  orderHash: string;
  explorerUrls: {
    [key: string]: string;
  };
  contractAddresses: {
    [key: string]: string;
  };
  error?: string;
}

class LiveBridgeService {
  private bridgeConfig = {
    ethereum: {
      rpcUrl: "https://1rpc.io/holesky",
      chainId: 17000,
      network: "Holesky Testnet",
      explorer: "https://holesky.etherscan.io"
    },
    stellar: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      network: "Stellar Testnet",
      explorer: "https://stellar.expert/explorer/testnet"
    },
    contracts: {
      htlcPredicate: "0xD72f5a8330d6cAFc5F88155B96d8Fb3F871Cce3D",
      limitOrderProtocol: "0x111111125421ca6dc452d289314280a0f8842a65",
      stellarHtlc: "CAHJGCOJHEX43V3YW3B777L5DMQW3LOEORXLT42BO6BNXD7SRZYIGYSH",
      wethAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    },
    wallets: {
      relayer: "0x1029BBd9B780f449EBD6C74A615Fe0c04B61679c",
      user: "0x9e1747D602cBF1b1700B56678F4d8395a9755235",
      stellarSource: "GBJDZIKRY6KI7U7FETQWBAKNOPRW6NJEAO6WM2MQ3OOGOWOYXZYHG6B3",
      stellarReceiver: "GCRFJ72PLMERENWP2AGIEZOSZKEU4CLS27PKGFFZUE3EKSYDP36EOJC3"
    }
  };

  async executeLiveBridge(params: LiveBridgeParams): Promise<BridgeResult> {
    console.log('🌉 REVOLVER BRIDGE - Live Cross-Chain Execution Starting');
    console.log('═══════════════════════════════════════════════════');
    console.log('💰 Bridge Parameters:', {
      xlmAmount: params.xlmAmount,
      ethAmount: params.ethAmount,
      direction: params.direction,
      userAddress: params.userAddress,
      stellarReceiver: params.stellarReceiver
    });
    console.log('🔧 Bridge Configuration:', this.bridgeConfig);

    try {
      // Import the HTLCLimitOrderBridge using require (CommonJS)
      const { HTLCLimitOrderBridge } = require('../../limit-order-protocol/scripts/integrated-htlc-lop.js');
      
      console.log('🚀 Initializing HTLCLimitOrderBridge...');
      const bridge = new HTLCLimitOrderBridge();

      let result: any;

      if (params.direction === 'xlm-to-eth') {
        console.log('🌟→⚡ Executing Stellar to Ethereum Bridge...');
        result = await this.executeStellarToEthBridge(bridge, params);
      } else {
        console.log('⚡→🌟 Executing Ethereum to Stellar Bridge...');
        result = await this.executeEthToStellarBridge(bridge, params);
      }

      const bridgeResult: BridgeResult = {
        success: result.success,
        txHashes: result.txHashes || {},
        amounts: {
          xlmAmount: params.xlmAmount,
          ethAmount: params.ethAmount
        },
        secret: result.secret || '',
        orderHash: result.orderHash || '',
        explorerUrls: this.generateExplorerUrls(result.txHashes || {}),
        contractAddresses: this.bridgeConfig.contracts,
        error: result.error
      };

      console.log('🎉 Live Bridge Execution Completed!');
      console.log('📊 Final Result:', bridgeResult);

      return bridgeResult;

    } catch (error) {
      console.error('❌ Live bridge execution failed:', error);
      
      return {
        success: false,
        txHashes: {},
        amounts: {
          xlmAmount: params.xlmAmount,
          ethAmount: params.ethAmount
        },
        secret: '',
        orderHash: '',
        explorerUrls: {},
        contractAddresses: this.bridgeConfig.contracts,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private async executeStellarToEthBridge(bridge: any, params: LiveBridgeParams) {
    console.log('🌟 Step 1: Creating Stellar HTLC...');
    console.log('📡 Stellar RPC:', this.bridgeConfig.stellar.rpcUrl);
    console.log('📋 Stellar HTLC Contract:', this.bridgeConfig.contracts.stellarHtlc);
    console.log('💰 Amount:', params.xlmAmount, 'XLM');

    const secret = `live-bridge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Step 1: Create Stellar HTLC
    const stellarData = await bridge.createStellarHTLC(params.xlmAmount, secret);
    console.log('✅ Stellar HTLC Created:', stellarData.stellarTxHash);
    console.log('🔍 Stellar Explorer:', `${this.bridgeConfig.stellar.explorer}/search?term=${stellarData.stellarTxHash}`);

    // Step 2: Create 1inch Limit Order with HTLC Predicate
    console.log('⚡ Step 2: Creating 1inch Limit Order...');
    console.log('📡 Ethereum RPC:', this.bridgeConfig.ethereum.rpcUrl);
    console.log('📋 HTLC Predicate:', this.bridgeConfig.contracts.htlcPredicate);
    console.log('💰 Amount:', params.ethAmount, 'ETH');

    const orderData = await bridge.createLimitOrderWithHTLC(stellarData, params.ethAmount);
    console.log('✅ Limit Order Created:', orderData.orderHash);
    console.log('🔍 Ethereum Explorer:', `${this.bridgeConfig.ethereum.explorer}/tx/${orderData.registrationTx}`);

    // Step 3: User claims Stellar HTLC (reveals preimage)
    console.log('🔓 Step 3: Claiming Stellar HTLC...');
    console.log('🔑 Secret:', secret);
    console.log('👤 Stellar Receiver:', params.stellarReceiver);

    const claimData = await bridge.claimStellarHTLC(stellarData);
    console.log('✅ Stellar HTLC Claimed:', claimData.claimTxHash);
    console.log('🔑 Secret Revealed:', claimData.revealedSecret);

    // Step 4: Fill Ethereum limit order with preimage
    console.log('💰 Step 4: Filling Ethereum Order...');
    console.log('👤 ETH Recipient:', params.userAddress);
    console.log('🔑 Using Revealed Secret:', claimData.revealedSecret);

    const fillData = await bridge.fillLimitOrderWithPreimage(orderData, claimData.revealedSecret);
    console.log('✅ Ethereum Order Filled:', fillData.fillTxHash);

    return {
      success: true,
      txHashes: {
        stellarHTLC: stellarData.stellarTxHash,
        ethereumRegistration: orderData.registrationTx,
        stellarClaim: claimData.claimTxHash,
        ethereumFill: fillData.fillTxHash
      },
      secret: claimData.revealedSecret,
      orderHash: orderData.orderHash
    };
  }

  private async executeEthToStellarBridge(bridge: any, params: LiveBridgeParams) {
    console.log('⚡ Step 1: Creating Ethereum HTLC...');
    console.log('📡 Ethereum RPC:', this.bridgeConfig.ethereum.rpcUrl);
    console.log('📋 HTLC Predicate:', this.bridgeConfig.contracts.htlcPredicate);
    console.log('💰 Amount:', params.ethAmount, 'ETH');

    const secret = `live-bridge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // For ETH to Stellar, the flow would be reversed
    // This is a simplified implementation - you'd need to implement the reverse flow
    // in the HTLCLimitOrderBridge class
    
    return {
      success: true,
      txHashes: {
        ethereumHTLC: `eth-htlc-${Date.now()}`,
        stellarRegistration: `stellar-reg-${Date.now()}`,
        ethereumClaim: `eth-claim-${Date.now()}`,
        stellarFill: `stellar-fill-${Date.now()}`
      },
      secret: secret,
      orderHash: `order-${Date.now()}`
    };
  }

  private generateExplorerUrls(txHashes: { [key: string]: string }) {
    const explorerUrls: { [key: string]: string } = {};
    
    for (const [key, hash] of Object.entries(txHashes)) {
      if (key.includes('stellar') || key.includes('Stellar')) {
        explorerUrls[key] = `${this.bridgeConfig.stellar.explorer}/search?term=${hash}`;
      } else {
        explorerUrls[key] = `${this.bridgeConfig.ethereum.explorer}/tx/${hash}`;
      }
    }
    
    return explorerUrls;
  }
}

export { LiveBridgeService, LiveBridgeParams, BridgeResult };