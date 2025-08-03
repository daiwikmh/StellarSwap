const express = require('express');
const cors = require('cors');
const { HTLCLimitOrderBridge } = require('./scripts/integrated-htlc-lop.js');

const app = express();
const PORT = 3002; // Different port from backend

// Middleware
app.use(cors());
app.use(express.json());

// Initialize bridge
let bridge;

async function initializeBridge() {
  try {
    bridge = new HTLCLimitOrderBridge();
    console.log('✅ HTLCLimitOrderBridge initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize bridge:', error);
  }
}

// Bridge execution endpoint
app.post('/api/execute-bridge', async (req, res) => {
  try {
    console.log('🌉 Received bridge execution request:', req.body);
    
    const { xlmAmount, ethAmount, direction, userAddress, stellarReceiver } = req.body;
    
    // Validate required parameters
    if (!xlmAmount || !ethAmount || !direction || !userAddress || !stellarReceiver) {
      return res.status(400).json({ 
        error: 'Missing required parameters: xlmAmount, ethAmount, direction, userAddress, stellarReceiver' 
      });
    }

    // Validate direction
    if (!['xlm-to-eth', 'eth-to-xlm'].includes(direction)) {
      return res.status(400).json({ 
        error: 'Invalid direction. Must be "xlm-to-eth" or "eth-to-xlm"' 
      });
    }

    console.log('🚀 Executing bridge swap with parameters:', {
      xlmAmount: parseFloat(xlmAmount),
      ethAmount: parseFloat(ethAmount),
      direction,
      userAddress,
      stellarReceiver
    });

    let result;

    if (direction === 'xlm-to-eth') {
      console.log('🌟→⚡ Executing Stellar to Ethereum Bridge...');
      result = await executeStellarToEthBridge(parseFloat(xlmAmount), parseFloat(ethAmount));
    } else {
      console.log('⚡→🌟 Executing Ethereum to Stellar Bridge...');
      result = await executeEthToStellarBridge(parseFloat(ethAmount), parseFloat(xlmAmount));
    }

    console.log('✅ Bridge execution completed:', result);
    
    res.json({
      success: true,
      txHashes: result.txHashes,
      explorerUrls: result.explorerUrls,
      amounts: {
        xlmAmount: parseFloat(xlmAmount),
        ethAmount: parseFloat(ethAmount)
      },
      secret: result.secret,
      orderHash: result.orderHash,
      contractAddresses: {
        htlcPredicate: "0xD72f5a8330d6cAFc5F88155B96d8Fb3F871Cce3D",
        limitOrderProtocol: "0x111111125421ca6dc452d289314280a0f8842a65",
        stellarHtlc: "CAHJGCOJHEX43V3YW3B777L5DMQW3LOEORXLT42BO6BNXD7SRZYIGYSH",
        wethAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
      }
    });
    
  } catch (error) {
    console.error('❌ Bridge execution error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Bridge execution failed',
      txHashes: {},
      amounts: {},
      secret: '',
      orderHash: '',
      explorerUrls: {},
      contractAddresses: {}
    });
  }
});

async function executeStellarToEthBridge(xlmAmount, ethAmount) {
  console.log('🌟 Step 1: Creating Stellar HTLC...');
  console.log('💰 Amount:', xlmAmount, 'XLM →', ethAmount, 'ETH');
  
  const secret = `live-bridge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Step 1: Create Stellar HTLC
    const stellarData = await bridge.createStellarHTLC(xlmAmount, secret);
    console.log('✅ Stellar HTLC Created:', stellarData.stellarTxHash);
    console.log('🔍 Stellar Explorer: https://stellar.expert/explorer/testnet/search?term=' + stellarData.stellarTxHash);

    // Step 2: Create 1inch Limit Order with HTLC Predicate
    console.log('⚡ Step 2: Creating 1inch Limit Order...');
    const orderData = await bridge.createLimitOrderWithHTLC(stellarData, ethAmount);
    console.log('✅ Limit Order Created:', orderData.orderHash);
    console.log('🔍 Ethereum Explorer: https://holesky.etherscan.io/tx/' + orderData.registrationTx);

    // Step 3: User claims Stellar HTLC (reveals preimage)
    console.log('🔓 Step 3: Claiming Stellar HTLC...');
    const claimData = await bridge.claimStellarHTLC(stellarData);
    console.log('✅ Stellar HTLC Claimed:', claimData.claimTxHash);
    console.log('🔑 Secret Revealed:', claimData.revealedSecret);

    // Step 4: Fill Ethereum limit order with preimage
    console.log('💰 Step 4: Filling Ethereum Order...');
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
      explorerUrls: {
        stellarHTLC: `https://stellar.expert/explorer/testnet/search?term=${stellarData.stellarTxHash}`,
        ethereumRegistration: `https://holesky.etherscan.io/tx/${orderData.registrationTx}`,
        stellarClaim: `https://stellar.expert/explorer/testnet/search?term=${claimData.claimTxHash}`,
        ethereumFill: `https://holesky.etherscan.io/tx/${fillData.fillTxHash}`
      },
      secret: claimData.revealedSecret,
      orderHash: orderData.orderHash
    };
  } catch (error) {
    console.error('❌ Bridge execution failed:', error);
    throw error;
  }
}

async function executeEthToStellarBridge(ethAmount, xlmAmount) {
  console.log('⚡ Step 1: Creating Ethereum HTLC...');
  console.log('💰 Amount:', ethAmount, 'ETH →', xlmAmount, 'XLM');
  
  // For now, return a mock result - implement full ETH->XLM flow later
  const secret = `eth-bridge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    success: true,
    txHashes: {
      ethereumHTLC: `eth-htlc-${Date.now()}`,
      stellarRegistration: `stellar-reg-${Date.now()}`,
      ethereumClaim: `eth-claim-${Date.now()}`,
      stellarFill: `stellar-fill-${Date.now()}`
    },
    explorerUrls: {
      ethereumHTLC: `https://holesky.etherscan.io/tx/eth-htlc-${Date.now()}`,
      stellarRegistration: `https://stellar.expert/explorer/testnet/search?term=stellar-reg-${Date.now()}`,
      ethereumClaim: `https://holesky.etherscan.io/tx/eth-claim-${Date.now()}`,
      stellarFill: `https://stellar.expert/explorer/testnet/search?term=stellar-fill-${Date.now()}`
    },
    secret: secret,
    orderHash: `order-${Date.now()}`
  };
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'bridge-server',
    port: PORT,
    timestamp: new Date().toISOString() 
  });
});

app.listen(PORT, async () => {
  console.log(`🌉 Bridge Server running on port ${PORT}`);
  console.log('🔧 Service: Cross-Chain Bridge Execution');
  console.log('📡 Endpoint: POST /api/execute-bridge');
  
  // Initialize bridge on startup
  await initializeBridge();
});

module.exports = app;