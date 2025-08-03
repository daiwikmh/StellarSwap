const { ethers } = require('hardhat');
require('dotenv').config();

/**
 * Deploy HTLC Predicate to Holesky Network
 */

async function deployToHolesky() {
    console.log("🚀 Deploying HTLC Predicate to Holesky...");
    console.log("═══════════════════════════════════════");
    
    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name);
    console.log("Chain ID:", network.chainId.toString());
    
    // Get deployer
    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Deployer balance:", ethers.formatEther(balance), "ETH");
    
    if (balance < ethers.parseEther("0.01")) {
        throw new Error("Insufficient ETH balance for deployment. Need at least 0.01 ETH");
    }
    
    // Deploy HTLCPredicate
    console.log("\n📋 Deploying HTLCPredicate contract...");
    const HTLCPredicate = await ethers.getContractFactory("HTLCPredicate");
    
    console.log("Estimating gas...");
    const deployTx = await HTLCPredicate.getDeployTransaction();
    const gasEstimate = await ethers.provider.estimateGas(deployTx);
    console.log("Estimated gas:", gasEstimate.toString());
    
    const htlcPredicate = await HTLCPredicate.deploy();
    console.log("Deployment transaction sent:", htlcPredicate.deploymentTransaction().hash);
    
    console.log("Waiting for confirmation...");
    await htlcPredicate.waitForDeployment();
    
    const predicateAddress = await htlcPredicate.getAddress();
    const deployTxReceipt = await htlcPredicate.deploymentTransaction().wait();
    
    console.log("✅ HTLCPredicate deployed successfully!");
    console.log("Contract address:", predicateAddress);
    console.log("Transaction hash:", deployTxReceipt.hash);
    console.log("Gas used:", deployTxReceipt.gasUsed.toString());
    console.log("Gas price:", ethers.formatUnits(deployTxReceipt.gasPrice, "gwei"), "gwei");
    
    // Verify deployment
    console.log("\n🔍 Verifying deployment...");
    const testOrderHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
    const testPreimage = ethers.toUtf8Bytes("test-preimage");
    
    try {
        const result = await htlcPredicate.validateHTLC(testOrderHash, testPreimage);
        console.log("✅ Contract verification successful, validateHTLC returns:", result.toString());
    } catch (error) {
        console.log("⚠️ Contract verification failed:", error.message);
    }
    
    // Test registration
    console.log("\n🧪 Testing HTLC registration...");
    try {
        const testHashlock = ethers.keccak256(ethers.toUtf8Bytes("test-secret"));
        const testTimelock = Math.floor(Date.now() / 1000) + 3600;
        
        const registerTx = await htlcPredicate.registerHTLCOrder(
            testOrderHash,
            testHashlock,
            testTimelock,
            deployer.address
        );
        
        const registerReceipt = await registerTx.wait();
        console.log("✅ Test HTLC registration successful!");
        console.log("Registration tx:", registerReceipt.hash);
        console.log("Registration gas used:", registerReceipt.gasUsed.toString());
        
        // Verify the registration
        const htlcOrder = await htlcPredicate.getHTLCOrder(testOrderHash);
        console.log("✅ HTLC order details:", {
            hashlock: htlcOrder.hashlock,
            timelock: htlcOrder.timelock.toString(),
            stellarReceiver: htlcOrder.stellarReceiver
        });
        
        // Test validation after registration
        const validationResult = await htlcPredicate.validateHTLC(testOrderHash, ethers.toUtf8Bytes("test-secret"));
        console.log("✅ Validation after registration:", validationResult.toString());
        
    } catch (error) {
        console.log("⚠️ Registration test failed:", error.message);
    }
    
    // Summary
    console.log("\n🎉 Deployment Complete!");
    console.log("═══════════════════════════════════════");
    console.log("Network: Holesky Testnet");
    console.log("Contract Address:", predicateAddress);
    console.log("Transaction Hash:", deployTxReceipt.hash);
    console.log("Total Gas Used:", deployTxReceipt.gasUsed.toString());
    console.log("Deployer:", deployer.address);
    console.log("═══════════════════════════════════════");
    
    console.log("\n📋 Update Environment Variables:");
    console.log(`HTLC_PREDICATE_ADDRESS=${predicateAddress}`);
    console.log(`NEXT_PUBLIC_HTLC_PREDICATE_ADDRESS=${predicateAddress}`);
    
    console.log("\n🔗 Etherscan Link:");
    console.log(`https://holesky.etherscan.io/address/${predicateAddress}`);
    
    console.log("\n🚀 Next Steps:");
    console.log("1. Update .env files with new contract address");
    console.log("2. Test complete integration");
    console.log("3. Deploy frontend");
    console.log("4. Demo cross-chain swap!");
    
    return {
        success: true,
        contractAddress: predicateAddress,
        transactionHash: deployTxReceipt.hash,
        gasUsed: deployTxReceipt.gasUsed.toString(),
        network: network.name
    };
}

// Execute deployment
if (require.main === module) {
    deployToHolesky()
        .then((result) => {
            console.log("\n🏆 DEPLOYMENT SUCCESSFUL!");
            console.log("Contract ready for hackathon demo!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("\n❌ Deployment failed:", error.message);
            console.error("Stack:", error.stack);
            process.exit(1);
        });
}

module.exports = deployToHolesky;