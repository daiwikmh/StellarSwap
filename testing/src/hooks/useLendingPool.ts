import { useState, useEffect } from 'react'
import { ethers } from 'ethers'

const LENDING_POOL_ADDRESS = '0xd6093b63330A52f1601d9d62696E825AeB458fdA'

const LENDING_POOL_ABI = [
  'function totalValueLocked() view returns (uint256)',
  'function utilizationRate() view returns (uint256)',
  'function baseAPY() view returns (uint256)',
  'function balances(address) view returns (uint256)',
  'function lastUpdate(address) view returns (uint256)',
  'function calculateInterest(address user) view returns (uint256)',
  'function deposit() payable',
  'function withdraw(uint256 amount)',
  'function updateAPY(uint256 newAPY)',
  'event Deposited(address indexed user, uint256 amount)',
  'event Withdrawn(address indexed user, uint256 amount)'
]

interface PoolData {
  totalValueLocked: string
  utilizationRate: string
  baseAPY: string
  userBalance: string
  userInterest: string
}

export function useLendingPool() {
  const [poolData, setPoolData] = useState<PoolData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getProvider = () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      return new ethers.BrowserProvider(window.ethereum)
    }
    return null
  }

  const getContract = (signerOrProvider?: ethers.Signer | ethers.Provider) => {
    const provider = signerOrProvider || getProvider()
    if (!provider) throw new Error('No provider available')
    return new ethers.Contract(LENDING_POOL_ADDRESS, LENDING_POOL_ABI, provider)
  }

  const fetchPoolData = async (userAddress?: string) => {
    try {
      setLoading(true)
      setError(null)
      
      const provider = getProvider()
      if (!provider) throw new Error('No provider available')
      
      const contract = getContract(provider)
      
      const [tvl, utilization, apy] = await Promise.all([
        contract.totalValueLocked(),
        contract.utilizationRate(),
        contract.baseAPY()
      ])

      let userBalance = '0'
      let userInterest = '0'
      
      if (userAddress) {
        const [balance, interest] = await Promise.all([
          contract.balances(userAddress),
          contract.calculateInterest(userAddress)
        ])
        userBalance = ethers.formatEther(balance)
        userInterest = ethers.formatEther(interest)
      }

      setPoolData({
        totalValueLocked: ethers.formatEther(tvl),
        utilizationRate: utilization.toString(),
        baseAPY: (Number(apy) / 100).toString(), // Convert from basis points
        userBalance,
        userInterest
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pool data')
    } finally {
      setLoading(false)
    }
  }

  const deposit = async (amount: string) => {
    try {
      setLoading(true)
      setError(null)
      
      const provider = getProvider()
      if (!provider) throw new Error('No provider available')
      
      const signer = await provider.getSigner()
      const contract = getContract(signer)
      
      const value = ethers.parseEther(amount)
      const tx = await contract.deposit({ value })
      await tx.wait()
      
      // Refresh data after successful deposit
      const userAddress = await signer.getAddress()
      await fetchPoolData(userAddress)
      
      return tx
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deposit')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const withdraw = async (amount: string) => {
    try {
      setLoading(true)
      setError(null)
      
      const provider = getProvider()
      if (!provider) throw new Error('No provider available')
      
      const signer = await provider.getSigner()
      const contract = getContract(signer)
      
      const value = ethers.parseEther(amount)
      const tx = await contract.withdraw(value)
      await tx.wait()
      
      // Refresh data after successful withdrawal
      const userAddress = await signer.getAddress()
      await fetchPoolData(userAddress)
      
      return tx
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to withdraw')
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    poolData,
    loading,
    error,
    fetchPoolData,
    deposit,
    withdraw
  }
}