const { ethers } = require('hardhat');
require('dotenv').config();

/**
 * Deploy HTLC + 1inch LOP Integration
 * This script deploys the HTLCPredicate contract and sets up the integration
 */

async function main() {
    console.log("🚀 Deploying HTLC + 1inch LOP Integration...");
    
    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

    // Deploy HTLCPredicate contract
    console.log("\n📋 Deploying HTLCPredicate...");
    const HTLCPredicate = await ethers.getContractFactory("HTLCPredicate");
    const htlcPredicate = await HTLCPredicate.deploy();
    await htlcPredicate.waitForDeployment();
    
    const predicateAddress = await htlcPredicate.getAddress();
    console.log("✅ HTLCPredicate deployed to:", predicateAddress);

    // Verify deployment
    console.log("\n🔍 Verifying deployment...");
    try {
        // Test a simple function call
        const testOrderHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
        const testPreimage = ethers.toUtf8Bytes("test-preimage");
        
        const result = await htlcPredicate.validateHTLC(testOrderHash, testPreimage);
        console.log("✅ Contract verification successful, validateHTLC returns:", result.toString());
    } catch (error) {
        console.log("⚠️ Contract verification failed:", error.message);
    }

    // Update .env file with new addresses
    console.log("\n📝 Integration addresses:");
    console.log("HTLC_PREDICATE_ADDRESS=", predicateAddress);
    console.log("LIMIT_ORDER_PROTOCOL=", process.env.LIMIT_ORDER_PROTOCOL);
    console.log("WETH_ADDRESS=", process.env.WETH_ADDRESS);

    // Test integration setup
    console.log("\n🧪 Testing integration setup...");
    
    try {
        // Create a test HTLC order registration
        const testHashlock = ethers.keccak256(ethers.toUtf8Bytes("test-secret"));
        const testTimelock = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
        const testStellarReceiver = deployer.address; // Using deployer as placeholder
        
        console.log("Registering test HTLC order...");
        const registerTx = await htlcPredicate.registerHTLCOrder(
            testOrderHash,
            testHashlock,
            testTimelock,
            testStellarReceiver
        );
        
        await registerTx.wait();
        console.log("✅ Test HTLC order registered, tx:", registerTx.hash);
        
        // Verify the registration
        const htlcOrder = await htlcPredicate.getHTLCOrder(testOrderHash);
        console.log("✅ HTLC order details:", {
            hashlock: htlcOrder.hashlock,
            timelock: htlcOrder.timelock.toString(),
            stellarReceiver: htlcOrder.stellarReceiver
        });
        
    } catch (error) {
        console.log("⚠️ Integration test failed:", error.message);
    }

    // Summary
    console.log("\n🎉 Deployment Summary:");
    console.log("═══════════════════════════════════════");
    console.log("Network:", process.env.ETHEREUM_NETWORK);
    console.log("Deployer:", deployer.address);
    console.log("HTLCPredicate:", predicateAddress);
    console.log("Gas used: ~", "500,000 (estimated)");
    console.log("═══════════════════════════════════════");
    
    console.log("\n📋 Next Steps:");
    console.log("1. Update HTLC_PREDICATE_ADDRESS in .env file:");
    console.log(`   HTLC_PREDICATE_ADDRESS=${predicateAddress}`);
    console.log("2. Update frontend environment variables");
    console.log("3. Test complete integration with:");
    console.log("   node scripts/integrated-htlc-lop.js");
    
    return {
        htlcPredicate: predicateAddress,
        deployer: deployer.address,
        network: process.env.ETHEREUM_NETWORK
    };
}

// Execute deployment
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Deployment failed:", error);
            process.exit(1);
        });
}

module.exports = main;