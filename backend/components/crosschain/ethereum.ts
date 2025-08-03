import { 
  publicClient, 
  relayerWalletClient, 
  receiverWalletClient, 
  ETHEREUM_HTLC_ADDRESS, 
  ETHEREUM_HTLC_ABI,
  ethereumHTLCContract,
  relayerAccount,
  receiverAccount
} from '../../config/ethereum';
import { parseEther, formatEther} from 'viem';

// Types for swap data
export interface SwapData {
  sender: string;
  receiver: string;
  tokenAddress: string;
  amount: bigint;
  hashlock: string;
  timelock: bigint;
  claimed: boolean;
  stellarDestination: string;
  stellarSwapId: string;
}

export interface InitiateParams {
  receiverAddress: string;
  tokenAddress: string; // 0x0000000000000000000000000000000000000000 for ETH
  amount: string; // in ETH units (e.g., "0.1")
  hashlock: string; // 32-byte hex string
  timelock: number; // Unix timestamp
  stellarDestination: string;
  stellarSwapId: string;
}

// VIEW FUNCTIONS

/**
 * Get swap details by swap ID
 */
export async function getSwap(swapId: string): Promise<SwapData | null> {
  try {
    const swapIdHex = swapId.startsWith('0x') ? swapId : `0x${swapId}`;
    const swapIdBytes = swapIdHex as `0x${string}`;
    
    const swap = await ethereumHTLCContract.read.getSwap([swapIdBytes]);
    
    return {
      sender: swap.sender,
      receiver: swap.receiver,
      tokenAddress: swap.tokenAddress,
      amount: swap.amount,
      hashlock: swap.hashlock,
      timelock: swap.timelock,
      claimed: swap.claimed,
      stellarDestination: swap.stellarDestination,
      stellarSwapId: swap.stellarSwapId,
    };
  } catch (error) {
    console.error('Error fetching swap:', error);
    return null;
  }
}

/**
 * Verify if a preimage is valid for a swap
 */
export async function verifyPreimage(swapId: string, preimage: string): Promise<boolean> {
  try {
    const swapIdHex = swapId.startsWith('0x') ? swapId : `0x${swapId}`;
    const swapIdBytes = swapIdHex as `0x${string}`;
    
    const isValid = await ethereumHTLCContract.read.verifyPreimage([swapIdBytes, preimage]);
    
    return isValid;
  } catch (error) {
    console.error('Error verifying preimage:', error);
    return false;
  }
}

/**
 * Check if a swap exists
 */
export async function swapExists(swapId: string): Promise<boolean> {
  const swap = await getSwap(swapId);
  return swap !== null && swap.sender !== '0x0000000000000000000000000000000000000000';
}

/**
 * Check if a swap has expired
 */
export async function isSwapExpired(swapId: string): Promise<boolean> {
  const swap = await getSwap(swapId);
  if (!swap) return false;
  
  const currentTime = Math.floor(Date.now() / 1000);
  return currentTime >= Number(swap.timelock);
}

// TRANSACTION FUNCTIONS (using private keys)

/**
 * Initiate HTLC on Ethereum (called by resolver)
 */
export async function initiateHTLC(params: InitiateParams): Promise<{
  success: boolean;
  swapId?: string;
  txHash?: string;
  message: string;
}> {
  try {
    const {
      receiverAddress,
      tokenAddress,
      amount,
      hashlock,
      timelock,
      stellarDestination,
      stellarSwapId
    } = params;

    // Convert parameters
    const receiverAddr = receiverAddress as `0x${string}`;
    const tokenAddr = tokenAddress as `0x${string}`;
    const amountWei = parseEther(amount);
    const hashlockHex = hashlock.startsWith('0x') ? hashlock : `0x${hashlock}`;
    const hashlockBytes = hashlockHex as `0x${string}`;
    const timelockBigInt = BigInt(timelock);

    console.log('Initiating HTLC with params:', {
      receiver: receiverAddr,
      tokenAddress: tokenAddr,
      amount: amountWei.toString(),
      hashlock: hashlockHex,
      timelock,
      stellarDestination,
      stellarSwapId
    });

    // Estimate gas
    const gasEstimate = await publicClient.estimateContractGas({
      address: ETHEREUM_HTLC_ADDRESS as `0x${string}`,
      abi: ETHEREUM_HTLC_ABI,
      functionName: 'initiate',
      args: [
        receiverAddr,
        tokenAddr,
        amountWei,
        hashlockBytes,
        timelockBigInt,
        stellarDestination,
        stellarSwapId
      ],
      value: tokenAddr === '0x0000000000000000000000000000000000000000' ? amountWei : 0n,
      account: relayerAccount,
    });

    // Execute transaction
    const txHash = await relayerWalletClient.writeContract({
      address: ETHEREUM_HTLC_ADDRESS as `0x${string}`,
      abi: ETHEREUM_HTLC_ABI,
      functionName: 'initiate',
      args: [
        receiverAddr,
        tokenAddr,
        amountWei,
        hashlockBytes,
        timelockBigInt,
        stellarDestination,
        stellarSwapId
      ],
      value: tokenAddr === '0x0000000000000000000000000000000000000000' ? amountWei : 0n,
      gas: gasEstimate + (gasEstimate / 10n), // Add 10% buffer
    });

    console.log('Transaction submitted:', txHash);

    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 60000, // 60 seconds
    });

    if (receipt.status === 'success') {
      // Extract swap ID from logs
      const swapInitiatedLog = receipt.logs.find(log => 
        log.address.toLowerCase() === (ETHEREUM_HTLC_ADDRESS as string).toLowerCase()
      );
      
      let swapId = '';
      if (swapInitiatedLog && swapInitiatedLog.topics[1]) {
        swapId = swapInitiatedLog.topics[1];
      }

      return {
        success: true,
        swapId,
        txHash,
        message: 'HTLC initiated successfully'
      };
    } else {
      return {
        success: false,
        message: 'Transaction failed'
      };
    }

  } catch (error: any) {
    console.error('Error initiating HTLC:', error);
    return {
      success: false,
      message: error.message || 'Unknown error occurred'
    };
  }
}

