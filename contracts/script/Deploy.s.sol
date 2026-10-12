// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {AuditRegistry} from "../src/AuditRegistry.sol";
interface DeployVm { function envAddress(string calldata) external returns(address); function startBroadcast() external; function stopBroadcast() external; }
contract Deploy {
    DeployVm constant vm=DeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    function run() external returns (AuditRegistry registry) {
        require(block.chainid == 11155111, "Sepolia only");
        address admin=vm.envAddress("REGISTRY_ADMIN_ADDRESS");
        address operator=vm.envAddress("ANCHOR_OPERATOR_ADDRESS");
        vm.startBroadcast();
        registry=new AuditRegistry(admin,operator);
        vm.stopBroadcast();
    }
}
