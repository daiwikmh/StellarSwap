"use client"

import { useState } from "react"
import { Play, RefreshCw, CheckCircle, XCircle, ExternalLink, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface SwapStep {
  id: number
  title: string
  description: string
  status: "pending" | "in_progress" | "completed" | "failed"
  txHash?: string
  explorerUrl?: string
}

interface SwapParams {
  xlmAmount: number
  ethAmount: number
  stellarReceiver: string
  ethReceiver: string
}

export default function HTLCLimitOrderInterface() {
  const [steps, setSteps] = useState<SwapStep[]>([
    {
      id: 1,
      title: "Stellar HTLC Creation",
      description: "Creating HTLC on Stellar with secret hashlock",
      status: "pending"
    },
    {
      id: 2,
      title: "1inch Limit Order",
      description: "Creating limit order with HTLC predicate validation",
      status: "pending"
    },
    {
      id: 3,
      title: "Stellar HTLC Claim",
      description: "User claims XLM, revealing preimage",
      status: "pending"
    },
    {
      id: 4,
      title: "Limit Order Fill",
      description: "Fill 1inch order using revealed preimage",
      status: "pending"
    }
  ])

  const [swapParams, setSwapParams] = useState<SwapParams>({
    xlmAmount: 1000,
    ethAmount: 0.03,
    stellarReceiver: "GBJDZIKRY6KI...",
    ethReceiver: "0x9e1747D602..."
  })

  const [isExecuting, setIsExecuting] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [swapResult, setSwapResult] = useState<any>(null)
  const [orderHash, setOrderHash] = useState<string>("")
  const [secret, setSecret] = useState<string>("")

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

  const executeHTLCLimitOrderSwap = async () => {
    setIsExecuting(true)
    setCurrentStep(1)
    setSwapResult(null)
    setSteps(prev => prev.map(step => ({ ...step, status: "pending" })))

    try {
      // Dynamic import of the bridge
      const { HTLCLimitOrderBridge } = await import('../../../../limit-order-protocol/scripts/integrated-htlc-lop.js')
      const bridge = new HTLCLimitOrderBridge()

      console.log("🚀 Starting HTLC + 1inch LOP Cross-Chain Swap...")
      
      // Step 1: Stellar HTLC Creation
      updateStepStatus(1, "in_progress")
      setCurrentStep(1)
      
      const stellarResult = await bridge.createStellarHTLC(swapParams.xlmAmount, `secret-${Date.now()}`)
      updateStepStatus(1, "completed", stellarResult.stellarTxHash)
      setSecret(stellarResult.secret)
      
      // Step 2: 1inch Limit Order with HTLC Predicate
      updateStepStatus(2, "in_progress")
      setCurrentStep(2)
      
      const orderResult = await bridge.createLimitOrderWithHTLC(stellarResult, swapParams.ethAmount)
      updateStepStatus(2, "completed", orderResult.registrationTx)
      setOrderHash(orderResult.orderHash)

      // Step 3: Stellar HTLC Claim (reveals preimage)
      updateStepStatus(3, "in_progress")
      setCurrentStep(3)
      
      const claimResult = await bridge.claimStellarHTLC(stellarResult)
      updateStepStatus(3, "completed", claimResult.claimTxHash)

      // Step 4: Fill 1inch Limit Order with Preimage
      updateStepStatus(4, "in_progress")
      setCurrentStep(4)
      
      const fillResult = await bridge.fillLimitOrderWithPreimage(orderResult, claimResult.revealedSecret)
      updateStepStatus(4, "completed", fillResult.fillTxHash)

      setSwapResult({
        success: true,
        stellar: stellarResult,
        order: orderResult,
        claim: claimResult,
        fill: fillResult,
        summary: {
          xlmAmount: swapParams.xlmAmount,
          ethAmount: swapParams.ethAmount,
          secret: claimResult.revealedSecret,
          orderHash: orderResult.orderHash
        }
      })

      console.log("✅ HTLC + 1inch LOP swap completed successfully!")
      
    } catch (error) {
      console.error("❌ HTLC + LOP swap failed:", error)
      updateStepStatus(currentStep, "failed")
      setSwapResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      })
    } finally {
      setIsExecuting(false)
      setCurrentStep(0)
    }
  }

  const executeTestSwap = async () => {
    setIsExecuting(true)
    setCurrentStep(1)
    setSwapResult(null)
    setSteps(prev => prev.map(step => ({ ...step, status: "pending" })))

    try {
      console.log("🧪 Running Test HTLC + LOP Swap...")
      
      // Simulate each step with realistic delays
      for (let i = 1; i <= 4; i++) {
        updateStepStatus(i, "in_progress")
        setCurrentStep(i)
        await new Promise(resolve => setTimeout(resolve, 2500))
        
        const mockTxHash = `0x${Math.random().toString(16).substr(2, 64)}`
        updateStepStatus(i, "completed", mockTxHash)
      }

      setSwapResult({
        success: true,
        test: true,
        summary: {
          xlmAmount: swapParams.xlmAmount,
          ethAmount: swapParams.ethAmount,
          orderType: "1inch-limit-order-htlc",
          features: ["Atomic Safety", "Limit Order Benefits", "Cross-Chain"]
        }
      })

      console.log("✅ Test HTLC + LOP swap simulation completed!")
      
    } catch (error) {
      console.error("❌ Test swap failed:", error)
      updateStepStatus(currentStep, "failed")
    } finally {
      setIsExecuting(false)
      setCurrentStep(0)
    }
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

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <h1 className="text-3xl font-bold text-orange-500">crossinch+</h1>
            <Zap className="w-8 h-8 text-yellow-400" />
            <span className="text-2xl font-bold text-blue-400">1inch LOP</span>
          </div>
          <p className="text-neutral-400">HTLC + 1inch Limit Order Protocol Integration</p>
          <p className="text-sm text-neutral-500 mt-1">Atomic cross-chain swaps with advanced limit order features</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Swap Configuration */}
          <Card className="bg-neutral-900 border-neutral-700">
            <CardHeader>
              <CardTitle className="text-orange-500">Swap Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="xlmAmount">XLM Amount</Label>
                <Input
                  id="xlmAmount"
                  type="number"
                  value={swapParams.xlmAmount}
                  onChange={(e) => setSwapParams(prev => ({ ...prev, xlmAmount: parseFloat(e.target.value) }))}
                  className="bg-neutral-800 border-neutral-600"
                  disabled={isExecuting}
                />
              </div>
              
              <div>
                <Label htmlFor="ethAmount">ETH Amount</Label>
                <Input
                  id="ethAmount"
                  type="number"
                  step="0.001"
                  value={swapParams.ethAmount}
                  onChange={(e) => setSwapParams(prev => ({ ...prev, ethAmount: parseFloat(e.target.value) }))}
                  className="bg-neutral-800 border-neutral-600"
                  disabled={isExecuting}
                />
              </div>

              <div className="pt-4 space-y-3">
                <Button
                  onClick={executeHTLCLimitOrderSwap}
                  disabled={isExecuting}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-3"
                >
                  {isExecuting ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Executing Real Swap...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Execute HTLC + LOP Swap
                    </div>
                  )}
                </Button>

                <Button
                  onClick={executeTestSwap}
                  disabled={isExecuting}
                  variant="outline"
                  className="w-full border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-black"
                >
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    Test Simulation
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Step Progress */}
          <Card className="bg-neutral-900 border-neutral-700">
            <CardHeader>
              <CardTitle className="text-orange-500">Swap Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div 
                    key={step.id}
                    className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
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
                    
                    <div className="flex-1">
                      <div className="font-medium text-white">{step.title}</div>
                      <div className="text-sm text-neutral-400">{step.description}</div>
                      {step.txHash && (
                        <div className="text-xs text-orange-400 font-mono mt-1">
                          {step.txHash.slice(0, 20)}...
                        </div>
                      )}
                    </div>

                    {step.explorerUrl && step.status === "completed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(step.explorerUrl, '_blank')}
                        className="text-orange-500 hover:text-orange-400"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Results & Details */}
          <Card className="bg-neutral-900 border-neutral-700">
            <CardHeader>
              <CardTitle className="text-orange-500">Results</CardTitle>
            </CardHeader>
            <CardContent>
              {swapResult ? (
                <div className={`p-4 rounded-lg ${
                  swapResult.success 
                    ? "bg-green-900/20 border border-green-500/30" 
                    : "bg-red-900/20 border border-red-500/30"
                }`}>
                  <div className="font-bold mb-3">
                    {swapResult.success ? "✅ Swap Completed!" : "❌ Swap Failed"}
                  </div>
                  
                  {swapResult.success && swapResult.summary && (
                    <div className="space-y-2 text-sm text-neutral-300">
                      <div>Swapped: {swapResult.summary.xlmAmount} XLM → {swapResult.summary.ethAmount} ETH</div>
                      {swapResult.summary.orderHash && (
                        <div>Order: {swapResult.summary.orderHash.slice(0, 20)}...</div>
                      )}
                      {swapResult.summary.secret && (
                        <div>Secret: {swapResult.summary.secret.slice(0, 20)}...</div>
                      )}
                      {swapResult.test && (
                        <div className="text-blue-400 mt-2">🧪 Test Mode - No real funds moved</div>
                      )}
                    </div>
                  )}
                  
                  {swapResult.error && (
                    <div className="text-sm text-red-400">{swapResult.error}</div>
                  )}
                </div>
              ) : (
                <div className="text-neutral-500 text-center py-8">
                  Configure swap parameters and execute to see results
                </div>
              )}

              {/* Technical Details */}
              <div className="mt-6 space-y-4">
                <div>
                  <h4 className="font-bold text-white mb-2">🎯 Features</h4>
                  <div className="space-y-1 text-sm text-neutral-300">
                    <div>✅ Atomic cross-chain safety</div>
                    <div>✅ 1inch limit order benefits</div>
                    <div>✅ HTLC predicate validation</div>
                    <div>✅ Advanced order features</div>
                  </div>
                </div>

                {orderHash && (
                  <div>
                    <h4 className="font-bold text-white mb-2">📋 Order Hash</h4>
                    <div className="text-xs text-orange-400 font-mono bg-neutral-800 p-2 rounded">
                      {orderHash}
                    </div>
                  </div>
                )}

                {secret && (
                  <div>
                    <h4 className="font-bold text-white mb-2">🔑 Secret</h4>
                    <div className="text-xs text-green-400 font-mono bg-neutral-800 p-2 rounded">
                      {secret}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Technical Architecture */}
        <Card className="bg-neutral-900 border-neutral-700 mt-6">
          <CardHeader>
            <CardTitle className="text-orange-500">Technical Architecture</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-bold text-white mb-3">Integration Components</h4>
                <div className="space-y-2 text-neutral-300">
                  <div><span className="text-neutral-500">Stellar HTLC:</span> {import.meta.env.NEXT_PUBLIC_STELLAR_HTLC_ADDRESS?.slice(0, 20)}...</div>
                  <div><span className="text-neutral-500">1inch LOP:</span> {import.meta.env.NEXT_PUBLIC_LIMIT_ORDER_PROTOCOL?.slice(0, 20)}...</div>
                  <div><span className="text-neutral-500">HTLC Predicate:</span> Custom validation contract</div>
                  <div><span className="text-neutral-500">Network:</span> Stellar Testnet ↔ Holesky</div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-white mb-3">Enhanced Features</h4>
                <div className="space-y-2 text-neutral-300">
                  <div><span className="text-neutral-500">Limit Orders:</span> Better pricing control</div>
                  <div><span className="text-neutral-500">Partial Fills:</span> Flexible execution</div>
                  <div><span className="text-neutral-500">Gas Optimization:</span> Efficient predicates</div>
                  <div><span className="text-neutral-500">Security:</span> Atomic guarantees</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}