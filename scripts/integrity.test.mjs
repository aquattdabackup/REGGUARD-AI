import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  verifyLocal,
  verifyOnchain,
  reportCommitment,
} from "../packages/shared-schemas/integrity.mjs";
const pkg = JSON.parse(
  await fs.readFile(
    new URL("../.data/sample-report.json", import.meta.url),
    "utf8",
  ),
);
test("Python report commitment agrees with independent JavaScript implementation", async () => {
  const result = await verifyLocal(pkg);
  assert.equal(result.integrity_valid, true);
  assert.equal(result.status, "ANCHOR_NOT_FOUND");
});
test("editing any report data fails", async () => {
  const changed = structuredClone(pkg);
  changed.report.case.title = "changed";
  assert.equal((await verifyLocal(changed)).status, "INTEGRITY_MISMATCH");
});
test("wrong salt and policy fail", async () => {
  for (const field of ["salt", "policy"]) {
    const changed = structuredClone(pkg);
    if (field === "salt") changed.salt = "01".repeat(32);
    else changed.report.policy.version = "999";
    assert.equal((await verifyLocal(changed)).integrity_valid, false);
  }
});
test("canonical order and Unicode are stable", async () => {
  assert.equal(
    await reportCommitment({ x: "é", n: 1 }, "00".repeat(32)),
    await reportCommitment({ n: 1, x: "é" }, "00".repeat(32)),
  );
});
test("invented registry metadata never counts as verified", async () => {
  const changed = structuredClone(pkg);
  changed.anchor = {
    tx_hash: "0x" + "11".repeat(32),
    registry_address: "0x" + "22".repeat(20),
    chain_id: 1,
    record_key: pkg.record_key,
  };
  assert.equal(
    (await verifyOnchain(changed, "http://127.0.0.1:1", "0x" + "33".repeat(20)))
      .status,
    "INTEGRITY_MISMATCH",
  );
});
