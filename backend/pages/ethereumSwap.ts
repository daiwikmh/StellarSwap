import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { holesky } from 'viem/chains';
// Browser environment - using Vite env variables
import { ETHEREUM_HTLC_ABI } from '../config/abi';

// Environment variables
const RELAYER_PRIVATE_KEY = import.meta.env.VITE_ETHEREUM_RELAYER_PRIVATE_KEY!; // Resolver's key for initiate
const RECEIVER_PRIVATE_KEY = import.meta.env.VITE_ETH_RECEIVER_PRIVATE_KEY!; // User's key for claim
const CONTRACT_ADDRESS = import.meta.env.VITE_ETHEREUM_HTLC_ADDRESS!;
const RPC_URL = import.meta.env.VITE_ETHEREUM_RPC_URL || 'https://1rpc.io/holesky';

const receiverAddress = "0x9e1747D602cBF1b1700B56678F4d8395a9755235"; 
let amount = "0.1"; // 0.01 ETH equivalent to 1 XLM
const stellarDestination = "GCRFJ72PLMERENWP2AGIEZOSZKEU4CLS27PKGFFZUE3EKSYDP36EOJC3"; 
// These will be set dynamically from Stellar parameters
let hashlock = "";
let stellarSwapId = "";
let preimage = "";
let timelock = 0;
let ethereumSwapId = "";

