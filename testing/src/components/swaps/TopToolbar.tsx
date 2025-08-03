"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Bell, Settings, RefreshCw } from "lucide-react"

// API configuration
const API_BASE_URL = import.meta.env.REACT_APP_BACKEND_URL || 'http://localhost:3001'

interface MarketSummary {
  ethPrice: number
  xlmPrice: number
  exchangeRate: number
  lastUpdated: Date
}

interface TopToolbarProps {
  ethPrice?: number
  xlmPrice?: number
  onPricesUpdate?: (ethPrice: number, xlmPrice: number) => void
}

export default function TopToolbar({ ethPrice: propEthPrice, xlmPrice: propXlmPrice, onPricesUpdate }: TopToolbarProps) {
  const [ethPrice, setEthPrice] = useState<number>(propEthPrice || 0)
  const [xlmPrice, setXlmPrice] = useState<number>(propXlmPrice || 0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchMarketPrices = async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/market-summary`)
      if (!response.ok) throw new Error('Failed to fetch market data')
      
      const marketSummary: MarketSummary = await response.json()
      setEthPrice(marketSummary.ethPrice)
      setXlmPrice(marketSummary.xlmPrice)
      setLastUpdated(new Date())
      
      // Notify parent component of price updates
      if (onPricesUpdate) {
        onPricesUpdate(marketSummary.ethPrice, marketSummary.xlmPrice)
      }
      
      console.log('📊 Market prices updated:', {
        ethPrice: marketSummary.ethPrice,
        xlmPrice: marketSummary.xlmPrice,
        lastUpdated: new Date().toLocaleTimeString()
      })
    } catch (error) {
      console.error("Failed to fetch market prices:", error)
      // Fallback to prop values or defaults
      setEthPrice(propEthPrice || 3247.82)
      setXlmPrice(propXlmPrice || 0.124)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Fetch prices on mount and every 30 seconds
  useEffect(() => {
    fetchMarketPrices()
    const interval = setInterval(fetchMarketPrices, 30000) // 30 seconds
    
    return () => clearInterval(interval)
  }, [])

  // Update from props if they change
  useEffect(() => {
    if (propEthPrice && propXlmPrice) {
      setEthPrice(propEthPrice)
      setXlmPrice(propXlmPrice)
    }
  }, [propEthPrice, propXlmPrice])

  const formatLastUpdated = () => {
    if (!lastUpdated) return ""
    const now = new Date()
    const diff = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000)
    
    if (diff < 60) return `${diff}s ago`
    const minutes = Math.floor(diff / 60)
    return `${minutes}m ago`
  }

  return (
    <div className="h-16 bg-neutral-800 border-b border-neutral-700 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <div className="text-sm text-neutral-400">
          crossinch+ / <span className="text-orange-500">SWAP</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="text-xs text-neutral-500">
            ETH: <span className="text-green-400 font-mono">${ethPrice.toFixed(2)}</span> | 
            XLM: <span className="text-blue-400 font-mono">${xlmPrice.toFixed(4)}</span>
          </div>
          {lastUpdated && (
            <div className="text-xs text-neutral-600">
              {formatLastUpdated()}
            </div>
          )}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={fetchMarketPrices}
            disabled={isRefreshing}
            className="text-neutral-400 hover:text-orange-500 h-6 w-6 p-0"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-orange-500">
          <Bell className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-orange-500">
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}