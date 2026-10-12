import httpx
from eth_abi import decode, encode
from eth_utils import keccak

from app.connectors.gleif import source
from app.core.config import settings


class EVMConnector:
    def __init__(self, url=None, client=None):
        self.url = settings().evm_rpc_url if url is None else url
        self.client = client

    def rpc(self, method, params):
        if not self.url:
            raise ValueError("RPC_NOT_CONFIGURED")
        payload = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
        if self.client:
            response = self.client.post(self.url, json=payload)
        else:
            with httpx.Client(timeout=15, follow_redirects=False) as client:
                response = client.post(self.url, json=payload)
        response.raise_for_status()
        body = response.json()
        if body.get("error") or "result" not in body:
            raise ValueError("RPC_ERROR")
        return body["result"]

    def check_chain(self, expected):
        chain_id = int(self.rpc("eth_chainId", []), 16)
        if chain_id != expected:
            raise ValueError("CHAIN_MISMATCH")
        return chain_id

    def fetch(self, address, chain_id):
        identifier = f"eip155:{chain_id}:{address}"
        try:
            self.check_chain(chain_id)
            block = self.rpc("eth_getBlockByNumber", ["finalized", False])
            if not block or not block.get("number"):
                raise ValueError("FINALIZED_BLOCK_UNAVAILABLE")
            code = self.rpc("eth_getCode", [address, block["number"]])
            if not isinstance(code, str) or not code.startswith("0x"):
                raise ValueError("INVALID_CODE")
            return source(
                "EVM",
                identifier,
                {
                    "chain_id": chain_id,
                    "address": address,
                    "contract_exists": code not in ("0x", "0x0", "0x00"),
                    "block_number": int(block["number"], 16),
                    "block_hash": block["hash"],
                },
                {"block": block, "code": code},
            )
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            return source("EVM", identifier, {}, {}, error="RPC_UNAVAILABLE_OR_WRONG_CHAIN")

    def registry_record(self, registry, record_key, chain_id):
        self.check_chain(chain_id)
        selector = keccak(text="getRecord(bytes32)")[:4]
        data = "0x" + (selector + encode(["bytes32"], [bytes.fromhex(record_key[2:])])).hex()
        result = self.rpc("eth_call", [{"to": registry, "data": data}, "finalized"])
        report_hash, policy, timestamp, submitter = decode(
            ["bytes32", "bytes32", "uint64", "address"], bytes.fromhex(result[2:])
        )
        return {
            "commitment": report_hash.hex(),
            "policy_hash": policy.hex(),
            "timestamp": timestamp,
            "submitter": submitter,
        }
