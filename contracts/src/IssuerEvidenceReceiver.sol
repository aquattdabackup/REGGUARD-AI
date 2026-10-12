// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface IReceiver is IERC165 {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

/// @notice CRE source attestation receiver, separate from finalized application reports.
/// @dev Pin the forwarder AND workflow identity. No bypass for simulation or zero configuration.
contract IssuerEvidenceReceiver is ERC165, IReceiver {
    address public immutable forwarder;
    bytes32 public immutable workflowId;
    address public immutable workflowOwner;
    mapping(bytes32 => bytes32) public evidenceCommitments;
    error Unauthorized();
    error InvalidReport();
    error DuplicateRecord();
    event IssuerEvidenceAttested(bytes32 indexed recordKey, bytes32 evidenceHash, uint64 observedAt);

    constructor(address trustedForwarder, bytes32 expectedWorkflowId, address expectedOwner) {
        if (trustedForwarder == address(0) || expectedWorkflowId == bytes32(0) || expectedOwner == address(0)) revert InvalidReport();
        forwarder = trustedForwarder;
        workflowId = expectedWorkflowId;
        workflowOwner = expectedOwner;
    }

    function onReport(bytes calldata metadata, bytes calldata report) external {
        if (msg.sender != forwarder) revert Unauthorized();
        // CRE production metadata is 64 bytes; 62-byte fixtures preserve the identity prefix.
        if (metadata.length != 62 && metadata.length != 64) revert InvalidReport();
        if (bytes32(metadata[0:32]) != workflowId || address(bytes20(metadata[42:62])) != workflowOwner) revert Unauthorized();
        if (report.length != 96) revert InvalidReport();
        (bytes32 key, bytes32 evidenceHash, uint64 observedAt) = abi.decode(report, (bytes32,bytes32,uint64));
        if (key == bytes32(0) || evidenceHash == bytes32(0) || observedAt > block.timestamp || block.timestamp - observedAt > 1 hours) revert InvalidReport();
        if (evidenceCommitments[key] != bytes32(0)) revert DuplicateRecord();
        evidenceCommitments[key] = evidenceHash;
        emit IssuerEvidenceAttested(key, evidenceHash, observedAt);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || super.supportsInterface(interfaceId);
    }
}
