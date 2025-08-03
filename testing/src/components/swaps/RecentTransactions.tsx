"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ExternalLink } from "lucide-react"
import { useState, useEffect } from "react"

interface Transaction {
  type: string
  network: string
  hash: string
  explorerUrl: string
  time: string
  status: string
}

interface BridgeResult {
  stellar?: { stellarTxHash: string }
  predicate?: { txHash: string }
  stellarClaim?: { claimTxHash: string }
  ethClaim?: { txHash: string }
  timestamp?: number
}

// Store bridge results in localStorage or context
const getBridgeTransactions = (): Transaction[] => {
  console.log('🔍 getBridgeTransactions called')
  
  if (typeof window === 'undefined') {
    console.log('❌ Window is undefined in getBridgeTransactions')
    return []
  }
  
  const stored = localStorage.getItem('bridgeResults')
  console.log('📦 Raw stored data:', stored)
  
  if (!stored) {
    console.log('📦 No stored bridge results found')
    return []
  }
  
  try {
    const results: BridgeResult[] = JSON.parse(stored)
    console.log('📊 Parsed bridge results:', results)
    
    const transactions: Transaction[] = []
    
    results.forEach((result, index) => {
      console.log(`🔄 Processing result ${index}:`, result)
      
      const baseTime = result.timestamp || Date.now()
      
      if (result.stellar?.stellarTxHash) {
        const tx = {
          type: "Stellar Initiate",
          network: "Stellar Testnet", 
          hash: result.stellar.stellarTxHash,
          explorerUrl: `https://stellar.expert/explorer/testnet/search?term=${result.stellar.stellarTxHash}`,
          time: formatTime(baseTime),
          status: "completed"
        }
        console.log('⭐ Adding Stellar Initiate transaction:', tx)
        transactions.push(tx)
      }
      
      if (result.predicate?.txHash) {
        const tx = {
          type: "Ethereum Register",
          network: "Holesky Testnet",
          hash: result.predicate.txHash,
          explorerUrl: `https://holesky.etherscan.io/tx/${result.predicate.txHash}`,
          time: formatTime(baseTime + 30000), // 30 seconds later
          status: "completed"
        }
        console.log('⚡ Adding Ethereum Register transaction:', tx)
        transactions.push(tx)
      }
      
      if (result.stellarClaim?.claimTxHash) {
        const tx = {
          type: "Stellar Claim",
          network: "Stellar Testnet",
          hash: result.stellarClaim.claimTxHash,
          explorerUrl: `https://stellar.expert/explorer/testnet/search?term=${result.stellarClaim.claimTxHash}`,
          time: formatTime(baseTime + 60000), // 1 minute later
          status: "completed"
        }
        console.log('⭐ Adding Stellar Claim transaction:', tx)
        transactions.push(tx)
      }
      
      if (result.ethClaim?.txHash) {
        const tx = {
          type: "Ethereum Transfer",
          network: "Holesky Testnet",
          hash: result.ethClaim.txHash,
          explorerUrl: `https://holesky.etherscan.io/tx/${result.ethClaim.txHash}`,
          time: formatTime(baseTime + 90000), // 1.5 minutes later
          status: "completed"
        }
        console.log('⚡ Adding Ethereum Transfer transaction:', tx)
        transactions.push(tx)
      }
    })
    
    const sortedTransactions = transactions.sort((a, b) => b.time.localeCompare(a.time)).slice(0, 8)
    console.log('📋 Final sorted transactions:', sortedTransactions)
    
    return sortedTransactions // Most recent first, max 8
  } catch (error) {
    console.error('❌ Error parsing bridge results:', error)
    return []
  }
}

const formatTime = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  return new Date(timestamp).toLocaleDateString()
}

// Function to add new bridge result (called from swap execution)
export const addBridgeResult = (result: BridgeResult) => {
  console.log('🔄 addBridgeResult called with:', result)
  
  if (typeof window === 'undefined') {
    console.log('❌ Window is undefined, cannot store bridge result')
    return
  }
  
  const stored = localStorage.getItem('bridgeResults')
  const existing = stored ? JSON.parse(stored) : []
  
  console.log('📦 Existing bridge results:', existing)
  
  const newResult = {
    ...result,
    timestamp: result.timestamp || Date.now()
  }
  
  console.log('✨ New bridge result to store:', newResult)
  
  existing.unshift(newResult) // Add to beginning
  
  // Keep only last 10 bridge results
  const limited = existing.slice(0, 10)
  
  localStorage.setItem('bridgeResults', JSON.stringify(limited))
  console.log('💾 Stored bridge results in localStorage:', limited)
  
  // Trigger re-render for components listening to storage changes
  window.dispatchEvent(new Event('bridgeResultsUpdated'))
  console.log('📡 Triggered bridgeResultsUpdated event')
}

