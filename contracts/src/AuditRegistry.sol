// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Append-only commitments. An anchor proves integrity, never legal compliance.
contract AuditRegistry is AccessControl {
    bytes32 public constant ANCHOR_ROLE = keccak256("ANCHOR_ROLE");
    struct Record { bytes32 reportCommitment; bytes32 policyHash; uint64 timestamp; address submitter; }
    mapping(bytes32 => Record) private records;
    error InvalidInput();
    error AlreadyAnchored(bytes32 recordKey);
    event ReportAnchored(bytes32 indexed recordKey, bytes32 reportCommitment, bytes32 policyHash, address indexed submitter, uint64 timestamp);

    constructor(address administrator, address anchorOperator) {
        if (administrator == address(0) || anchorOperator == address(0)) revert InvalidInput();
        _grantRole(DEFAULT_ADMIN_ROLE, administrator);
        _grantRole(ANCHOR_ROLE, anchorOperator);
    }

    function anchor(bytes32 recordKey, bytes32 reportCommitment, bytes32 policyHash) external onlyRole(ANCHOR_ROLE) {
        if (recordKey == bytes32(0) || reportCommitment == bytes32(0) || policyHash == bytes32(0)) revert InvalidInput();
        if (records[recordKey].submitter != address(0)) revert AlreadyAnchored(recordKey);
        records[recordKey] = Record(reportCommitment, policyHash, uint64(block.timestamp), msg.sender);
        emit ReportAnchored(recordKey, reportCommitment, policyHash, msg.sender, uint64(block.timestamp));
    }

    function getRecord(bytes32 recordKey) external view returns (bytes32, bytes32, uint64, address) {
        Record memory record = records[recordKey];
        return (record.reportCommitment, record.policyHash, record.timestamp, record.submitter);
    }

    function verify(bytes32 recordKey, bytes32 reportCommitment, bytes32 policyHash) external view returns (bool) {
        Record memory record = records[recordKey];
        return record.submitter != address(0) && record.reportCommitment == reportCommitment && record.policyHash == policyHash;
    }

    /// @notice CRE eth_call probe at a recorded finalized block. Existence is not safety.
    function contractExists(address target) external view returns (bool) { return target.code.length > 0; }
}
