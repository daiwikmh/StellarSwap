// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {EthereumHTLC} from "../src/EthereumHTLC.sol";
import {console} from "forge-std/console.sol";

contract DeployEthereumHTLC is Script {
    function setUp() public {}

    function run() public {
        // Load the deployer's private key from environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        // Deploy the EthereumHTLC contract
        EthereumHTLC htlc = new EthereumHTLC();

        // Log the deployed contract address
        console.log("EthereumHTLC deployed to:", address(htlc));

        // Stop broadcasting
        vm.stopBroadcast();
    }
}