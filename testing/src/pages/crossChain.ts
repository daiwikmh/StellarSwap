import { initiateStellarHTLC, claimStellarHTLC } from "./stellarSwap";
import { initiateEthereumHTLC, claimEthereumHTLC } from "./ethereumSwap";
import 'dotenv/config';

// Cross-chain parameters
const caller = "GBJDZIKRY6KI7U7FETQWBAKNOPRW6NJEAO6WM2MQ3OOGOWOYXZYHG6B3"; // User (initiates on Stellar)
const stellarReceiver = "GCRFJ72PLMERENWP2AGIEZOSZKEU4CLS27PKGFFZUE3EKSYDP36EOJC3"; // Resolver getting XLM on stellar
const ethereumReceiver = "0x9e1747D602cBF1b1700B56678F4d8395a9755235"; // Ethereum address which will receive ETH

const ethereumAmount = "0.1"; // 0.01 ETH
// Dynamic timelocks based on current time
const currentTime = Math.floor(Date.now() / 1000);
const ethereumTimelock = currentTime + 310; // 5 minutes 10 seconds from now (safety margin)

// These will be dynamically set from stellarSwap.ts
let stellarSwapId: string | undefined = "";
let stellarHashlock: string | undefined = "";
let stellarPreimage: string | undefined = "";

// Transaction hashes for final summary
let stellarInitiateHash = "";
let stellarClaimHash = "";
let ethereumInitiateHash = "";
let ethereumClaimHash = "";

// interface StepResult {
//   success: boolean;
//   hash?: string;
//   message: string;
//   data?: any;
// }

