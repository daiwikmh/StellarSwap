import { Address } from "@stellar/stellar-sdk";
import { initiate, claim } from "../components/crosschain/stellar";
import { cn } from "@/lib/utils";


const caller = "GBJDZIKRY6KI7U7FETQWBAKNOPRW6NJEAO6WM2MQ3OOGOWOYXZYHG6B3"; 
const receiver = "GCRFJ72PLMERENWP2AGIEZOSZKEU4CLS27PKGFFZUE3EKSYDP36EOJC3"; 

const XLM_TOKEN_ADDRESS = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

const amount = 1; 
const hashlock = "486ea46224d1bb4fb680f34f7c9ad96a8f24ec88be73ea8e5a6c65260e9cb8a7";
const timelock = 1761866616; 
const swapId = "02ab72941f6c17a465bb070d2e6816bdb7d55667e7522a4c9ae4ea48bd03e0a3";
const preimage="776f726c64"

async function testXLMTransfer() {
  console.log('🚀 Testing XLM HTLC Transfer...');
  
  try {
    console.log('⭐ Initiating XLM HTLC...');
    console.log('📜 Parameters:',caller,receiver,XLM_TOKEN_ADDRESS,amount,hashlock,timelock);

    
    const claimResult = await claim(receiver, swapId, preimage);
    
    if (claimResult === "HTLC initiated successfully") {
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
      console.error('❌ Failed to initiate:', claimResult);
    }
   
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testXLMTransfer();