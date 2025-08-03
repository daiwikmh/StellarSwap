import { initiate, claim } from "../components/crosschain/stellar";

// Cross-chain HTLC parameters - Step 1: Stellar Initiation
const caller = "GBJDZIKRY6KI7U7FETQWBAKNOPRW6NJEAO6WM2MQ3OOGOWOYXZYHG6B3"; // User (initiates on Stellar)
const receiver = "GCRFJ72PLMERENWP2AGIEZOSZKEU4CLS27PKGFFZUE3EKSYDP36EOJC3"; // Resolver (will claim on Stellar)

const XLM_TOKEN_ADDRESS = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const amount = 1; // 1 XLM

// Dynamic timelock based on current time
const currentTime = Math.floor(Date.now() / 1000);
const timelock = currentTime + 300; // 5 minutes from now

// Generate random preimage and its hash using browser-compatible crypto
async function generateHashlockAndPreimage() {
  // Generate a random readable string as the secret word
  const randomWords = ['stellar', 'ethereum', 'bridge', 'atomic', 'swap', 'htlc', 'cross', 'chain'];
  const randomWord1 = randomWords[Math.floor(Math.random() * randomWords.length)];
  const randomWord2 = randomWords[Math.floor(Math.random() * randomWords.length)];
  const randomNumber = Math.floor(Math.random() * 10000);
  const secretWord = `${randomWord1}_${randomWord2}_${randomNumber}`;
  
  // Convert the secret word to hex - this IS the preimage
  const encoder = new TextEncoder();
  const secretWordBytes = encoder.encode(secretWord);
  const preimage = Array.from(secretWordBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Create SHA256 hash of the preimage hex string using Web Crypto API
  const preimageBytes = new Uint8Array(preimage.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const hashBuffer = await crypto.subtle.digest('SHA-256', preimageBytes);
  const hashlock = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  console.log('🔑 Generated HTLC Secret:');
  console.log('  Secret Word:', secretWord);
  console.log('  Preimage (word as hex):', preimage);
  console.log('  Hashlock (SHA256 of preimage):', hashlock);
  
  return { preimage, hashlock, secretWord };
}

// Global variables for hashlock and preimage (will be set async)
let preimage: string = "";
let hashlock: string = "";

// Initialize hashlock and preimage
async function initializeHashlockAndPreimage() {
  const generated = await generateHashlockAndPreimage();
  preimage = generated.preimage;
  hashlock = generated.hashlock;
  return generated;
}

console.log('');

// Global variables to store transaction results
let stellarSwapHash: string = "";
let stellarSwapId: string = "";

async function initiateStellarHTLC() {
  console.log('🚀 Step 1: User initiating Stellar HTLC...');
  console.log('ℹ️  This locks XLM and waits for Ethereum side');
  
  // Initialize hashlock and preimage if not already done
  if (!hashlock || !preimage) {
    await initializeHashlockAndPreimage();
  }
  
  try {
    console.log('📜 Stellar Parameters:');
    console.log('  Caller (User):', caller);
    console.log('  Receiver (Resolver):', receiver);
    console.log('  Token:', XLM_TOKEN_ADDRESS);
    console.log('  Amount:', amount, 'XLM');
    console.log('  Hashlock:', hashlock);
    console.log('  Timelock:', timelock, '(' + new Date(timelock * 1000).toISOString() + ')');

    // Convert hashlock hex string to Buffer as expected by the stellar initiate function
    const hashlockBytes = Buffer.from(hashlock, 'hex');
    
    const initiateResult = await initiate(
      caller,
      receiver,
      XLM_TOKEN_ADDRESS,
      BigInt(amount),
      hashlockBytes,
      timelock
    );

    console.log('📝 Stellar Initiation Result:', initiateResult);

    // Check the new structure - the result comes directly from contractInt
    if (initiateResult && initiateResult.success && initiateResult.hash) {
      stellarSwapHash = initiateResult.hash;
      stellarSwapId = initiateResult.swapId || initiateResult.hash; // Use swapId from events, fallback to hash
      
      console.log('✅ Stellar HTLC initiated successfully!');
      console.log('  Status:', initiateResult.status);
      console.log('  Transaction Hash:', initiateResult.hash);
      console.log('  Latest Ledger:', initiateResult.latestLedger);
      console.log('  Latest Ledger Close Time:', initiateResult.latestLedgerCloseTime);
      console.log('');
      console.log('📋 HTLC Details:');
      console.log('  💰 Amount locked:', amount, 'XLM');
      console.log('  🆔 Swap ID (for claim):', stellarSwapId);
      console.log('  📋 Event-based Swap ID:', initiateResult.swapId || 'Not available');
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

    const claimResult = await claim(receiver, stellarSwapId, preimage);
    
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

// Export functions to get dynamic values
export const getHashlock = () => hashlock;
export const getPreimage = () => preimage;
export const getStellarSwapHash = () => stellarSwapHash;
export const getStellarSwapId = () => stellarSwapId;

// Export for frontend use
export {
  initiateStellarHTLC,
  claimStellarHTLC,
  initializeHashlockAndPreimage,
  generateHashlockAndPreimage,
  // Parameters
  caller,
  receiver,
  XLM_TOKEN_ADDRESS,
  amount,
  timelock
};

// Frontend-only functionality - CLI testing removed