"use client"

import { useState, useEffect } from "react"
import { ArrowUpDown, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
// API configuration
const API_BASE_URL = import.meta.env.REACT_APP_BACKEND_URL || 'http://localhost:3001'
const BRIDGE_API_URL = import.meta.env.REACT_APP_BRIDGE_URL || 'http://localhost:3002'

// Types

interface ConversionResult {
  outputAmount: number
  exchangeRate: number
  fee: number
  minimumReceived: number
}

interface MarketSummary {
  ethPrice: number
  xlmPrice: number
  exchangeRate: number
  lastUpdated: Date
}

interface SwapInterfaceProps {
  onSwapExecute?: (fromAmount: string, toAmount: string, fromToken: string, toToken: string) => Promise<void>
}

export default function SwapInterface({ onSwapExecute }: SwapInterfaceProps) {
  const [fromAmount, setFromAmount] = useState("")
  const [toAmount, setToAmount] = useState("")
  const [fromToken, setFromToken] = useState("ETH")
  const [toToken, setToToken] = useState("XLM")
  const [isSwapping, setIsSwapping] = useState(false)
  const [exchangeRate, setExchangeRate] = useState<number>(0)
  const [ethPrice, setEthPrice] = useState<number>(0)
  const [xlmPrice, setXlmPrice] = useState<number>(0)

  const fetchCachedPrices = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/market-summary`)
      if (!response.ok) throw new Error('Failed to fetch cached market data')
      
      const marketSummary: MarketSummary = await response.json()
      setEthPrice(marketSummary.ethPrice)
      setXlmPrice(marketSummary.xlmPrice)
      
      if (fromToken === "ETH") {
        setExchangeRate(marketSummary.ethPrice / marketSummary.xlmPrice)
      } else {
        setExchangeRate(marketSummary.xlmPrice / marketSummary.ethPrice)
      }
    } catch (error) {
      console.error("Failed to fetch cached prices:", error)
    }
  }

  useEffect(() => {
    fetchCachedPrices() // Fetch cached prices on component mount only
  }, [])

  useEffect(() => {
    if (ethPrice > 0 && xlmPrice > 0) {
      let newRate: number
      if (fromToken === "ETH") {
        newRate = ethPrice / xlmPrice
      } else {
        newRate = xlmPrice / ethPrice
      }
      console.log('💱 Exchange rate updated:', {
        fromToken,
        toToken,
        ethPrice,
        xlmPrice,
        newRate
      })
      setExchangeRate(newRate)
    }
  }, [fromToken, toToken, ethPrice, xlmPrice])

  const handleSwap = async () => {
    if (!fromAmount || !toAmount) return
    
    setIsSwapping(true)
    try {
      console.log('🚀 Starting Cross-Chain Atomic Swap...')
      console.log('💰 Swap Parameters:', {
        fromAmount: parseFloat(fromAmount),
        toAmount: parseFloat(toAmount),
        fromToken,
        toToken,
        exchangeRate
      })
      
      // Fetch fresh prices with force refresh for accurate swap execution
      let conversion: ConversionResult
      if (fromToken === "ETH") {
        const response = await fetch(`${API_BASE_URL}/api/calculate-eth-to-xlm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: parseFloat(fromAmount), forceRefresh: true })
        })
        if (!response.ok) throw new Error('ETH to XLM conversion failed')
        conversion = await response.json()
      } else {
        const response = await fetch(`${API_BASE_URL}/api/calculate-xlm-to-eth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: parseFloat(fromAmount), forceRefresh: true })
        })
        if (!response.ok) throw new Error('XLM to ETH conversion failed')
        conversion = await response.json()
      }
      
      // Update the display with fresh conversion
      setToAmount(conversion.outputAmount.toFixed(6))
      setExchangeRate(conversion.exchangeRate)
      
      console.log('📊 Fresh prices fetched:', { exchangeRate: conversion.exchangeRate, outputAmount: conversion.outputAmount })
      
      // Execute cross-chain swap via bridge server
      console.log('🌉 Executing Cross-Chain Bridge Swap...')
      const swapResponse = await fetch(`${BRIDGE_API_URL}/api/execute-bridge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xlmAmount: fromToken === "XLM" ? parseFloat(fromAmount) : parseFloat(toAmount),
          ethAmount: fromToken === "ETH" ? parseFloat(fromAmount) : parseFloat(toAmount),
          direction: fromToken === "XLM" ? "xlm-to-eth" : "eth-to-xlm",
          userAddress: "0x9e1747D602cBF1b1700B56678F4d8395a9755235", // User wallet
          stellarReceiver: "GCRFJ72PLMERENWP2AGIEZOSZKEU4CLS27PKGFFZUE3EKSYDP36EOJC3"
        })
      })
      
      if (!swapResponse.ok) {
        throw new Error('Cross-chain swap execution failed')
      }
      
      const swapResult = await swapResponse.json()
      console.log('✅ Cross-Chain Swap Result:', swapResult)
      
      if (swapResult.success) {
        console.log('🎉 LIVE CROSS-CHAIN ATOMIC SWAP COMPLETED!')
        console.log('═══════════════════════════════════════════════════')
        console.log('📋 Transaction Hashes:')
        Object.entries(swapResult.txHashes).forEach(([key, hash]) => {
          console.log(`  ${key}: ${hash}`)
        })
        console.log('🔍 Explorer URLs:')
        Object.entries(swapResult.explorerUrls).forEach(([key, url]) => {
          console.log(`  ${key}: ${url}`)
        })
        console.log('📄 Order Details:')
        console.log(`  Order Hash: ${swapResult.orderHash}`)
        console.log(`  Secret: ${swapResult.secret}`)
        console.log('💰 Amounts:')
        console.log(`  XLM: ${swapResult.amounts.xlmAmount}`)
        console.log(`  ETH: ${swapResult.amounts.ethAmount}`)
        console.log('📋 Contract Addresses:')
        Object.entries(swapResult.contractAddresses).forEach(([key, address]) => {
          console.log(`  ${key}: ${address}`)
        })
        console.log('═══════════════════════════════════════════════════')
      } else {
        console.error('❌ Cross-chain swap failed:', swapResult.error)
        throw new Error(swapResult.error || 'Unknown swap error')
      }
      
      if (onSwapExecute) {
        await onSwapExecute(fromAmount, toAmount, fromToken, toToken)
      }
    } catch (error) {
      console.error("❌ Cross-chain swap failed:", error)
    } finally {
      setIsSwapping(false)
    }
  }

  const handleFlipTokens = () => {
    const tempToken = fromToken
    const tempAmount = fromAmount
    setFromToken(toToken)
    setToToken(tempToken)
    setFromAmount(toAmount)
    setToAmount(tempAmount)
    
    // Flip the exchange rate to match the new direction
    if (exchangeRate > 0) {
      setExchangeRate(1 / exchangeRate)
    }
  }

  const calculateToAmount = (amount: string) => {
    if (!amount || parseFloat(amount) <= 0 || exchangeRate === 0) return ""
    
    const inputAmount = parseFloat(amount)
    const outputAmount = inputAmount * exchangeRate
    return outputAmount.toFixed(6)
  }

  const calculateFromAmount = (amount: string) => {
    if (!amount || parseFloat(amount) <= 0 || exchangeRate === 0) return ""
    
    const inputAmount = parseFloat(amount)
    const outputAmount = inputAmount / exchangeRate
    return outputAmount.toFixed(6)
  }

  const handleFromAmountChange = (value: string) => {
    setFromAmount(value)
    const calculatedAmount = calculateToAmount(value)
    setToAmount(calculatedAmount)
  }

  const handleToAmountChange = (value: string) => {
    setToAmount(value)
    const calculatedAmount = calculateFromAmount(value)
    setFromAmount(calculatedAmount)
  }

  return (
    <Card className="bg-neutral-900 border-neutral-700">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-white tracking-wider">SWAP</CardTitle>
          <div className="text-xs text-neutral-500 font-mono">ETH ↔ STELLAR</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-neutral-400">
            <span>FROM</span>
            <span>Price: ${fromToken === "ETH" ? ethPrice.toFixed(2) : xlmPrice.toFixed(4)}</span>
          </div>
          <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <Input
                type="number"
                placeholder="0.0"
                value={fromAmount}
                onChange={(e) => handleFromAmountChange(e.target.value)}
                className="bg-transparent border-none text-2xl font-bold text-white p-0 h-auto focus-visible:ring-0"
              />
              <div className="flex items-center gap-2">
                <img 
                  src={fromToken === "ETH" 
                    ? "/eth.png" 
                    : "/stellar.png"
                  }
                  alt={`${fromToken} logo`}
                  className="w-8 h-8"
                />
                <span className="text-white font-bold">{fromToken}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleFlipTokens}
            className="text-neutral-400 hover:text-orange-500 border border-neutral-700 rounded-full"
          >
            <ArrowUpDown className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-neutral-400">
            <span>TO</span>
            <span>Price: ${toToken === "ETH" ? ethPrice.toFixed(2) : xlmPrice.toFixed(4)}</span>
          </div>
          <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <Input
                type="number"
                placeholder="0.0"
                value={toAmount}
                onChange={(e) => handleToAmountChange(e.target.value)}
                className="bg-transparent border-none text-2xl font-bold text-white p-0 h-auto focus-visible:ring-0"
              />
              <div className="flex items-center gap-2">
                <img 
                  src={toToken === "ETH" 
                    ? "/eth.png" 
                    : "/stellar.png"
                  }
                  alt={`${toToken} logo`}
                  className="w-8 h-8"
                />
                <span className="text-white font-bold">{toToken}</span>
              </div>
            </div>
          </div>
        </div>

        {fromAmount && (
          <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-3">
            <div className="flex justify-between text-xs text-neutral-400 mb-2">
              <span>Exchange Rate</span>
              <span>
                1 {fromToken} = {exchangeRate > 0 ? exchangeRate.toFixed(8) : "Loading..."} {toToken}
              </span>
            </div>
            <div className="flex justify-between text-xs text-neutral-400 mb-2">
              <span>USD Value</span>
              <span>
                ${fromAmount && fromToken === "ETH" 
                  ? (parseFloat(fromAmount) * ethPrice).toFixed(2)
                  : fromAmount 
                    ? (parseFloat(fromAmount) * xlmPrice).toFixed(2)
                    : "0.00"
                }
              </span>
            </div>
            <div className="flex justify-between text-xs text-neutral-400 mb-2">
              <span>Network Fee</span>
              <span>~$2.50</span>
            </div>
            <div className="flex justify-between text-xs text-neutral-400">
              <span>Estimated Time</span>
              <span>~2-5 minutes</span>
            </div>
          </div>
        )}

        <Button
          onClick={handleSwap}
          disabled={!fromAmount || isSwapping}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 disabled:opacity-50"
        >
          {isSwapping ? (
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              SWAPPING...
            </div>
          ) : (
            "EXECUTE SWAP"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}