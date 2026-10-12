import hashlib
import secrets

import rfc8785

REPORT_DOMAIN = b"REGGUARD:REPORT:v1\x00"
POLICY_DOMAIN = b"REGGUARD:POLICY:v1\x00"


def canonical(value):
    return rfc8785.dumps(value)


def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def policy_hash(value):
    return hashlib.sha256(POLICY_DOMAIN + canonical(value)).hexdigest()


def commitment(payload, salt_hex):
    salt = bytes.fromhex(salt_hex)
    if len(salt) != 32:
        raise ValueError("Salt must be exactly 32 bytes")
    # A fixed-width big-endian payload length makes the byte boundary explicit.
    body = canonical(payload)
    return hashlib.sha256(REPORT_DOMAIN + len(body).to_bytes(8, "big") + body + salt).hexdigest()


def finalize_commitment(payload):
    salt = secrets.token_hex(32)
    return {
        "salt": salt,
        "commitment": commitment(payload, salt),
        "record_key": "0x" + secrets.token_hex(32),
    }


def verify_package(package):
    try:
        actual = commitment(package["report"], package["salt"])
        policy = policy_hash(package["report"]["policy"])
        valid = secrets.compare_digest(actual, package["commitment"]) and secrets.compare_digest(
            policy, package["report"]["policy_hash"]
        )
        return {
            "integrity_valid": valid,
            "computed_commitment": actual,
            "status": "ANCHOR_NOT_FOUND" if valid else "INTEGRITY_MISMATCH",
        }
    except (KeyError, TypeError, ValueError, OverflowError):
        return {"integrity_valid": False, "status": "INTEGRITY_MISMATCH"}
