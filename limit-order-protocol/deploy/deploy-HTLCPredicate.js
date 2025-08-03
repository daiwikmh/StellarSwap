const { getChainId, deployAndGetContract } = require('@1inch/solidity-utils');

module.exports = async ({ getNamedAccounts, deployments, network }) => {
    console.log('Running HTLCPredicate deploy script');
    console.log('Network name:', network.name);

    const { deployer } = await getNamedAccounts();
    const chainId = await getChainId();

    console.log('Deploying on chain ID:', chainId);
    console.log('Deployer account:', deployer);

    const contractName = 'HTLCPredicate';

    const deployResult = await deployAndGetContract({
        contractName,
        constructorArgs: [],
        deployments,
        deployer,
        skipIfAlreadyDeployed: true,
    });

    if (deployResult.newlyDeployed) {
        console.log(`✅ ${contractName} deployed at:`, deployResult.address);
        console.log('Transaction hash:', deployResult.transactionHash);
        console.log('Gas used:', deployResult.receipt?.gasUsed?.toString());
    } else {
        console.log(`⏭️  ${contractName} already deployed at:`, deployResult.address);
    }

    // Log deployment info for frontend integration
    console.log('\n📋 Contract Details:');
    console.log('Network:', network.name);
    console.log('Chain ID:', chainId);
    console.log('Contract Address:', deployResult.address);
    console.log('Deployer:', deployer);
    
    return deployResult;
};

module.exports.tags = ['HTLCPredicate', 'crosschain', 'predicate'];
module.exports.dependencies = [];