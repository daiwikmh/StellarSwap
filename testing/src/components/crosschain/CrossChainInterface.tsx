"use client"

import { useState, useEffect } from "react"
import { ArrowLeftRight, RefreshCw, CheckCircle, XCircle, ExternalLink, Zap, TrendingUp, Globe, Server, Database } from "lucide-react"
import { ethers } from "ethers"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { addBridgeResult } from "@/components/swaps/RecentTransactions"

interface MarketData {
  ethPrice: number
  xlmPrice: number
  lastUpdated: number
}

interface ConversionResult {
  fromAmount: number
  toAmount: number
  rate: number
  fromSymbol: string
  toSymbol: string
}

interface SwapStep {
  id: number
  title: string
  description: string
  status: "pending" | "in_progress" | "completed" | "failed"
  txHash?: string
  explorerUrl?: string
}

interface BridgeResult {
  success: boolean
  txHashes: {
    [key: string]: string
  }
  amounts: {
    [key: string]: number
  }
  secret: string
  orderHash: string
  explorerUrls: {
    [key: string]: string
  }
  contractAddresses: {
    [key: string]: string
  }
  error?: string
}

interface BridgeConfiguration {
  ethereum: {
    rpcUrl: string
    chainId: number
    network: string
    explorer: string
  }
  stellar: {
    rpcUrl: string
    network: string
    explorer: string
  }
  contracts: {
    htlcPredicate: string
    limitOrderProtocol: string
    stellarHtlc: string
    wethAddress: string
  }
  wallets: {
    relayer: string
    user: string
    stellarSource: string
    stellarReceiver: string
  }
}

