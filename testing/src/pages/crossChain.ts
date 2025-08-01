import { initiate as stellarInitiate, claim as stellarClaim } from "../components/crosschain/stellar";
import { initiateEthereumHTLC, claimEthereumHTLC } from "./ethereumSwap";
import 'dotenv/config';

// Cross-chain parameters
const caller = "GBJDZIKRY6KI7U7FETQWBAKNOPRW6NJEAO6WM2MQ3OOGOWOYXZYHG6B3"; // User (initiates on Stellar)
const stellarReceiver = "GCRFJ72PLMERENWP2AGIEZOSZKEU4CLS27PKGFFZUE3EKSYDP36EOJC3"; // Resolver getting XLM on stellar
const ethereumReceiver = "0x9e1747D602cBF1b1700B56678F4d8395a9755235"; // Ethereum address which will receive ETH

const XLM_TOKEN_ADDRESS = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const stellarAmount = 1; // 1 XLM
const ethereumAmount = "0.01"; // 0.01 ETH
const hashlock = "486ea46224d1bb4fb680f34f7c9ad96a8f24ec88be73ea8e5a6c65260e9cb8a7"; // SHA256("world")
// Dynamic timelocks based on current time
const currentTime = Math.floor(Date.now() / 1000);
const stellarTimelock = currentTime + 300; // 5 minutes from now
const ethereumTimelock = currentTime + 310; // 5 minutes 10 seconds from now (safety margin)
const swapId = "02ab72941f6c17a465bb070d2e6816bdb7d55667e7522a4c9ae4ea48bd03e0a3";
const preimage = "776f726c64"; // "world" in hex

interface StepResult {
  success: boolean;
  hash?: string;
  message: string;
  data?: any;
}

async function runCrossChainHTLC(): Promise<void> {
  console.log('🌟 Starting Complete Cross-Chain HTLC Workflow');
  console.log('📋 Flow: Stellar Initiate → Ethereum Initiate → Stellar Claim → Ethereum Claim');
  console.log('');
  
  try {
    // Step 1: Stellar Initiate
    console.log('🚀 Step 1: Initiating Stellar HTLC...');
    console.log('📜 Parameters:');
    console.log('  Caller (User):', caller);
    console.log('  Receiver (Resolver):', stellarReceiver);
    console.log('  Amount:', stellarAmount, 'XLM');
    console.log('  Hashlock:', hashlock);
    console.log('  Timelock:', stellarTimelock);

    const stellarInitiateResult = await stellarInitiate(
      caller,
      stellarReceiver,
      XLM_TOKEN_ADDRESS,
      BigInt(stellarAmount),
      Buffer.from(hashlock, "hex"),
      stellarTimelock
    );

    console.log('📝 Stellar Initiate Result:', stellarInitiateResult);

    // Check if stellar initiate was successful
    if (typeof stellarInitiateResult !== 'string' || stellarInitiateResult.startsWith('Error')) {
      console.error('❌ Stellar initiate failed:', stellarInitiateResult);
      return;
    }

    console.log('✅ Step 1 Completed: Stellar HTLC initiated successfully!');
    console.log('🆔 Stellar Swap ID:', swapId);
    console.log('');

    // Step 2: Ethereum Initiate
    console.log('🚀 Step 2: Initiating Ethereum HTLC...');
    console.log('📜 Parameters:');
    console.log('  Resolver (Relayer Account): Will initiate');
    console.log('  Receiver:', ethereumReceiver);
    console.log('  Amount:', ethereumAmount, 'ETH');
    console.log('  Hashlock:', hashlock);
    console.log('  Timelock:', ethereumTimelock);
    console.log('  Stellar Destination:', stellarReceiver);
    console.log('  Stellar Swap ID:', swapId);

    const ethereumInitiateResult = await initiateEthereumHTLC();

    if (!ethereumInitiateResult.success || !ethereumInitiateResult.txHash) {
      console.error('❌ Ethereum initiate failed:', ethereumInitiateResult.message);
      return;
    }

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
    console.log('  Swap ID:', swapId);
    console.log('  Preimage:', preimage);

    const stellarClaimResult = await stellarClaim(
      stellarReceiver,
      swapId,
      preimage
    );

    console.log('📝 Stellar Claim Result:', stellarClaimResult);

    if (!stellarClaimResult.success || !stellarClaimResult.hash) {
      console.error('❌ Stellar claim failed:', stellarClaimResult.message);
      return;
    }

    console.log('✅ Step 3 Completed: Stellar HTLC claimed successfully!');
    console.log('📝 Transaction Hash:', stellarClaimResult.hash);
    console.log('💰 Resolver received:', stellarAmount, 'XLM');
    console.log('');

    // Wait a moment before final step
    console.log('⏳ Waiting 3 seconds before Ethereum claim...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 4: Ethereum Claim
    console.log('🚀 Step 4: Claiming Ethereum HTLC...');
    console.log('📜 Parameters:');
    console.log('  Claimer (Receiver Wallet):', ethereumReceiver);
    console.log('  Swap ID: From Ethereum logs');
    console.log('  Preimage:', preimage);

    const ethereumClaimResult = await claimEthereumHTLC();

    if (!ethereumClaimResult.success || !ethereumClaimResult.txHash) {
      console.error('❌ Ethereum claim failed:', ethereumClaimResult.message);
      return;
    }

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
    console.log(`  • User: Sent ${stellarAmount} XLM → Received ${ethereumAmount} ETH`);
    console.log(`  • Resolver: Sent ${ethereumAmount} ETH → Received ${stellarAmount} XLM`);
    console.log('');
    console.log('🗝️  Preimage used:', preimage);
    console.log('🔒 Hashlock:', hashlock);

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
  console.log('  Token:', XLM_TOKEN_ADDRESS);
  console.log('  Amount:', stellarAmount, 'XLM');
  console.log('  Timelock:', stellarTimelock, '(' + new Date(stellarTimelock * 1000).toISOString() + ')');
  console.log('');
  console.log('🌉 Ethereum Side:');
  console.log('  Relayer (Resolver): From ETHEREUM_RELAYER_PRIVATE_KEY');
  console.log('  Receiver (User):', ethereumReceiver);
  console.log('  Amount:', ethereumAmount, 'ETH');
  console.log('  Timelock:', ethereumTimelock, '(' + new Date(ethereumTimelock * 1000).toISOString() + ')');
  console.log('');
  console.log('🔐 Shared Parameters:');
  console.log('  Hashlock:', hashlock);
  console.log('  Preimage:', preimage, '("world" in hex)');
  console.log('  Swap ID:', swapId);
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
  stellarAmount,
  ethereumAmount,
  hashlock,
  stellarTimelock,
  ethereumTimelock,
  swapId,
  preimage
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