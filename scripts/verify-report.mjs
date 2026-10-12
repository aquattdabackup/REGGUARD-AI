import fs from "node:fs";
import {
  verifyLocal,
  verifyOnchain,
} from "../packages/shared-schemas/integrity.mjs";
const args = process.argv.slice(2),
  filename = args[0];
const usage =
  "Usage: node scripts/verify-report.mjs package.json [--rpc URL --registry 0xTRUSTED_ADDRESS]";
const value = (flag) =>
  args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
const rpc = value("--rpc"),
  registry = value("--registry");
if (
  !filename ||
  Boolean(rpc) !== Boolean(registry) ||
  args
    .slice(1)
    .some((a, i) => i % 2 === 0 && !["--rpc", "--registry"].includes(a))
) {
  console.error(usage);
  process.exit(2);
}
let pkg;
try {
  if (fs.statSync(filename).size > 10 * 1024 * 1024) throw new Error();
  pkg = JSON.parse(fs.readFileSync(filename, "utf8"));
} catch {
  console.error("Cannot read a supported JSON package (maximum 10 MB).");
  process.exit(2);
}
const result =
  rpc && registry
    ? await verifyOnchain(pkg, rpc, registry)
    : await verifyLocal(pkg);
console.log(JSON.stringify(result, null, 2));
process.exitCode =
  result.status === "VERIFIED" || (!rpc && result.integrity_valid) ? 0 : 1;
