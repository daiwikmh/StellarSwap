require('dotenv').config();

// Simple test script to verify the live bridge integration
async function testLiveBridge() {
  console.log('🧪 Testing Live Bridge Integration...');
  
  try {
    const { LiveBridgeService } = await import('./services/liveBridgeService.js');
    const bridgeService = new LiveBridgeService();
    
    const testParams = {
      xlmAmount: 100,
      ethAmount: 0.001,
      direction: 'xlm-to-eth',
      userAddress: '0x9e1747D602cBF1b1700B56678F4d8395a9755235',
      stellarReceiver: 'GCRFJ72PLMERENWP2AGIEZOSZKEU4CLS27PKGFFZUE3EKSYDP36EOJC3'
    };
    
    console.log('🚀 Testing with parameters:', testParams);
    
    const result = await bridgeService.executeLiveBridge(testParams);
    
    if (result.success) {
      console.log('✅ Live bridge integration test PASSED!');
      console.log('📊 Result:', result);
    } else {
      console.log('❌ Live bridge integration test FAILED!');
      console.log('🔥 Error:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  }
}

// Run the test
testLiveBridge();