/**
 * Claim HTLC tokens (called by receiver)
 */
export async function claimHTLC(swapId: string, preimage: string): Promise<{
  success: boolean;
  txHash?: string;
  message: string;
}> {
  try {
    const swapIdHex = swapId.startsWith('0x') ? swapId : `0x${swapId}`;
    const swapIdBytes = swapIdHex as `0x${string}`;

    console.log('Claiming HTLC:', { swapId: swapIdHex, preimage });

    // Verify the swap exists and preimage is valid
    const swap = await getSwap(swapId);
    if (!swap) {
      return {
        success: false,
        message: 'Swap not found'
      };
    }

    if (swap.claimed) {
      return {
        success: false,
        message: 'Swap already claimed'
      };
    }

    const isExpired = await isSwapExpired(swapId);
    if (isExpired) {
      return {
        success: false,
        message: 'Swap has expired'
      };
    }

    const isValidPreimage = await verifyPreimage(swapId, preimage);
    if (!isValidPreimage) {
      return {
        success: false,
        message: 'Invalid preimage'
      };
    }

    // Estimate gas
    const gasEstimate = await publicClient.estimateContractGas({
      address: ETHEREUM_HTLC_ADDRESS as `0x${string}`,
      abi: ETHEREUM_HTLC_ABI,
      functionName: 'claim',
      args: [swapIdBytes, preimage],
      account: receiverAccount,
    });

    // Execute transaction
    const txHash = await receiverWalletClient.writeContract({
      address: ETHEREUM_HTLC_ADDRESS as `0x${string}`,
      abi: ETHEREUM_HTLC_ABI,
      functionName: 'claim',
      args: [swapIdBytes, preimage],
      gas: gasEstimate + (gasEstimate / 10n), // Add 10% buffer
    });

    console.log('Claim transaction submitted:', txHash);

    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 60000, // 60 seconds
    });

    if (receipt.status === 'success') {
      return {
        success: true,
        txHash,
        message: 'HTLC claimed successfully'
      };
    } else {
      return {
        success: false,
        message: 'Claim transaction failed'
      };
    }

  } catch (error: any) {
    console.error('Error claiming HTLC:', error);
    return {
      success: false,
      message: error.message || 'Unknown error occurred'
    };
  }
}

/**
 * Refund HTLC after timeout (called by resolver)
 */
export async function refundHTLC(swapId: string): Promise<{
  success: boolean;
  txHash?: string;
  message: string;
}> {
  try {
    const swapIdHex = swapId.startsWith('0x') ? swapId : `0x${swapId}`;
    const swapIdBytes = swapIdHex as `0x${string}`;

    console.log('Refunding HTLC:', { swapId: swapIdHex });

    // Verify the swap exists
    const swap = await getSwap(swapId);
    if (!swap) {
      return {
        success: false,
        message: 'Swap not found'
      };
    }

    if (swap.claimed) {
      return {
        success: false,
        message: 'Swap already claimed'
      };
    }

    const isExpired = await isSwapExpired(swapId);
    if (!isExpired) {
      return {
        success: false,
        message: 'Swap has not expired yet'
      };
    }

    // Estimate gas
    const gasEstimate = await publicClient.estimateContractGas({
      address: ETHEREUM_HTLC_ADDRESS as `0x${string}`,
      abi: ETHEREUM_HTLC_ABI,
      functionName: 'refund',
      args: [swapIdBytes],
      account: relayerAccount,
    });

    // Execute transaction
    const txHash = await relayerWalletClient.writeContract({
      address: ETHEREUM_HTLC_ADDRESS as `0x${string}`,
      abi: ETHEREUM_HTLC_ABI,
      functionName: 'refund',
      args: [swapIdBytes],
      gas: gasEstimate + (gasEstimate / 10n), // Add 10% buffer
    });

    console.log('Refund transaction submitted:', txHash);

    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 60000, // 60 seconds
    });

    if (receipt.status === 'success') {
      return {
        success: true,
        txHash,
        message: 'HTLC refunded successfully'
      };
    } else {
      return {
        success: false,
        message: 'Refund transaction failed'
      };
    }

  } catch (error: any) {
    console.error('Error refunding HTLC:', error);
    return {
      success: false,
      message: error.message || 'Unknown error occurred'
    };
  }
}

// UTILITY FUNCTIONS

/**
 * Get account balances
 */
export async function getAccountBalances(): Promise<{
  relayer: string;
  receiver: string;
}> {
  try {
    const [relayerBalance, receiverBalance] = await Promise.all([
      publicClient.getBalance({ address: relayerAccount.address }),
      publicClient.getBalance({ address: receiverAccount.address }),
    ]);

    return {
      relayer: formatEther(relayerBalance),
      receiver: formatEther(receiverBalance),
    };
  } catch (error) {
    console.error('Error getting balances:', error);
    return {
      relayer: '0',
      receiver: '0',
    };
  }
}

/**
 * Format swap data for display
 */
export function formatSwapData(swap: SwapData) {
  return {
    ...swap,
    amount: formatEther(swap.amount),
    timelock: new Date(Number(swap.timelock) * 1000).toISOString(),
    isExpired: Math.floor(Date.now() / 1000) >= Number(swap.timelock),
  };
}