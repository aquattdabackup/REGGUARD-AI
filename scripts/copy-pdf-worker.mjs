import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const pdfRequire = createRequire(require.resolve("react-pdf"));
const worker = pdfRequire.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
fs.mkdirSync("apps/web/public", { recursive: true });
fs.copyFileSync(worker, "apps/web/public/pdf.worker.min.mjs");
console.log("PDF.js worker copied locally");
