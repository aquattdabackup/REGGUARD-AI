import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
const projectDir = path.resolve(__dirname, "../../..");
const artifact = (name: string) =>
  path.join(projectDir, "docs/screenshots", name);
test("fixture workflow: evaluation, evidence, review, report, tamper, replay", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({
    path: artifact("landing-desktop.png"),
    fullPage: true,
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "Launch demo workspace" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(
    page.getByText("Aurora", { exact: false }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: artifact("dashboard-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("link", { name: /Aurora \/ Issuer onboarding/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Run evaluation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "R03", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "R03", exact: true }).click();
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.screenshot({
    path: artifact("evidence-inspector.png"),
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Reviews", exact: true }).click();
  await page
    .getByLabel("Review rationale")
    .fill("Reviewed the fictional sample and its cited identity evidence.");
  await page
    .getByRole("button", { name: "Record review", exact: true })
    .click();
  await expect(
    page.getByText(
      "Reviewed the fictional sample and its cited identity evidence.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await page.getByRole("link", { name: /Readiness report/ }).click();
  await page
    .getByRole("button", { name: "Finalize report", exact: true })
    .click();
  await expect(page.getByText("FINALIZED", { exact: true })).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON package" }).click();
  const file = await downloadEvent;
  const filepath = path.join(projectDir, ".data/browser-report.json");
  await file.saveAs(filepath);
  await page.goto("/verify");
  await page.locator('input[type="file"]').setInputFiles(filepath);
  await expect(
    page.getByText(/ANCHOR.NOT.FOUND|Anchor not found/i).first(),
  ).toBeVisible();
  await page.screenshot({
    path: artifact("independent-verifier.png"),
    fullPage: true,
  });
  const pkg = JSON.parse(await fs.readFile(filepath, "utf-8"));
  pkg.report.case.title = "Altered by test";
  await page.locator('input[type="file"]').setInputFiles({
    name: "tampered.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(pkg)),
  });
  await expect(
    page.getByText(/INTEGRITY.MISMATCH|Integrity mismatch/i).first(),
  ).toBeVisible();
  await page.goto("/cases");
  await page
    .getByRole("link", { name: /Aurora \/ Issuer onboarding/ })
    .first()
    .click();
  await page.getByLabel("Target policy").selectOption("2.0");
  await page.getByRole("button", { name: "Replay snapshot" }).click();
  await expect(
    page.getByRole("button", { name: "R08", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await expect(
    page.locator(".diff-list").getByText("R05", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".diff-list").getByText("R08", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Simulate lapsed registration" })
    .click();
  await expect(
    page.getByRole("button", { name: "R02", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "R02", exact: true }).click();
  await expect(page.locator(".finding-content .badge")).toHaveText("FAIL");
  await page.goto("/dashboard");
  await expect(
    page
      .locator(".metric")
      .filter({ hasText: "Passing checks" })
      .locator("strong"),
  ).toHaveText("05");
  await page.screenshot({
    path: artifact("dashboard-desktop.png"),
    fullPage: true,
  });
  expect(failures).toEqual([]);
});
test("mobile navigation and case creation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByRole("button", { name: "Launch demo workspace" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(
    page.getByRole("heading", { name: "Workspace overview", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: artifact("dashboard-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.goto("/cases/new");
  await page
    .getByLabel("Case name", { exact: true })
    .fill("Browser onboarding test");
  await page
    .getByLabel("Legal entity name", { exact: true })
    .fill("Browser Test Ltd");
  await page
    .getByLabel("Smart contract address", { exact: true })
    .fill("0x1111111111111111111111111111111111111111");
  await page
    .getByRole("button", { name: "Create case & add evidence" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Browser onboarding test", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("supported document upload uses the worker", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Launch demo workspace" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page
    .getByRole("link", { name: /^Meridian \/ Evidence collection/ })
    .click();
  await page.getByRole("tab", { name: /Documents/ }).click();
  await page
    .getByLabel("Upload evidence", { exact: true })
    .setInputFiles(path.join(projectDir, "fixtures/documents/certificate.pdf"));
  await expect(page.locator(".document-list .badge")).toHaveText("READY");
  await expect(page.getByText("Extraction: fixture")).toBeVisible();
});
