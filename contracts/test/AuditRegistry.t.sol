// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {AuditRegistry} from "../src/AuditRegistry.sol";
import {IssuerEvidenceReceiver} from "../src/IssuerEvidenceReceiver.sol";

interface Vm {
    function prank(address) external;
    function expectRevert() external;
    function expectRevert(bytes4) external;
    function expectRevert(bytes calldata) external;
    function expectEmit(bool,bool,bool,bool) external;
    function warp(uint256) external;
    function assume(bool) external;
}
contract AuditRegistryTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    AuditRegistry registry;
    bytes32 constant KEY = bytes32(uint256(1));
    bytes32 constant REPORT = bytes32(uint256(2));
    bytes32 constant POLICY = bytes32(uint256(3));
    event ReportAnchored(bytes32 indexed recordKey, bytes32 reportCommitment, bytes32 policyHash, address indexed submitter, uint64 timestamp);
    function setUp() public { vm.warp(1700000000); registry = new AuditRegistry(address(this),address(this)); }
    function testAuthorizedAnchorAndGetter() public {
        registry.anchor(KEY, REPORT, POLICY);
        (bytes32 report, bytes32 policy, uint64 timestamp, address submitter) = registry.getRecord(KEY);
        require(report == REPORT && policy == POLICY && timestamp == block.timestamp && submitter == address(this));
        require(registry.verify(KEY,REPORT,POLICY));
    }
    function testUnauthorizedCannotAnchor() public {vm.prank(address(0xBEEF));vm.expectRevert();registry.anchor(KEY,REPORT,POLICY);}
    function testDuplicateRejected() public {registry.anchor(KEY,REPORT,POLICY);vm.expectRevert(abi.encodeWithSelector(AuditRegistry.AlreadyAnchored.selector, KEY));registry.anchor(KEY,bytes32(uint256(9)),POLICY);}
    function testZeroValuesRejected() public {vm.expectRevert(AuditRegistry.InvalidInput.selector);registry.anchor(bytes32(0),REPORT,POLICY);vm.expectRevert(AuditRegistry.InvalidInput.selector);registry.anchor(KEY,bytes32(0),POLICY);vm.expectRevert(AuditRegistry.InvalidInput.selector);registry.anchor(KEY,REPORT,bytes32(0));}
    function testEvent() public {vm.expectEmit(true,true,false,true);emit ReportAnchored(KEY,REPORT,POLICY,address(this),uint64(block.timestamp));registry.anchor(KEY,REPORT,POLICY);}
    function testModifiedCommitmentFails() public {registry.anchor(KEY,REPORT,POLICY);require(!registry.verify(KEY,sha256("modified report"),POLICY));require(!registry.verify(KEY,REPORT,sha256("different policy")));}
    function testMissingAnchorNeverVerifies() public view {require(!registry.verify(KEY,bytes32(0),bytes32(0)));}
    function testInvalidAdministrator() public {vm.expectRevert(AuditRegistry.InvalidInput.selector);new AuditRegistry(address(0),address(this));}
    function testRoleRevocation() public {registry.revokeRole(registry.ANCHOR_ROLE(),address(this));vm.expectRevert();registry.anchor(KEY,REPORT,POLICY);}
    function testContractProbe() public view {require(registry.contractExists(address(registry)));require(!registry.contractExists(address(0xBEEF)));}
    function testFuzzAppendOnly(bytes32 key,bytes32 report,bytes32 policy) public {vm.assume(key!=0&&report!=0&&policy!=0);registry.anchor(key,report,policy);require(registry.verify(key,report,policy));vm.expectRevert(abi.encodeWithSelector(AuditRegistry.AlreadyAnchored.selector, key));registry.anchor(key,report,policy);}
}
contract IssuerEvidenceReceiverTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    IssuerEvidenceReceiver receiver;
    bytes32 constant ID = bytes32(uint256(123));
    function setUp() public {vm.warp(1700000000);receiver=new IssuerEvidenceReceiver(address(this),ID,address(0xCAFE));}
    function metadata() internal pure returns(bytes memory) {return abi.encodePacked(ID,bytes10("regguard"),address(0xCAFE),bytes2(0));}
    function report() internal view returns(bytes memory) {return abi.encode(bytes32(uint256(1)),bytes32(uint256(2)),uint64(block.timestamp));}
    function testValid64ByteMetadata() public {receiver.onReport(metadata(),report());require(receiver.evidenceCommitments(bytes32(uint256(1)))==bytes32(uint256(2)));}
    function testForwarderRequired() public {vm.prank(address(0xBEEF));vm.expectRevert(IssuerEvidenceReceiver.Unauthorized.selector);receiver.onReport(metadata(),report());}
    function testWrongWorkflowRejected() public {vm.expectRevert(IssuerEvidenceReceiver.Unauthorized.selector);receiver.onReport(abi.encodePacked(bytes32(uint256(999)),bytes10("regguard"),address(0xCAFE),bytes2(0)),report());}
    function testReplayRejected() public {receiver.onReport(metadata(),report());vm.expectRevert(IssuerEvidenceReceiver.DuplicateRecord.selector);receiver.onReport(metadata(),report());}
    function testStaleReportRejected() public {vm.expectRevert(IssuerEvidenceReceiver.InvalidReport.selector);receiver.onReport(metadata(),abi.encode(bytes32(uint256(1)),bytes32(uint256(2)),uint64(block.timestamp-3601)));}
}