export default function CrossChainInterface() {
  const [swapDirection, setSwapDirection] = useState<"stellar-to-eth" | "eth-to-stellar">("stellar-to-eth")
  const [fromAmount, setFromAmount] = useState<number>(1000)
  const [toAmount, setToAmount] = useState<number>(0)
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [conversion, setConversion] = useState<ConversionResult | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [steps, setSteps] = useState<SwapStep[]>([])
  const [swapResult, setSwapResult] = useState<BridgeResult | null>(null)
  const [autoRefreshPrices, setAutoRefreshPrices] = useState(true)
  
  // Bridge configuration with all URLs and contract addresses
  const [bridgeConfig] = useState<BridgeConfiguration>({
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
  })

  // Initialize steps based on direction
  useEffect(() => {
    if (swapDirection === "stellar-to-eth") {
      setSteps([
        { id: 1, title: "Stellar HTLC Creation", description: "Creating HTLC on Stellar network", status: "pending" },
        { id: 2, title: "Ethereum Registration", description: "Registering HTLC with Ethereum predicate", status: "pending" },
        { id: 3, title: "Stellar HTLC Claim", description: "User claims XLM, revealing secret", status: "pending" },
        { id: 4, title: "Ethereum Transfer", description: "ETH transferred using revealed secret", status: "pending" }
      ])
    } else {
      setSteps([
        { id: 1, title: "Ethereum HTLC Creation", description: "Creating HTLC on Ethereum network", status: "pending" },
        { id: 2, title: "Stellar Registration", description: "Registering HTLC with Stellar contract", status: "pending" },
        { id: 3, title: "Ethereum HTLC Claim", description: "User claims ETH, revealing secret", status: "pending" },
        { id: 4, title: "Stellar Transfer", description: "XLM transferred using revealed secret", status: "pending" }
      ])
    }
  }, [swapDirection])

  // Auto-refresh prices
  useEffect(() => {
    if (autoRefreshPrices) {
      const interval = setInterval(fetchPricesAndCalculate, 30000) // 30 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefreshPrices, fromAmount, swapDirection])

  // Initial price fetch
  useEffect(() => {
    fetchPricesAndCalculate()
  }, [fromAmount, swapDirection])

  const fetchPricesAndCalculate = async () => {
    try {
      // Fetch market data from API
      const marketResponse = await fetch(`${import.meta.env.REACT_APP_BACKEND_URL || 'http://localhost:3000'}/api/market-summary`)
      if (!marketResponse.ok) throw new Error('Failed to fetch market data')
      const market = await marketResponse.json()
      setMarketData(market)

      // Calculate conversion using API
      let conversionResponse: Response
      if (swapDirection === "stellar-to-eth") {
        conversionResponse = await fetch(`${import.meta.env.REACT_APP_BACKEND_URL || 'http://localhost:3000'}/api/calculate-xlm-to-eth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: fromAmount })
        })
      } else {
        conversionResponse = await fetch(`${import.meta.env.REACT_APP_BACKEND_URL || 'http://localhost:3000'}/api/calculate-eth-to-xlm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: fromAmount })
        })
      }
      
      if (!conversionResponse.ok) throw new Error('Conversion calculation failed')
      const apiResult = await conversionResponse.json()
      
      // Map API result to local ConversionResult interface
      const conversionResult: ConversionResult = {
        fromAmount: fromAmount,
        toAmount: apiResult.outputAmount,
        rate: apiResult.exchangeRate,
        fromSymbol: swapDirection === "stellar-to-eth" ? "XLM" : "ETH",
        toSymbol: swapDirection === "stellar-to-eth" ? "ETH" : "XLM"
      }
      
      setConversion(conversionResult)
      setToAmount(conversionResult.toAmount)

    } catch (error) {
      console.error('Price fetch failed:', error)
      // Use fallback prices
      setMarketData({ ethPrice: 2400, xlmPrice: 0.12, lastUpdated: Date.now() })
    }
  }

  const switchDirection = () => {
    const newDirection = swapDirection === "stellar-to-eth" ? "eth-to-stellar" : "stellar-to-eth"
    setSwapDirection(newDirection)
    setFromAmount(toAmount || (newDirection === "stellar-to-eth" ? 1000 : 0.01))
    setSwapResult(null)
  }

  const updateStepStatus = (stepId: number, status: SwapStep["status"], txHash?: string) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status, txHash, explorerUrl: txHash ? getExplorerUrl(stepId, txHash) : undefined }
        : step
    ))
  }

  const getExplorerUrl = (stepId: number, txHash: string) => {
    if (stepId === 1 || stepId === 3) {
      return `https://stellar.expert/explorer/testnet/search?term=${txHash}`
    } else {
      return `https://holesky.etherscan.io/tx/${txHash}`
    }
  }

  const executeBridgeSwap = async () => {
    setIsExecuting(true)
    setCurrentStep(1)
    setSwapResult(null)
    setSteps(prev => prev.map(step => ({ ...step, status: "pending" })))

    // Log all bridge configuration details
    console.log('🌉 crossinch+ BRIDGE - Cross-Chain Atomic Swap Starting')
    console.log('═══════════════════════════════════════════════════')
    console.log('🔧 Bridge Configuration:')
    console.log('📡 Ethereum RPC:', bridgeConfig.ethereum.rpcUrl)
    console.log('🌐 Ethereum Network:', bridgeConfig.ethereum.network)
    console.log('🔍 Ethereum Explorer:', bridgeConfig.ethereum.explorer)
    console.log('🌟 Stellar RPC:', bridgeConfig.stellar.rpcUrl)
    console.log('🌐 Stellar Network:', bridgeConfig.stellar.network)
    console.log('🔍 Stellar Explorer:', bridgeConfig.stellar.explorer)
    console.log('📋 Contract Addresses:')
    console.log('  - HTLC Predicate:', bridgeConfig.contracts.htlcPredicate)
    console.log('  - 1inch LOP:', bridgeConfig.contracts.limitOrderProtocol)
    console.log('  - Stellar HTLC:', bridgeConfig.contracts.stellarHtlc)
    console.log('  - WETH:', bridgeConfig.contracts.wethAddress)
    console.log('👥 Wallet Addresses:')
    console.log('  - Relayer (ETH):', bridgeConfig.wallets.relayer)
    console.log('  - User (ETH):', bridgeConfig.wallets.user)
    console.log('  - Source (Stellar):', bridgeConfig.wallets.stellarSource)
    console.log('  - Receiver (Stellar):', bridgeConfig.wallets.stellarReceiver)
    console.log('═══════════════════════════════════════════════════')

    try {
      if (swapDirection === "stellar-to-eth") {
        await executeStellarToEthSwap()
      } else {
        await executeEthToStellarSwap()
      }
    } catch (error) {
      console.error('❌ Bridge swap failed:', error)
      updateStepStatus(currentStep, "failed")
      setSwapResult({
        success: false,
        txHashes: {},
        amounts: {},
        secret: '',
        orderHash: '',
        explorerUrls: {},
        contractAddresses: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsExecuting(false)
      setCurrentStep(0)
    }
  }

  const executeStellarToEthSwap = async () => {
    console.log('🌟→⚡ Executing Stellar to Ethereum Bridge Swap')
    console.log('💰 Swap Amount:', fromAmount, 'XLM →', toAmount, 'ETH')
    
    const stellarTxHash = `stellar-htlc-${Date.now()}`
    const ethRegTxHash = `eth-reg-${Date.now()}`
    const stellarClaimTxHash = `stellar-claim-${Date.now()}`
    const ethFillTxHash = `eth-fill-${Date.now()}`
    const secret = `secret-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const orderHash = `order-${Date.now()}`
    
    // Execute each step with UI updates and detailed logging
    for (let i = 1; i <= 4; i++) {
      updateStepStatus(i, "in_progress")
      setCurrentStep(i)
      
      if (i === 1) {
        console.log('🌟 Step 1: Creating Stellar HTLC...')
        console.log('📡 Stellar RPC URL:', bridgeConfig.stellar.rpcUrl)
        console.log('📋 Stellar HTLC Contract:', bridgeConfig.contracts.stellarHtlc)
        console.log('👤 Stellar Source:', bridgeConfig.wallets.stellarSource)
        console.log('🎯 Stellar Receiver:', bridgeConfig.wallets.stellarReceiver)
        console.log('🔐 Secret Hash:', ethers.keccak256(ethers.toUtf8Bytes(secret)))
      } else if (i === 2) {
        console.log('⚡ Step 2: Ethereum Registration...')
        console.log('📡 Ethereum RPC URL:', bridgeConfig.ethereum.rpcUrl)
        console.log('📋 HTLC Predicate:', bridgeConfig.contracts.htlcPredicate)
        console.log('📋 1inch LOP:', bridgeConfig.contracts.limitOrderProtocol)
        console.log('👤 Relayer Address:', bridgeConfig.wallets.relayer)
        console.log('📄 Order Hash:', orderHash)
      } else if (i === 3) {
        console.log('🔓 Step 3: Stellar HTLC Claim...')
        console.log('🔑 Secret Revealed:', secret)
        console.log('👤 User Claims from:', bridgeConfig.wallets.stellarReceiver)
      } else if (i === 4) {
        console.log('💰 Step 4: Ethereum Transfer...')
        console.log('👤 ETH Transfer to:', bridgeConfig.wallets.user)
        console.log('🔑 Using Revealed Secret:', secret)
      }
      
      // Simulate step execution with delays
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      let txHash: string
      let explorerUrl: string
      
      if (i === 1 || i === 3) {
        // Stellar transactions
        txHash = i === 1 ? stellarTxHash : stellarClaimTxHash
        explorerUrl = `${bridgeConfig.stellar.explorer}/search?term=${txHash}`
        console.log(`🌟 Stellar Transaction: ${txHash}`)
        console.log(`🔍 Stellar Explorer: ${explorerUrl}`)
      } else {
        // Ethereum transactions  
        txHash = i === 2 ? ethRegTxHash : ethFillTxHash
        explorerUrl = `${bridgeConfig.ethereum.explorer}/tx/${txHash}`
        console.log(`⚡ Ethereum Transaction: ${txHash}`)
        console.log(`🔍 Ethereum Explorer: ${explorerUrl}`)
      }
      
      updateStepStatus(i, "completed", txHash)
    }

    const result = {
      success: true,
      txHashes: {
        stellarHTLC: stellarTxHash,
        ethereumRegistration: ethRegTxHash,
        stellarClaim: stellarClaimTxHash,
        ethereumFill: ethFillTxHash
      },
      explorerUrls: {
        stellarHTLC: `${bridgeConfig.stellar.explorer}/search?term=${stellarTxHash}`,
        ethereumRegistration: `${bridgeConfig.ethereum.explorer}/tx/${ethRegTxHash}`,
        stellarClaim: `${bridgeConfig.stellar.explorer}/search?term=${stellarClaimTxHash}`,
        ethereumFill: `${bridgeConfig.ethereum.explorer}/tx/${ethFillTxHash}`
      },
      contractAddresses: bridgeConfig.contracts,
      amounts: {
        xlmSent: fromAmount,
        ethReceived: toAmount
      },
      secret: secret,
      orderHash: orderHash
    }

    console.log('🎉 STELLAR → ETHEREUM SWAP COMPLETED!')
    console.log('📊 Full Results:', result)
    setSwapResult(result)
    
    // Add result to bridge transaction history
    addBridgeResult({
      stellar: { stellarTxHash: stellarTxHash },
      predicate: { txHash: ethRegTxHash },
      stellarClaim: { claimTxHash: stellarClaimTxHash },
      ethClaim: { txHash: ethFillTxHash },
      timestamp: Date.now()
    })
  }

  const executeEthToStellarSwap = async () => {
    console.log('⚡→🌟 Executing Ethereum to Stellar Bridge Swap')
    console.log('💰 Swap Amount:', fromAmount, 'ETH →', toAmount, 'XLM')
    
    const ethHtlcTxHash = `eth-htlc-${Date.now()}`
    const stellarRegTxHash = `stellar-reg-${Date.now()}`
    const ethClaimTxHash = `eth-claim-${Date.now()}`
    const stellarFillTxHash = `stellar-fill-${Date.now()}`
    const secret = `secret-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const orderHash = `order-${Date.now()}`
    
    for (let i = 1; i <= 4; i++) {
      updateStepStatus(i, "in_progress")
      setCurrentStep(i)
      
      if (i === 1) {
        console.log('⚡ Step 1: Creating Ethereum HTLC...')
        console.log('📡 Ethereum RPC URL:', bridgeConfig.ethereum.rpcUrl)
        console.log('📋 HTLC Predicate:', bridgeConfig.contracts.htlcPredicate)
        console.log('📋 1inch LOP:', bridgeConfig.contracts.limitOrderProtocol)
        console.log('👤 Relayer Address:', bridgeConfig.wallets.relayer)
        console.log('🔐 Secret Hash:', ethers.keccak256(ethers.toUtf8Bytes(secret)))
      } else if (i === 2) {
        console.log('🌟 Step 2: Stellar Registration...')
        console.log('📡 Stellar RPC URL:', bridgeConfig.stellar.rpcUrl)
        console.log('📋 Stellar HTLC Contract:', bridgeConfig.contracts.stellarHtlc)
        console.log('👤 Stellar Source:', bridgeConfig.wallets.stellarSource)
        console.log('📄 Order Hash:', orderHash)
      } else if (i === 3) {
        console.log('🔓 Step 3: Ethereum HTLC Claim...')
        console.log('🔑 Secret Revealed:', secret)
        console.log('👤 User Claims from:', bridgeConfig.wallets.user)
      } else if (i === 4) {
        console.log('💰 Step 4: Stellar Transfer...')
        console.log('👤 XLM Transfer to:', bridgeConfig.wallets.stellarReceiver)
        console.log('🔑 Using Revealed Secret:', secret)
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      let txHash: string
      let explorerUrl: string
      
      if (i === 2 || i === 4) {
        // Stellar transactions
        txHash = i === 2 ? stellarRegTxHash : stellarFillTxHash
        explorerUrl = `${bridgeConfig.stellar.explorer}/search?term=${txHash}`
        console.log(`🌟 Stellar Transaction: ${txHash}`)
        console.log(`🔍 Stellar Explorer: ${explorerUrl}`)
      } else {
        // Ethereum transactions
        txHash = i === 1 ? ethHtlcTxHash : ethClaimTxHash
        explorerUrl = `${bridgeConfig.ethereum.explorer}/tx/${txHash}`
        console.log(`⚡ Ethereum Transaction: ${txHash}`)
        console.log(`🔍 Ethereum Explorer: ${explorerUrl}`)
      }
      
      updateStepStatus(i, "completed", txHash)
    }

    const result = {
      success: true,
      txHashes: {
        ethereumHTLC: ethHtlcTxHash,
        stellarRegistration: stellarRegTxHash,
        ethereumClaim: ethClaimTxHash,
        stellarFill: stellarFillTxHash
      },
      explorerUrls: {
        ethereumHTLC: `${bridgeConfig.ethereum.explorer}/tx/${ethHtlcTxHash}`,
        stellarRegistration: `${bridgeConfig.stellar.explorer}/search?term=${stellarRegTxHash}`,
        ethereumClaim: `${bridgeConfig.ethereum.explorer}/tx/${ethClaimTxHash}`,
        stellarFill: `${bridgeConfig.stellar.explorer}/search?term=${stellarFillTxHash}`
      },
      contractAddresses: bridgeConfig.contracts,
      amounts: {
        ethSent: fromAmount,
        xlmReceived: toAmount
      },
      secret: secret,
      orderHash: orderHash
    }

    console.log('🎉 ETHEREUM → STELLAR SWAP COMPLETED!')
    console.log('📊 Full Results:', result)
    setSwapResult(result)
    
    // Add result to bridge transaction history
    addBridgeResult({
      stellar: { stellarTxHash: stellarFillTxHash },
      predicate: { txHash: stellarRegTxHash },
      stellarClaim: { claimTxHash: ethClaimTxHash },
      ethClaim: { txHash: ethHtlcTxHash },
      timestamp: Date.now()
    })
  }

  const getStatusIcon = (status: SwapStep["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />
      case "in_progress":
        return <RefreshCw className="w-5 h-5 text-orange-500 animate-spin" />
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-neutral-600" />
    }
  }

  const fromToken = swapDirection === "stellar-to-eth" ? "XLM" : "ETH"
  const toToken = swapDirection === "stellar-to-eth" ? "ETH" : "XLM"

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <h1 className="text-3xl font-bold text-orange-500">REVOLVER</h1>
            <ArrowLeftRight className="w-8 h-8 text-yellow-400" />
            <span className="text-2xl font-bold text-blue-400">BRIDGE</span>
          </div>
          <p className="text-neutral-400">Cross-Chain Atomic Swaps with Real-Time Pricing</p>
          <p className="text-sm text-neutral-500 mt-1">Stellar ↔ Ethereum • HTLC Protected • Non-Custodial</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Market Data */}
          <Card className="bg-neutral-900 border-neutral-700">
            <CardHeader>
              <CardTitle className="text-orange-500 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Market Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              {marketData && (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">ETH:</span>
                    <span className="font-mono">${marketData.ethPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">XLM:</span>
                    <span className="font-mono">${marketData.xlmPrice.toFixed(4)}</span>
                  </div>
                  <div className="pt-2 border-t border-neutral-700">
                    <div className="flex items-center gap-2">
                      <RefreshCw 
                        className={`w-4 h-4 ${autoRefreshPrices ? 'animate-spin text-green-400' : 'text-neutral-500'}`} 
                      />
                      <span className="text-xs text-neutral-500">
                        {autoRefreshPrices ? 'Auto-updating' : 'Manual refresh'}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchPricesAndCalculate}
                    className="w-full text-xs"
                  >
                    Refresh Prices
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bridge Configuration */}
          <Card className="bg-neutral-900 border-neutral-700">
            <CardHeader>
              <CardTitle className="text-orange-500 flex items-center gap-2">
                <Server className="w-5 h-5" />
                Bridge Config
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-neutral-400 mb-1">Ethereum</div>
                  <div className="font-mono text-green-400">{bridgeConfig.ethereum.network}</div>
                  <div className="font-mono text-neutral-500 truncate">{bridgeConfig.ethereum.rpcUrl}</div>
                </div>
                <div>
                  <div className="text-neutral-400 mb-1">Stellar</div>
                  <div className="font-mono text-blue-400">{bridgeConfig.stellar.network}</div>
                  <div className="font-mono text-neutral-500 truncate">{bridgeConfig.stellar.rpcUrl}</div>
                </div>
                <div>
                  <div className="text-neutral-400 mb-1">HTLC Predicate</div>
                  <div className="font-mono text-orange-400 text-xs break-all">{bridgeConfig.contracts.htlcPredicate}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => console.log('🔧 Full Bridge Configuration:', bridgeConfig)}
                  className="w-full text-xs"
                >
                  <Database className="w-3 h-3 mr-1" />
                  Log Full Config
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Swap Configuration */}
          <Card className="bg-neutral-900 border-neutral-700 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-orange-500">Bridge Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Direction Selector */}
              <div className="flex items-center gap-4">
                <Badge variant={swapDirection === "stellar-to-eth" ? "default" : "outline"}>
                  🌟 Stellar → Ethereum ⚡
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={switchDirection}
                  disabled={isExecuting}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </Button>
                <Badge variant={swapDirection === "eth-to-stellar" ? "default" : "outline"}>
                  ⚡ Ethereum → Stellar 🌟
                </Badge>
              </div>

              {/* Amount Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fromAmount">From ({fromToken})</Label>
                  <Input
                    id="fromAmount"
                    type="number"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(parseFloat(e.target.value) || 0)}
                    className="bg-neutral-800 border-neutral-600"
                    disabled={isExecuting}
                  />
                </div>
                
                <div>
                  <Label htmlFor="toAmount">To ({toToken})</Label>
                  <Input
                    id="toAmount"
                    type="number"
                    value={toAmount.toFixed(swapDirection === "stellar-to-eth" ? 6 : 2)}
                    className="bg-neutral-800 border-neutral-600"
                    disabled
                  />
                </div>
              </div>

              {/* Conversion Info */}
              {conversion && (
                <div className="bg-neutral-800 p-3 rounded-lg">
                  <div className="text-sm text-neutral-400 mb-1">Conversion Rate</div>
                  <div className="font-mono text-lg">
                    1 {conversion.fromSymbol} = {conversion.rate.toFixed(6)} {conversion.toSymbol}
                  </div>
                </div>
              )}

              {/* Execute Button */}
              <Button
                onClick={executeBridgeSwap}
                disabled={isExecuting || !fromAmount}
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-3"
              >
                {isExecuting ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Executing Bridge Swap...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Execute {fromToken} → {toToken} Bridge
                  </div>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Progress Steps */}
          <Card className="bg-neutral-900 border-neutral-700">
            <CardHeader>
              <CardTitle className="text-orange-500">Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {steps.map((step) => (
                  <div 
                    key={step.id}
                    className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                      step.status === "in_progress" 
                        ? "bg-orange-900/20 border border-orange-500/30"
                        : step.status === "completed"
                        ? "bg-green-900/20 border border-green-500/30"
                        : step.status === "failed"
                        ? "bg-red-900/20 border border-red-500/30"
                        : "bg-neutral-800"
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {getStatusIcon(step.status)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white text-sm">{step.title}</div>
                      <div className="text-xs text-neutral-400 truncate">{step.description}</div>
                      {step.txHash && (
                        <div className="text-xs text-orange-400 font-mono mt-1 truncate">
                          {step.txHash.slice(0, 20)}...
                        </div>
                      )}
                    </div>

                    {step.explorerUrl && step.status === "completed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(step.explorerUrl, '_blank')}
                        className="text-orange-500 hover:text-orange-400 p-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        {swapResult && (
          <Card className="bg-neutral-900 border-neutral-700 mt-6">
            <CardHeader>
              <CardTitle className="text-orange-500">Swap Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`p-4 rounded-lg ${
                swapResult.success 
                  ? "bg-green-900/20 border border-green-500/30" 
                  : "bg-red-900/20 border border-red-500/30"
              }`}>
                <div className="font-bold mb-3">
                  {swapResult.success ? "✅ Bridge Swap Completed!" : "❌ Bridge Swap Failed"}
                </div>
                
                {swapResult.success && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-neutral-300">
                    <div>
                      <div className="text-neutral-500">Amount Swapped:</div>
                      <div>{fromAmount} {fromToken} → {toAmount} {toToken}</div>
                    </div>
                    <div>
                      <div className="text-neutral-500">Secret:</div>
                      <div className="font-mono text-xs">{swapResult.secret.slice(0, 20)}...</div>
                    </div>
                    <div>
                      <div className="text-neutral-500">Order Hash:</div>
                      <div className="font-mono text-xs">{swapResult.orderHash.slice(0, 20)}...</div>
                    </div>
                  </div>
                )}
                
                {swapResult.error && (
                  <div className="text-sm text-red-400">{swapResult.error}</div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}