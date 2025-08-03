require('dotenv').config();

import express from 'express';
import cors from 'cors';
import { getMarketSummary, calculateXLMToETH, calculateETHToXLM, initializePrices } from './components/crosschain/priceService';
import { LiveBridgeService, LiveBridgeParams } from './services/liveBridgeService';


const app = express();
const PORT = 3001;

// Initialize services
const liveBridgeService = new LiveBridgeService();

// Middleware
app.use(cors());
app.use(express.json());

// Price service endpoints
app.get('/api/market-summary', async (req, res) => {
  try {
    const forceRefresh = req.query.forceRefresh === 'true';
    const marketData = await getMarketSummary(forceRefresh);
    res.json(marketData);
  } catch (error) {
    console.error('Error fetching market summary:', error);
    res.status(500).json({ error: 'Failed to fetch market summary' });
  }
});

app.post('/api/calculate-xlm-to-eth', async (req, res) => {
  try {
    const { amount, forceRefresh } = req.body;
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }
    const result = await calculateXLMToETH(amount, forceRefresh);
    res.json(result);
  } catch (error) {
    console.error('Error calculating XLM to ETH:', error);
    res.status(500).json({ error: 'Failed to calculate XLM to ETH conversion' });
  }
});

app.post('/api/calculate-eth-to-xlm', async (req, res) => {
  try {
    const { amount, forceRefresh } = req.body;
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }
    const result = await calculateETHToXLM(amount, forceRefresh);
    res.json(result);
  } catch (error) {
    console.error('Error calculating ETH to XLM:', error);
    res.status(500).json({ error: 'Failed to calculate ETH to XLM conversion' });
  }
});

// Live cross-chain bridge execution endpoint
app.post('/api/execute-cross-chain-swap', async (req, res) => {
  try {
    console.log('🌉 Received cross-chain swap request:', req.body);
    
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

    const bridgeParams: LiveBridgeParams = {
      xlmAmount: parseFloat(xlmAmount),
      ethAmount: parseFloat(ethAmount),
      direction,
      userAddress,
      stellarReceiver
    };

    console.log('🚀 Executing live cross-chain bridge with params:', bridgeParams);
    
    const result = await liveBridgeService.executeLiveBridge(bridgeParams);
    
    if (result.success) {
      console.log('✅ Cross-chain swap completed successfully');
      res.json(result);
    } else {
      console.error('❌ Cross-chain swap failed:', result.error);
      res.status(500).json(result);
    }
    
  } catch (error) {
    console.error('❌ Cross-chain swap execution error:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      txHashes: {},
      amounts: {},
      secret: '',
      orderHash: '',
      explorerUrls: {},
      contractAddresses: {}
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, async () => {
  console.log(`Backend server running on port ${PORT}`);
  
  // Initialize prices on startup
  try {
    await initializePrices();
  } catch (error) {
    console.error('Failed to initialize prices:', error);
  }
});

export default app;