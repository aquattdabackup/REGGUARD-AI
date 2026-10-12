import { test, expect, type Page } from "@playwright/test";
import type axe from "axe-core";

async function checkAccessibility(page: Page, name: string) {
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const result = await page.evaluate(async () => {
    const engine = (window as unknown as { axe: typeof axe }).axe;
    return engine.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    });
  });
  expect
    .soft(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          issue: n.failureSummary,
        })),
      })),
      name,
    )
    .toEqual([]);
}

test("accessible public and workspace screens with keyboard navigation", async ({
  page,
}) => {
  test.setTimeout(120000);
  for (const route of ["/", "/verify", "/login"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await checkAccessibility(page, route);
  }
  await page.getByRole("button", { name: "Launch demo workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Workspace overview", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to workspace" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#workspace$/);
  await checkAccessibility(page, "dashboard");
  for (const [route, heading] of [
    ["/cases/new", "New compliance case"],
    ["/policies", "Policy library"],
    ["/reports", "Audit reports"],
    ["/audit", "Activity log"],
    ["/settings", "Settings"],
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await checkAccessibility(page, route);
  }
  await page.goto("/cases");
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
  await checkAccessibility(page, "evidence inspector");
  for (const tab of [
    "Overview",
    "Documents",
    "Sources",
    "Findings",
    "Reviews",
    "Reports",
    "History",
  ]) {
    await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
    await checkAccessibility(page, `case ${tab}`);
  }
  const overview = page.getByRole("tab", { name: "Overview", exact: true });
  await overview.focus();
  await page.keyboard.press("ArrowRight");
  const documents = page.getByRole("tab", { name: /^Documents/ });
  await expect(documents).toBeFocused();
  await expect(documents).toHaveAttribute("aria-selected", "true");
});
