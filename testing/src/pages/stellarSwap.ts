import { initiate, claim, refund } from "../components/crosschain/stellar";
import { Asset } from "@stellar/stellar-sdk";


const caller = "GBJDZIKRY6KI7U7FETQWBAKNOPRW6NJEAO6WM2MQ3OOGOWOYXZYHG6B3"; 
const receiver = "GCRFJ72PLMERENWP2AGIEZOSZKEU4CLS27PKGFFZUE3EKSYDP36EOJC3"; 

const XLM_TOKEN_ADDRESS = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHGKPMBWB';

const amount = 100n; 
const hashlock = "a948904f2f0f479b8f8197694b30184b0d2ed1c1cd2a1ec0fb85d299a192a447";
const timelock = Math.floor(Date.now() / 1000) + 3600; 


async function testXLMTransfer() {
  console.log('🚀 Testing XLM HTLC Transfer...');
  
  try {
    console.log('⭐ Initiating XLM HTLC...');
    const initiateResult = await initiate(
      caller,
      receiver, 
      XLM_TOKEN_ADDRESS, // Native XLM
      amount,
      hashlock,
      timelock
    );
    
    console.log('✅ Initiate result:', initiateResult);
    
    if (initiateResult === "HTLC initiated successfully") {
      console.log('🎉 XLM HTLC created successfully!');
      console.log('💰 Amount locked:XLM');
      console.log('🔒 Hashlock:', hashlock);
      console.log('⏰ Expires:', new Date(timelock * 1000).toISOString());
     
      console.log('\n⏳ Waiting 3 seconds before claim test...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const swapId = hashlock; 
      const preimage = "secret"; 
      
      console.log('🔓 Testing claim...');
      const claimResult = await claim(receiver, swapId, preimage);
      console.log('✅ Claim result:', claimResult);
     
    } else {
      console.error('❌ Failed to initiate:', initiateResult);
    }
   
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testXLMTransfer();