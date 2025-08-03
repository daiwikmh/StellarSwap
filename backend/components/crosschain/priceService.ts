import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.COINMARKETCAP_API_KEY;

// Debug API key
console.log('🔑 API Key loaded:', API_KEY ? `${API_KEY.substring(0, 8)}...` : 'NOT FOUND');

// Price cache
let priceCache: MarketSummary | null = null;

// CoinMarketCap IDs
const ETH_CMC_ID = '1027'; // Ethereum
const XLM_CMC_ID = '512';  // Stellar

export async function getCryptoPricesUSD(): Promise<{ ethPrice: number; xlmPrice: number }> {
  // Only use CoinMarketCap v2 API as requested
  if (!API_KEY) {
    throw new Error('CoinMarketCap API key is required. Please set COINMARKETCAP_API_KEY environment variable.')
  }
  
  try {
    const url = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?id=${ETH_CMC_ID},${XLM_CMC_ID}&convert=USD`
    console.log('🌐 Making CoinMarketCap v2 API call:', url)
    
    const res = await fetch(url, {
      headers: {
        "X-CMC_PRO_API_KEY": API_KEY,
        Accept: "application/json",
      },
    })
    
    console.log('📡 API Response status:', res.status, res.statusText)
    
    if (!res.ok) {
      const errorText = await res.text()
      console.error('❌ API Error:', errorText)
      throw new Error(`CoinMarketCap API failed: ${res.status} - ${errorText}`)
    }
    
    const json = await res.json()
    
    // Parse response: data[id].quote.USD.price
    const ethPrice = json.data?.[ETH_CMC_ID]?.quote?.USD?.price
    const xlmPrice = json.data?.[XLM_CMC_ID]?.quote?.USD?.price
    
    if (!ethPrice || !xlmPrice) {
      console.error('❌ Failed to extract prices from response')
      console.log('Available data keys:', json.data ? Object.keys(json.data) : 'No data')
      console.log('ETH price found:', !!ethPrice, ethPrice)
      console.log('XLM price found:', !!xlmPrice, xlmPrice)
      throw new Error('Missing price data in API response')
    }
    
    console.log(`💰 ETH Price: $${ethPrice.toFixed(2)}`)
    console.log(`💰 XLM Price: $${xlmPrice.toFixed(6)}`)
    
    return { ethPrice, xlmPrice }
    
  } catch (error) {
    console.error('❌ Failed to fetch crypto prices from CoinMarketCap:', error)
    throw error
  }
}

export interface MarketSummary {
  ethPrice: number
  xlmPrice: number
  lastUpdated: number
}

export interface ConversionResult {
  outputAmount: number
  exchangeRate: number
  fee: number
  minimumReceived: number
}

export async function getMarketSummary(forceRefresh = false): Promise<MarketSummary> {
  // Return cached prices if available and not forcing refresh
  if (priceCache && !forceRefresh) {
    console.log('📊 Using cached prices')
    return priceCache
  }

  console.log('🔄 Fetching fresh prices from CoinMarketCap API...')
  
  try {
    const { ethPrice, xlmPrice } = await getCryptoPricesUSD()
    
    priceCache = {
      ethPrice,
      xlmPrice,
      lastUpdated: Date.now()
    }
    console.log('✅ Prices updated:', priceCache)
    
    return priceCache
  } catch (error) {
    console.error('❌ Price fetch failed:', error)
    
    // If we have cached prices, return them even if stale
    if (priceCache) {
      console.log('⚠️ Using stale cached prices due to API failure')
      return priceCache
    }
    
    // Last resort: return reasonable fallback prices
    console.log('⚠️ Using fallback prices - API failed and no cache available')
    priceCache = {
      ethPrice: 3400,
      xlmPrice: 0.12,
      lastUpdated: Date.now()
    }
    return priceCache
  }
}

export async function calculateXLMToETH(xlmAmount: number, forceRefresh = false): Promise<ConversionResult> {
  const { ethPrice, xlmPrice } = await getMarketSummary(forceRefresh)
  
  const xlmValueUSD = xlmAmount * xlmPrice
  const ethAmount = xlmValueUSD / ethPrice
  const exchangeRate = xlmPrice / ethPrice
  const fee = ethAmount * 0.003 // 0.3% fee
  const minimumReceived = ethAmount - fee
  
  return {
    outputAmount: ethAmount,
    exchangeRate,
    fee,
    minimumReceived
  }
}

export async function calculateETHToXLM(ethAmount: number, forceRefresh = false): Promise<ConversionResult> {
  const { ethPrice, xlmPrice } = await getMarketSummary(forceRefresh)
  
  const ethValueUSD = ethAmount * ethPrice
  const xlmAmount = ethValueUSD / xlmPrice
  const exchangeRate = ethPrice / xlmPrice
  const fee = xlmAmount * 0.003 // 0.3% fee
  const minimumReceived = xlmAmount - fee
  
  return {
    outputAmount: xlmAmount,
    exchangeRate,
    fee,
    minimumReceived
  }
}

// Initialize prices on startup
export async function initializePrices(): Promise<void> {
  console.log('🚀 Initializing price cache on startup...')
  await getMarketSummary(true) // Force fresh fetch
  console.log('✅ Price cache initialized')
}

// Test functions (for development)
export async function testPriceFunctions() {
  console.log('Testing price functions...');
  await getETHPriceUSD();
  await getXLMPriceUSD();
  
  const marketSummary = await getMarketSummary()
  console.log('Market Summary:', marketSummary)
  
  const conversion = await calculateXLMToETH(1000)
  console.log('1000 XLM to ETH:', conversion)
}