async function initiateEthereumHTLC(
  stellarHashlock?: string,
  stellarSwapIdParam?: string,
  stellarPreimage?: string,
  ethAmount?: string
) {
  console.log('🚀 Step 2: Resolver initiating Ethereum HTLC...');
  console.log('ℹ️  This should be called AFTER Stellar HTLC is initiated');

  // Set parameters from Stellar if provided
  if (stellarHashlock) {
    hashlock = stellarHashlock.startsWith('0x') ? stellarHashlock : `0x${stellarHashlock}`;
  }
  if (stellarSwapIdParam) {
    stellarSwapId = stellarSwapIdParam;
  }
  if (stellarPreimage) {
    preimage = stellarPreimage;
  }
  if (ethAmount) {
    amount = ethAmount;
  }
  
  // Set timelock to 10 seconds later than current time for safety
  const currentTime = Math.floor(Date.now() / 1000);
  timelock = currentTime + 310; // 5 minutes 10 seconds from now

  if (!hashlock || !stellarSwapId || !preimage) {
    console.error('❌ Missing required Stellar parameters');
    return {
      success: false,
      message: 'Missing required Stellar parameters (hashlock, swapId, preimage)'
    };
  }
  
  const relayerAccount = privateKeyToAccount(RELAYER_PRIVATE_KEY as `0x${string}`);
  
  const publicClient = createPublicClient({
    chain: holesky,
    transport: http(RPC_URL),
  });

  const relayerWalletClient = createWalletClient({
    chain: holesky,
    transport: http(RPC_URL),
    account: relayerAccount,
  });

  try {
    console.log('📜 Ethereum Parameters:');
    console.log('  Resolver (sender):', relayerAccount.address);
    console.log('  Receiver:', receiverAddress);
    console.log('  Amount:', amount, 'ETH');
    console.log('  Hashlock:', hashlock);
    console.log('  Timelock:', timelock, '(' + new Date(timelock * 1000).toISOString() + ')');
    console.log('  Stellar Destination:', stellarDestination);
    console.log('  Stellar Swap ID:', stellarSwapId);

    // Check balances
    const relayerBalance = await publicClient.getBalance({ address: relayerAccount.address });
    const receiverBalance = await publicClient.getBalance({ address: receiverAddress as `0x${string}` });
    
    console.log('\n💰 Initial Balances:');
    console.log('  Resolver:', parseFloat((Number(relayerBalance) / 1e18).toFixed(6)), 'ETH');
    console.log('  Receiver:', parseFloat((Number(receiverBalance) / 1e18).toFixed(6)), 'ETH');

    // Prepare initiate parameters
    const initiateArgs: [
      `0x${string}`,
      `0x${string}`,
      bigint,
      `0x${string}`,
      bigint,
      string,
      string
    ] = [
      receiverAddress as `0x${string}`, // _receiver
      "0x0000000000000000000000000000000000000000" as `0x${string}`,
      parseEther(amount), // _amount
      hashlock as `0x${string}`, // _hashlock
      BigInt(timelock), // _timelock
      stellarDestination, 
      stellarSwapId 
    ];

    console.log('\n🔍 Simulating transaction...');
    
    // Simulate the initiate transaction
    const { request } = await publicClient.simulateContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: ETHEREUM_HTLC_ABI,
      functionName: 'initiate',
      args: initiateArgs,
      value: parseEther(amount), // Send ETH
      account: relayerAccount,
    });

    console.log('✅ Simulation successful, sending transaction...');

    // Send the transaction
    const hash = await relayerWalletClient.writeContract(request);
    console.log('📝 Transaction hash:', hash);

    // Wait for it to be mined
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('✅ Ethereum HTLC initiated successfully!');
    
    // Extract swap ID from logs
    if (receipt.logs && receipt.logs.length > 0) {
      const swapInitiatedLog = receipt.logs.find(log => 
        log.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase()
      );
      
      if (swapInitiatedLog && swapInitiatedLog.topics[1]) {
        ethereumSwapId = swapInitiatedLog.topics[1];
        console.log('🆔 Ethereum Swap ID:', ethereumSwapId);
      }
    }

    console.log('📜 Transaction receipt status:', receipt.status);
    console.log('⛽ Gas used:', receipt.gasUsed.toString());

    console.log('\n🎯 Next Steps:');
    console.log('1. ✅ Stellar HTLC initiated');
    console.log('2. ✅ Ethereum HTLC initiated (current)');
    console.log('3. 🔄 User can now claim on Ethereum');
    console.log('4. 🎯 User reveals preimage by claiming');
    console.log('5. 🔗 Resolver uses preimage to claim on Stellar');

    return {
      success: true,
      ethereumSwapId,
      txHash: hash,
      message: 'Ethereum HTLC initiated successfully'
    };

  } catch (error) {
    console.error('❌ Ethereum initiation failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function claimEthereumHTLC(stellarPreimage?: string) {
  console.log('\n🎯 Step 4: User claiming Ethereum HTLC...');
  console.log('ℹ️  This reveals the preimage for Stellar claim');

  // Set preimage from parameter if provided
  if (stellarPreimage) {
    preimage = stellarPreimage;
  }

  if (!preimage) {
    console.error('❌ No preimage available');
    return { success: false, message: 'No preimage available' };
  }

  const receiverAccount = privateKeyToAccount(RECEIVER_PRIVATE_KEY as `0x${string}`);
  const publicClient = createPublicClient({
    chain: holesky,
    transport: http(RPC_URL),
  });

  const receiverWalletClient = createWalletClient({
    chain: holesky,
    transport: http(RPC_URL),
    account: receiverAccount,
  });

  try {
    if (!ethereumSwapId) {
      console.error('❌ No Ethereum swap ID available. Run initiation first.');
      return { success: false, message: 'No swap ID available' };
    }

    console.log('📝 Claiming with:');
    console.log('  Swap ID:', ethereumSwapId);
    console.log('  Preimage:', preimage);
    console.log('  Claimer:', receiverAccount.address);

    // Simulate the claim - convert preimage from hex to string if needed
    const preimageForClaim = preimage.startsWith('0x') ? preimage.slice(2) : preimage;
    // Convert hex preimage to string using browser-compatible method
    const preimageBytes = new Uint8Array(preimageForClaim.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const preimageString = new TextDecoder().decode(preimageBytes);
    
    const { request } = await publicClient.simulateContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: ETHEREUM_HTLC_ABI,
      functionName: 'claim',
      args: [ethereumSwapId as `0x${string}`, preimageString],
      account: receiverAccount,
    });

    console.log('✅ Claim simulation successful, sending transaction...');

    // Send the transaction
    const hash = await receiverWalletClient.writeContract(request);
    console.log('📝 Claim transaction hash:', hash);

    // Wait for it to be mined
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('✅ Ethereum HTLC claimed successfully!', receipt.status ? '✅' : '❌');

    // Check final balances
    const receiverBalance = await publicClient.getBalance({ address: receiverAccount.address });
    console.log('\n💰 Final Receiver Balance:', parseFloat((Number(receiverBalance) / 1e18).toFixed(6)), 'ETH');

    console.log('\n🎉 User successfully claimed ETH!');
    console.log('🗝️  Preimage revealed:', preimage);
    console.log('🔗 Resolver can now use this preimage to claim XLM on Stellar');

    console.log('\n📋 For Stellar claim, use:');
    console.log('  Swap ID:', stellarSwapId);
    console.log('  Preimage:', preimage);
    console.log('  Claimer: Resolver address');

    return {
      success: true,
      txHash: hash,
      preimage: preimage,
      message: 'Ethereum HTLC claimed, preimage revealed'
    };

  } catch (error) {
    console.error('❌ Ethereum claim failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}



// Export functions for external use
export {
  initiateEthereumHTLC,
  claimEthereumHTLC,
  receiverAddress,
  amount,
  hashlock,
  timelock,
  stellarDestination,
  stellarSwapId,
  preimage
};

