// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {BatchCallDelegation} from "../src/BatchCallDelegation.sol";

contract BatchCallDelegationScript is Script {
    BatchCallDelegation public batchCallDelegation;

    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        batchCallDelegation = new BatchCallDelegation();

        vm.stopBroadcast();
        
        console.log("BatchCallDelegation deployed at:", address(batchCallDelegation));
    }
} 