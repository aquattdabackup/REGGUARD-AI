from eth_abi import decode, encode
from eth_account import Account
from eth_utils import keccak

from app.connectors.evm import EVMConnector
from app.core.config import settings
from app.models.entities import Anchor, Report


def verify_onchain(package):
    anchor = package.get("anchor")
    if not anchor or not anchor.get("tx_hash"):
        return {"status": "ANCHOR_NOT_FOUND"}
    if anchor["chain_id"] != 11155111 or anchor["record_key"] != package["record_key"]:
        return {"status": "INTEGRITY_MISMATCH"}
    try:
        rpc = EVMConnector()
        record = rpc.registry_record(
            anchor["registry_address"], package["record_key"], anchor["chain_id"]
        )
        receipt = rpc.rpc("eth_getTransactionReceipt", [anchor["tx_hash"]])
        if not record["timestamp"]:
            return {"status": "ANCHOR_NOT_FOUND"}
        if (
            not receipt
            or receipt.get("status") != "0x1"
            or receipt.get("to", "").lower() != anchor["registry_address"].lower()
        ):
            return {"status": "VERIFICATION_UNAVAILABLE"}
        event_signature = (
            "0x" + keccak(text="ReportAnchored(bytes32,bytes32,bytes32,address,uint64)").hex()
        )
        event_matches = False
        for event in receipt.get("logs", []):
            topics = event.get("topics", [])
            if (
                event.get("address", "").lower() == anchor["registry_address"].lower()
                and len(topics) == 3
                and topics[0].lower() == event_signature
                and topics[1].lower() == package["record_key"].lower()
            ):
                values = decode(["bytes32", "bytes32", "uint64"], bytes.fromhex(event["data"][2:]))
                event_matches = (
                    values[0].hex() == package["commitment"]
                    and values[1].hex() == package["report"]["policy_hash"]
                )
        matches = (
            event_matches
            and record["commitment"] == package["commitment"]
            and record["policy_hash"] == package["report"]["policy_hash"]
        )
        return {
            "status": "VERIFIED" if matches else "INTEGRITY_MISMATCH",
            "record": record,
            "block_number": int(receipt["blockNumber"], 16),
        }
    except Exception:
        return {"status": "VERIFICATION_UNAVAILABLE"}


def process_anchor(db, anchor_id):
    cfg = settings()
    if cfg.evm_chain_id != 11155111:
        raise ValueError("ONLY_SEPOLIA_ALLOWED")
    anchor = db.get(Anchor, anchor_id)
    report = db.get(Report, anchor.report_id)
    if anchor.status == "CONFIRMED":
        return True
    rpc = EVMConnector()
    rpc.check_chain(11155111)
    # Single worker/signer deployment. Raw signed bytes and tx hash are committed BEFORE broadcast.
    # Retrying broadcasts the same transaction, never a second commitment or a new nonce.
    if not anchor.raw_transaction:
        account = Account.from_key(cfg.anchor_signer_private_key)
        selector = keccak(text="anchor(bytes32,bytes32,bytes32)")[:4]
        data = (
            "0x"
            + (
                selector
                + encode(
                    ["bytes32"] * 3,
                    [
                        bytes.fromhex(anchor.record_key[2:]),
                        bytes.fromhex(report.report_hash),
                        bytes.fromhex(report.policy_hash),
                    ],
                )
            ).hex()
        )
        tx = {
            "chainId": 11155111,
            "nonce": int(rpc.rpc("eth_getTransactionCount", [account.address, "pending"]), 16),
            "to": anchor.registry_address,
            "value": 0,
            "data": data,
            "gasPrice": int(rpc.rpc("eth_gasPrice", []), 16),
        }
        tx["gas"] = (
            int(
                rpc.rpc(
                    "eth_estimateGas",
                    [{"from": account.address, "to": anchor.registry_address, "data": data}],
                ),
                16,
            )
            * 12
            // 10
        )
        if tx["gas"] > 400000 or tx["gasPrice"] > 100_000_000_000:
            raise ValueError("GAS_SAFETY_LIMIT")
        signed = account.sign_transaction(tx)
        anchor.raw_transaction = "0x" + bytes(signed.raw_transaction).hex()
        anchor.tx_hash = "0x" + bytes(signed.hash).hex()
        anchor.status = "SIGNED"
        db.commit()
    receipt = rpc.rpc("eth_getTransactionReceipt", [anchor.tx_hash])
    if not receipt:
        try:
            rpc.rpc("eth_sendRawTransaction", [anchor.raw_transaction])
        except ValueError:
            # Already-known transactions are reconciled via their persisted hash on the next tick.
            if not rpc.rpc("eth_getTransactionByHash", [anchor.tx_hash]):
                raise
        anchor.status = "PENDING"
        db.commit()
        return False
    if receipt["status"] != "0x1":
        anchor.status = "FAILED"
        db.commit()
        raise ValueError("ANCHOR_TRANSACTION_REVERTED")
    # A finalized state read is required; pending/mined transactions are not reported as verified.
    result = verify_onchain(
        {
            "report": report.payload,
            "commitment": report.report_hash,
            "record_key": report.record_key,
            "anchor": {
                "tx_hash": anchor.tx_hash,
                "chain_id": anchor.chain_id,
                "registry_address": anchor.registry_address,
                "record_key": anchor.record_key,
            },
        }
    )
    if result["status"] != "VERIFIED":
        anchor.status = "PENDING_FINALITY"
        db.commit()
        return False
    anchor.status, anchor.block_number = "CONFIRMED", int(receipt["blockNumber"], 16)
    report.status = "ANCHORED"
    db.commit()
    return True
