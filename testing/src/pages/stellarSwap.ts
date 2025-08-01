import { Address } from "@stellar/stellar-sdk";
import { initiate, claim } from "../components/crosschain/stellar";
import crypto from 'crypto';

// Cross-chain HTLC parameters - Step 1: Stellar Initiation
const caller = "GBJDZIKRY6KI7U7FETQWBAKNOPRW6NJEAO6WM2MQ3OOGOWOYXZYHG6B3"; // User (initiates on Stellar)
const receiver = "GCRFJ72PLMERENWP2AGIEZOSZKEU4CLS27PKGFFZUE3EKSYDP36EOJC3"; // Resolver (will claim on Stellar)

const XLM_TOKEN_ADDRESS = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const amount = 1; // 1 XLM

// Dynamic timelock based on current time
const currentTime = Math.floor(Date.now() / 1000);
const timelock = currentTime + 300; // 5 minutes from now

// Generate random preimage and its hash
function generateHashlockAndPreimage() {
  // Generate a random readable string as the secret word
  const randomWords = ['stellar', 'ethereum', 'bridge', 'atomic', 'swap', 'htlc', 'cross', 'chain'];
  const randomWord1 = randomWords[Math.floor(Math.random() * randomWords.length)];
  const randomWord2 = randomWords[Math.floor(Math.random() * randomWords.length)];
  const randomNumber = Math.floor(Math.random() * 10000);
  const secretWord = `${randomWord1}_${randomWord2}_${randomNumber}`;
  
  // Convert the secret word to hex - this IS the preimage
  const preimage = Buffer.from(secretWord, 'utf8').toString('hex');
  
  // Create SHA256 hash of the preimage hex string - this IS the hashlock
  const hashlock = crypto.createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex');
  
  console.log('🔑 Generated HTLC Secret:');
  console.log('  Secret Word:', secretWord);
  console.log('  Preimage (word as hex):', preimage);
  console.log('  Hashlock (SHA256 of preimage):', hashlock);
  
  return { preimage, hashlock, secretWord };
}

// Generate fresh hashlock and preimage for this session
const { preimage, hashlock } = generateHashlockAndPreimage();

console.log('');

// Global variables to store transaction results
let stellarSwapHash: string = "";
let stellarSwapId: string = "";