export default function RecentTransactions() {
  const [bridgeTransactions, setBridgeTransactions] = useState<Transaction[]>([])
  
  // Test function to manually add a bridge result for debugging
  const addTestBridgeResult = () => {
    console.log('🧪 Adding test bridge result')
    const testResult = {
      stellar: { stellarTxHash: 'aafe00bc650e5450b34f16d1a8765e1c63e97baf3ef9e694e063d8aad1c3251d' },
      predicate: { txHash: '0x550411ccc217b605ff5e6cfd42dd75d44887c3fb4a1bb03bcbc9d2915e6a6e5d' },
      stellarClaim: { claimTxHash: '050ed8f01f081966b8011f972c00e741c5010a45a1c43396ca647fe4b2e03010' },
      ethClaim: { txHash: '0xc34dc365c15512599d28f67a0eac88dc27300d8e8d4027adf46acb5cdd146e2f' },
      timestamp: Date.now()
    }
    addBridgeResult(testResult)
  }
  
  useEffect(() => {
    console.log('🚀 RecentTransactions useEffect mounting')
    
    // Load initial data
    const initialTransactions = getBridgeTransactions()
    console.log('📊 Initial transactions loaded:', initialTransactions)
    setBridgeTransactions(initialTransactions)
    
    // Listen for bridge results updates
    const handleUpdate = () => {
      console.log('📡 Received bridgeResultsUpdated event, reloading transactions')
      const updatedTransactions = getBridgeTransactions()
      console.log('📊 Updated transactions:', updatedTransactions)
      setBridgeTransactions(updatedTransactions)
    }
    
    window.addEventListener('bridgeResultsUpdated', handleUpdate)
    console.log('👂 Added event listener for bridgeResultsUpdated')
    
    // Also poll for updates every 30 seconds in case of external changes
    const interval = setInterval(() => {
      console.log('⏰ Polling for transaction updates (30s interval)')
      setBridgeTransactions(getBridgeTransactions())
    }, 30000)
    
    return () => {
      console.log('🧹 Cleaning up RecentTransactions component')
      window.removeEventListener('bridgeResultsUpdated', handleUpdate)
      clearInterval(interval)
    }
  }, [])
  
  const getNetworkIcon = (network: string) => {
    if (network.includes('Stellar')) {
      return '⭐'
    } else if (network.includes('Holesky')) {
      return '⚡'
    }
    return '🔗'
  }

  const getTypeColor = (type: string) => {
    if (type.includes('Initiate')) {
      return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
    } else if (type.includes('Register')) {
      return 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    } else if (type.includes('Claim')) {
      return 'bg-green-500/20 text-green-300 border-green-500/30'
    } else if (type.includes('Transfer')) {
      return 'bg-orange-500/20 text-orange-300 border-orange-500/30'
    }
    return 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30'
  }

  const truncateHash = (hash: string) => {
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`
  }

  return (
    <Card className="bg-neutral-900 border-neutral-700 mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
          🔍 RECENT CROSS-CHAIN TRANSACTIONS
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {bridgeTransactions.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              <div className="text-4xl mb-2">🌉</div>
              <p>No bridge transactions yet</p>
              <p className="text-sm">Execute a cross-chain swap to see transaction history</p>
            </div>
          ) : (
            bridgeTransactions.map((tx, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-neutral-800 rounded-lg border border-neutral-700 hover:border-neutral-600 transition-colors"
              >
              <div className="flex items-center gap-4">
                <div className="text-lg">{getNetworkIcon(tx.network)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-1 rounded border font-medium ${getTypeColor(tx.type)}`}>
                      {tx.type}
                    </span>
                    <span className="text-xs text-neutral-500">{tx.network}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-sm text-neutral-300 font-mono bg-neutral-900 px-2 py-1 rounded">
                      {truncateHash(tx.hash)}
                    </code>
                    <a
                      href={tx.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                      title="View in explorer"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">{tx.time}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="text-xs text-green-400 font-medium uppercase tracking-wider">
                  {tx.status}
                </div>
              </div>
              </div>
            ))
          )}
        </div>
        
        <div className="mt-4 p-3 bg-neutral-800/50 rounded border border-neutral-700 border-dashed">
          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-2">
            <span>💡</span>
            <span>
              {bridgeTransactions.length > 0 
                ? 'These are actual cross-chain transactions from CROSSINCH+ Bridge executions. Click the explorer icons to view on blockchain explorers.'
                : 'Bridge transaction history will appear here after executing cross-chain swaps. Each swap creates 4 transactions across both networks.'}
            </span>
          </div>
          <button 
            onClick={addTestBridgeResult}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
          >
            🧪 Add Test Transaction (Debug)
          </button>
        </div>
      </CardContent>
    </Card>
  )
}