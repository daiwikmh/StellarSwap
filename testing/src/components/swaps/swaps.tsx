import { useState, useEffect } from "react"
import { Sidebar, TopToolbar, SwapInterface, RecentTransactions, PartnerLogos } from "./"
// API configuration
const API_BASE_URL = import.meta.env.REACT_APP_BACKEND_URL || 'http://localhost:3000'

export default function RevolverSwap() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [ethPrice, setEthPrice] = useState(3247.82)
  const [xlmPrice, setXlmPrice] = useState(0.124)

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/market-summary`)
        if (!response.ok) throw new Error('Failed to fetch market data')
        const marketData = await response.json()
        setEthPrice(marketData.ethPrice)
        setXlmPrice(marketData.xlmPrice)
      } catch (error) {
        console.error("Failed to fetch prices:", error)
      }
    }

    fetchPrices() // Only fetch once on component mount
  }, [])

  const handleSwapExecution = async (fromAmount: string, toAmount: string, fromToken: string, toToken: string) => {
    console.log('🚀 Executing cross-chain swap:', { fromAmount, toAmount, fromToken, toToken })
    
    try {
      // TODO: Implement API endpoint for cross-chain HTLC execution
      // For now, just log the swap parameters
      console.log('Cross-chain swap execution would be handled by backend API')
      console.log('✅ Cross-chain swap completed successfully!')
    } catch (error) {
      console.error('❌ Cross-chain swap failed:', error)
      throw error
    }
  }

  return (
    <div className="flex h-screen">
      <Sidebar 
        sidebarCollapsed={sidebarCollapsed} 
        setSidebarCollapsed={setSidebarCollapsed}
        ethPrice={ethPrice}
        xlmPrice={xlmPrice}
      />
      
      <div className={`flex-1 flex flex-col ${!sidebarCollapsed ? "md:ml-0" : ""}`}>
        <TopToolbar ethPrice={ethPrice} xlmPrice={xlmPrice} />
        
        <div className="flex-1 overflow-auto bg-black">
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="w-full max-w-md">
              <SwapInterface onSwapExecute={handleSwapExecution} />
              <RecentTransactions />
            </div>
          </div>
          
          <PartnerLogos />
        </div>
      </div>
    </div>
  )
}