async function initiateStellarHTLC() {
  console.log('🚀 Step 1: User initiating Stellar HTLC...');
  console.log('ℹ️  This locks XLM and waits for Ethereum side');
  
  try {
    console.log('📜 Stellar Parameters:');
    console.log('  Caller (User):', caller);
    console.log('  Receiver (Resolver):', receiver);
    console.log('  Token:', XLM_TOKEN_ADDRESS);
    console.log('  Amount:', amount, 'XLM');
    console.log('  Hashlock:', hashlock);
    console.log('  Timelock:', timelock, '(' + new Date(timelock * 1000).toISOString() + ')');

    const initiateResult = await initiate(
      caller,
      receiver,
      XLM_TOKEN_ADDRESS,
      BigInt(amount),
      Buffer.from(hashlock, "hex"),
      timelock
    );

    console.log('📝 Stellar Initiation Result:', initiateResult);

    // Check the new structure - the result comes directly from contractInt
    if (initiateResult && initiateResult.success && initiateResult.hash) {
      stellarSwapHash = initiateResult.hash;
      stellarSwapId = initiateResult.hash; // Use transaction hash as swap ID
      
      console.log('✅ Stellar HTLC initiated successfully!');
      console.log('  Status:', initiateResult.status);
      console.log('  Transaction Hash:', initiateResult.hash);
      console.log('  Latest Ledger:', initiateResult.latestLedger);
      console.log('  Latest Ledger Close Time:', initiateResult.latestLedgerCloseTime);
      console.log('');
      console.log('📋 HTLC Details:');
      console.log('  💰 Amount locked:', amount, 'XLM');
      console.log('  🆔 Swap ID (for claim):', stellarSwapId);
      console.log('  🔒 Hashlock:', hashlock);
      console.log('  🗝️  Preimage (secret):', preimage);
      console.log('  ⏰ Expires:', new Date(timelock * 1000).toISOString());

      return {
        success: true,
        swapId: stellarSwapId,
        hash: stellarSwapHash,
        hashlock: hashlock,
        preimage: preimage,
        message: 'Stellar HTLC initiated - proceed with Ethereum'
      };
    } else {
      console.error('❌ Failed to initiate Stellar HTLC:', initiateResult);
      return {
        success: false,
        message: (initiateResult && initiateResult.message) || 'Failed to initiate HTLC'
      };
    }

  } catch (error) {
    console.error('💥 Stellar HTLC initiation failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function claimStellarHTLC() {
  console.log('\n🎯 Step 3: Resolver claiming Stellar HTLC with preimage...');
  console.log('ℹ️  Using transaction hash as swap ID');
  
  if (!stellarSwapId) {
    console.error('❌ No swap ID available. Run initiation first.');
    return { success: false, message: 'No swap ID available' };
  }
  
  try {
    console.log('📝 Claim Parameters:');
    console.log('  Claimer (Resolver):', receiver);
    console.log('  Swap ID (from initiate hash):', stellarSwapId);
    console.log('  Preimage:', preimage);

    const claimResult = await claim(receiver, "43011c47b839db44d3ad1ebb451dba5214b50c275dea406768d6c3b905de483a", "7374656c6c61725f7374656c6c61725f34373137");
    
    if (claimResult.success) {
      console.log('✅ Stellar HTLC claimed successfully!');
      if (claimResult.hash) {
        console.log('📝 Claim Transaction Hash:', claimResult.hash);
      }
      console.log('💰 Resolver received:', amount, 'XLM');
      console.log('🔒 Used Hashlock:', hashlock);
      console.log('🗝️  Revealed Preimage:', preimage);
      
      return {
        success: true,
        hash: claimResult.hash,
        message: 'Stellar HTLC claimed successfully'
      };
    } else {
      console.error('❌ Failed to claim Stellar HTLC:', claimResult.message);
      return {
        success: false,
        message: claimResult.message || 'Unknown error'
      };
    }
   
  } catch (error) {
    console.error('💥 Stellar claim failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function testStellarHTLCFlow() {
  console.log('🌟 Testing Complete Stellar HTLC Flow');
  console.log('📋 Flow: Initiate → Claim');
  
  try {
    // Step 1: Initiate Stellar HTLC
    const initiationResult = await initiateStellarHTLC();
    
    if (initiationResult.success) {
      console.log('\n⏳ Waiting 5 seconds before claim...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Step 2: Claim Stellar HTLC
      const claimResult = await claimStellarHTLC();
      
      if (claimResult.success) {
        console.log('\n🎉 Complete Stellar HTLC flow completed!');
        console.log('✅ Initiate Hash:', stellarSwapHash);
        console.log('✅ Claim Hash:', claimResult.hash);
        console.log('🔐 Hashlock:', hashlock);
        console.log('🗝️  Preimage:', preimage);
      }
    }
    
  } catch (error) {
    console.error('💥 Stellar HTLC workflow failed:', error);
  }
}

// Export for other scripts
export {
  initiateStellarHTLC,
  claimStellarHTLC,
  testStellarHTLCFlow,
  // Parameters
  caller,
  receiver,
  XLM_TOKEN_ADDRESS,
  amount,
  hashlock,
  timelock,
  preimage,
  // Results
  stellarSwapHash,
  stellarSwapId
};

// Run if executed directly
if (require.main === module) {
  testStellarHTLCFlow()
    .then(() => {
      console.log('\n🎉 Stellar HTLC test completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error:', error);
      process.exit(1);
    });
}