async function runCrossChainHTLC(): Promise<void> {
  console.log('🌟 Starting Complete Cross-Chain HTLC Workflow');
  console.log('📋 Flow: Stellar Initiate → Ethereum Initiate → Stellar Claim → Ethereum Claim');
  console.log('');
  
  try {
    // Step 1: Stellar Initiate
    console.log('🚀 Step 1: Initiating Stellar HTLC...');
    
    const stellarInitiateResult = await initiateStellarHTLC();

    console.log('📝 Stellar Initiate Result:', stellarInitiateResult);

    // Check if stellar initiate was successful
    if (!stellarInitiateResult.success) {
      console.error('❌ Stellar initiate failed:', stellarInitiateResult.message);
      return;
    }

    // Extract values from stellarSwap.ts result
    stellarSwapId = stellarInitiateResult.swapId;
    stellarHashlock = stellarInitiateResult.hashlock;
    stellarPreimage = stellarInitiateResult.preimage;
    stellarInitiateHash = stellarInitiateResult.hash ?? "";

    console.log('✅ Step 1 Completed: Stellar HTLC initiated successfully!');
    console.log('🆔 Stellar Swap ID:', stellarSwapId);
    console.log('🔒 Hashlock:', stellarHashlock);
    console.log('');

    // Step 2: Ethereum Initiate
    console.log('🚀 Step 2: Initiating Ethereum HTLC...');
    console.log('📜 Parameters:');
    console.log('  Resolver (Relayer Account): Will initiate');
    console.log('  Receiver:', ethereumReceiver);
    console.log('  Amount:', ethereumAmount, 'ETH');
    console.log('  Hashlock:', stellarHashlock);
    console.log('  Timelock:', ethereumTimelock);
    console.log('  Stellar Destination:', stellarReceiver);
    console.log('  Stellar Swap ID:', stellarSwapId);

    const ethereumInitiateResult = await initiateEthereumHTLC();

    if (!ethereumInitiateResult.success || !ethereumInitiateResult.txHash) {
      console.error('❌ Ethereum initiate failed:', ethereumInitiateResult.message);
      return;
    }

    ethereumInitiateHash = ethereumInitiateResult.txHash;

    console.log('✅ Step 2 Completed: Ethereum HTLC initiated successfully!');
    console.log('📝 Transaction Hash:', ethereumInitiateResult.txHash);
    console.log('🆔 Ethereum Swap ID:', ethereumInitiateResult.ethereumSwapId || 'Generated from logs');
    console.log('');

    // Wait a moment between steps
    console.log('⏳ Waiting 3 seconds before claims...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 3: Stellar Claim
    console.log('🚀 Step 3: Claiming Stellar HTLC...');
    console.log('📜 Parameters:');
    console.log('  Claimer (Resolver):', stellarReceiver);
    console.log('  Swap ID:', stellarSwapId);
    console.log('  Preimage:', stellarPreimage);

    const stellarClaimResult = await claimStellarHTLC();

    console.log('📝 Stellar Claim Result:', stellarClaimResult);

    if (!stellarClaimResult.success || !stellarClaimResult.hash) {
      console.error('❌ Stellar claim failed:', stellarClaimResult.message);
      return;
    }

    stellarClaimHash = stellarClaimResult.hash;

    console.log('✅ Step 3 Completed: Stellar HTLC claimed successfully!');
    console.log('📝 Transaction Hash:', stellarClaimResult.hash);
    console.log('💰 Resolver received: 1 XLM');
    console.log('');

    // Wait a moment before final step
    console.log('⏳ Waiting 3 seconds before Ethereum claim...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 4: Ethereum Claim
    console.log('🚀 Step 4: Claiming Ethereum HTLC...');
    console.log('📜 Parameters:');
    console.log('  Claimer (Receiver Wallet):', ethereumReceiver);
    console.log('  Swap ID: From Ethereum logs');
    console.log('  Preimage:', stellarPreimage);

    const ethereumClaimResult = await claimEthereumHTLC();

    if (!ethereumClaimResult.success || !ethereumClaimResult.txHash) {
      console.error('❌ Ethereum claim failed:', ethereumClaimResult.message);
      return;
    }

    ethereumClaimHash = ethereumClaimResult.txHash;

    console.log('✅ Step 4 Completed: Ethereum HTLC claimed successfully!');
    console.log('📝 Transaction Hash:', ethereumClaimResult.txHash);
    console.log('💰 User received:', ethereumAmount, 'ETH');
    console.log('');

    // Success Summary
    console.log('🎉 CROSS-CHAIN HTLC COMPLETED SUCCESSFULLY!');
    console.log('');
    console.log('📊 Final Summary:');
    console.log('✅ Step 1: Stellar HTLC initiated');
    console.log('✅ Step 2: Ethereum HTLC initiated');
    console.log('✅ Step 3: Stellar HTLC claimed (Resolver got XLM)');
    console.log('✅ Step 4: Ethereum HTLC claimed (User got ETH)');
    console.log('');
    console.log('🔄 Cross-chain swap completed:');
    console.log(`  • User: Sent 1 XLM → Received ${ethereumAmount} ETH`);
    console.log(`  • Resolver: Sent ${ethereumAmount} ETH → Received 1 XLM`);
    console.log('');
    console.log('🗝️  Preimage used:', stellarPreimage);
    console.log('🔒 Hashlock:', stellarHashlock);
    console.log('');
    
    // Transaction Explorer Links
    console.log('🔍 TRANSACTION EXPLORER LINKS:');
    console.log('');
    console.log('📊 Stellar Transactions (Testnet):');
    console.log(`  🚀 Stellar Initiate: https://stellar.expert/explorer/testnet/search?term=${stellarInitiateHash}`);
    console.log(`  🎯 Stellar Claim: https://stellar.expert/explorer/testnet/search?term=${stellarClaimHash}`);
    console.log('');
    console.log('📊 Ethereum Transactions (Holesky Testnet):');
    console.log(`  🚀 Ethereum Initiate: https://holesky.etherscan.io/tx/${ethereumInitiateHash}`);
    console.log(`  🎯 Ethereum Claim: https://holesky.etherscan.io/tx/${ethereumClaimHash}`);
    console.log('');
    console.log('📋 Transaction Summary:');
    console.log('  Stellar Initiate Hash:', stellarInitiateHash);
    console.log('  Stellar Claim Hash:', stellarClaimHash);
    console.log('  Ethereum Initiate Hash:', ethereumInitiateHash);
    console.log('  Ethereum Claim Hash:', ethereumClaimHash);

  } catch (error) {
    console.error('💥 Cross-chain HTLC workflow failed:', error);
    console.log('');
    console.log('🛠️  Troubleshooting tips:');
    console.log('1. Check environment variables are set correctly');
    console.log('2. Ensure accounts have sufficient balances');
    console.log('3. Verify contract addresses are correct');
    console.log('4. Check network connectivity');
    console.log('5. Ensure timelocks haven\'t expired');
  }
}

// Helper function to display current parameters
function displayParameters() {
  console.log('📋 Cross-Chain HTLC Parameters:');
  console.log('');
  console.log('🌟 Stellar Side:');
  console.log('  Caller (User):', caller);
  console.log('  Receiver (Resolver):', stellarReceiver);
  console.log('  Amount: 1 XLM');
  console.log('  Timelock: Dynamic (5 minutes from initiation)');
  console.log('');
  console.log('🌉 Ethereum Side:');
  console.log('  Relayer (Resolver): From ETHEREUM_RELAYER_PRIVATE_KEY');
  console.log('  Receiver (User):', ethereumReceiver);
  console.log('  Amount:', ethereumAmount, 'ETH');
  console.log('  Timelock:', ethereumTimelock, '(' + new Date(ethereumTimelock * 1000).toISOString() + ')');
  console.log('');
  console.log('🔐 Shared Parameters:');
  console.log('  Hashlock: Generated dynamically from stellarSwap.ts');
  console.log('  Preimage: Generated dynamically from stellarSwap.ts');
  console.log('  Swap ID: Extracted from Stellar events');
  console.log('');
}

// Export for external use
export {
  runCrossChainHTLC,
  displayParameters,
  // Parameters
  caller,
  stellarReceiver,
  ethereumReceiver,
  ethereumAmount,
  ethereumTimelock,
  // Dynamic values (set during execution)
  stellarSwapId,
  stellarHashlock,
  stellarPreimage
};

// Run if executed directly
if (require.main === module) {
  console.log('🚀 Cross-Chain HTLC Orchestrator');
  console.log('==============================');
  console.log('');
  
  displayParameters();
  console.log('⚠️  Make sure all environment variables are set!');
  console.log('⚠️  Make sure accounts have sufficient balances!');
  console.log('⚠️  Make sure contracts are deployed and addresses are correct!');
  console.log('');
  console.log('🔄 Starting in 3 seconds...');
  
  setTimeout(() => {
    runCrossChainHTLC()
      .then(() => {
        console.log('');
        console.log('🎉 Cross-chain workflow execution completed!');
        process.exit(0);
      })
      .catch(error => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
      });
  }, 3000);
}