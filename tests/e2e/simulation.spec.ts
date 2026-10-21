import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
test.use({ isMobile: true, hasTouch: true });
async function approve(page: Page) {
  await page
    .getByRole("button", { name: "Approve & apply", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function workspace(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create your first workspace" })
    .click();
  await page
    .getByLabel("Workspace name", { exact: true })
    .fill("Deterministic lab");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function explore(page: Page) {
  const toggle = page.getByRole("button", { name: /Rules & simulations/ });
  if ((await toggle.getAttribute("aria-expanded")) !== "true")
    await toggle.click();
}
async function example(page: Page) {
  await workspace(page);
  await explore(page);
  await page.getByRole("button", { name: "Preview economic example" }).click();
  await approve(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Companies.",
  );
}
const row = (page: Page, name = "Company A") =>
  page.locator("tbody tr").filter({ hasText: name });
async function run(page: Page, steps: number) {
  await explore(page);
  await page
    .getByLabel("Simulation steps", { exact: true })
    .fill(String(steps));
  await page
    .getByRole("button", { name: "Preview simulation", exact: true })
    .click();
  await expect(
    page.getByText(`${steps} steps previewed`, { exact: false }),
  ).toBeVisible();
}
for (const width of [390, 768, 1024]) {
  test(`economic simulation preview, cancel, approval, reload and offline at ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 1024 });
    await example(page);
    await expect(row(page).locator("td").nth(1)).toHaveText("10");
    const revisions = await page
      .getByRole("button", { name: /revisions/ })
      .textContent();
    await run(page, 5);
    await expect(
      page.getByText("Step 5: 2 changes · 2 records", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("10 → 7", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Cancel change", exact: true })
      .click();
    await expect(row(page).locator("td").nth(1)).toHaveText("10");
    expect(
      await page.getByRole("button", { name: /revisions/ }).textContent(),
    ).toBe(revisions);
    await run(page, 5);
    await approve(page);
    await expect(row(page).locator("td").nth(1)).toHaveText("-2");
    await expect(row(page)).toContainText("Bankrupt");
    await expect(row(page, "Company B").locator("td").nth(1)).toHaveText("18");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1024, height: 768 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.reload();
    await expect(row(page).locator("td").nth(1)).toHaveText("-2");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(row(page)).toContainText("Bankrupt");
    await explore(page);
    await run(page, 1);
    await approve(page);
    await expect(row(page, "Company B").locator("td").nth(1)).toHaveText("20");
    await context.setOffline(false);
  });
}
test("generic field-change rule uses editable conditions/actions and explicit record-effect approval", async ({
  page,
}) => {
  await workspace(page);
  await page.getByRole("button", { name: /Reading tracker Books/ }).click();
  await approve(page);
  await page
    .getByRole("button", { name: "Add record", exact: false })
    .first()
    .click();
  await page.getByLabel("Book", { exact: true }).fill("General workflow");
  await page.getByLabel("Pages Read", { exact: true }).fill("10");
  await page.getByLabel("Minutes Read", { exact: true }).fill("5");
  await page.getByLabel("Status", { exact: true }).selectOption("Reading");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await explore(page);
  await page.getByRole("button", { name: "Add rule", exact: true }).click();
  await page
    .getByLabel("Rule name", { exact: true })
    .fill("Award two pages on a finished transition");
  await page
    .getByLabel("Rule trigger", { exact: true })
    .selectOption("fieldChanged");
  await page
    .getByLabel("Trigger field", { exact: true })
    .selectOption({ label: "Status" });
  await page
    .getByLabel("Condition type", { exact: true })
    .selectOption("compare");
  await page
    .getByLabel("Condition field", { exact: true })
    .selectOption({ label: "Status" });
  await page
    .getByLabel("Condition value", { exact: true })
    .selectOption("Finished");
  await page
    .getByLabel("Action 1 target", { exact: true })
    .selectOption({ label: "Pages Read" });
  await page
    .getByLabel("Action 1 operation", { exact: true })
    .selectOption("increment");
  await page
    .getByLabel("Action 1 expression number", { exact: true })
    .fill("2");
  await page.getByRole("button", { name: "Preview rule", exact: true }).click();
  await approve(page);
  await page
    .getByRole("button", { name: "Edit General workflow", exact: true })
    .click();
  await page.getByLabel("Status", { exact: true }).selectOption("Finished");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Record rule effects");
  await expect(page.getByText("10 → 12", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel change", exact: true })
    .click();
  await expect(row(page, "General workflow").locator("td").nth(1)).toHaveText(
    "10",
  );
  await page
    .getByRole("button", { name: "Edit General workflow", exact: true })
    .click();
  await page.getByLabel("Status", { exact: true }).selectOption("Finished");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await approve(page);
  await expect(row(page, "General workflow").locator("td").nth(1)).toHaveText(
    "12",
  );
  await page.reload();
  await expect(row(page, "General workflow").locator("td").nth(1)).toHaveText(
    "12",
  );
});
test("cross-collection computed aggregate is user-operable through the field form", async ({
  page,
}) => {
  await example(page);
  await page
    .getByRole("button", { name: "Field", exact: false })
    .filter({ hasText: "Field" })
    .click();
  await page.getByLabel("Field name", { exact: true }).fill("Related costs");
  await page.getByLabel("Field type").selectOption("computed");
  await page
    .getByLabel("Computed expression type", { exact: true })
    .selectOption("aggregate");
  await page
    .getByLabel("Computed expression collection", { exact: true })
    .selectOption({ label: "Expenses" });
  await page
    .getByLabel("Computed expression filter", { exact: true })
    .selectOption("record");
  await page
    .getByRole("button", { name: "Preview field", exact: true })
    .click();
  await approve(page);
  await expect(row(page).locator("td").nth(7)).toHaveText("7");
  await expect(row(page, "Company B").locator("td").nth(7)).toHaveText("3");
});
test("rules can be edited, disabled and removed; conflicts and no-op simulations cannot save", async ({
  page,
}) => {
  await example(page);
  const list = page.locator(".rule-list");
  await list
    .getByRole("listitem")
    .filter({ hasText: "Operating cash flow" })
    .getByRole("button", { name: /^Edit rule/ })
    .click();
  await page
    .getByLabel("Rule name", { exact: true })
    .fill(
      "A long readable generic operating rule with a carefully explained condition and numeric action",
    );
  await page.getByRole("button", { name: "Preview rule", exact: true }).click();
  await expect(
    page.getByText("Rule sample only.", { exact: false }),
  ).toBeVisible();
  await approve(page);
  await list
    .getByRole("listitem")
    .filter({ hasText: "A long readable generic" })
    .getByRole("button", { name: "Disable", exact: true })
    .click();
  await approve(page);
  await run(page, 1);
  await expect(page.getByRole("dialog")).toContainText(
    "No data changes to apply",
  );
  await expect(
    page.getByRole("button", { name: "Approve & apply" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel change" }).click();
  await list
    .getByRole("listitem")
    .filter({ hasText: "A long readable generic" })
    .getByRole("button", { name: "Enable", exact: true })
    .click();
  await approve(page);
  await page.getByRole("button", { name: "Add rule", exact: true }).click();
  await page
    .getByLabel("Rule name", { exact: true })
    .fill("Conflicting cash assignment");
  await page
    .getByLabel("Action 1 target", { exact: true })
    .selectOption({ label: "Cash" });
  await page.getByRole("button", { name: "Preview rule" }).click();
  await expect(page.getByRole("dialog")).toContainText("Sample could not run");
  await approve(page);
  await page.getByRole("button", { name: "Preview simulation" }).click();
  await expect(page.getByRole("alert")).toContainText("Conflicting writes");
  await expect(
    page.getByRole("button", { name: "Approve & apply" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel change" }).click();
  await expect(row(page).locator("td").nth(1)).toHaveText("10");
  await list
    .getByRole("listitem")
    .filter({ hasText: "Conflicting cash assignment" })
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await approve(page);
  await expect(list).not.toContainText("Conflicting cash assignment");
});
test("simulation branches isolate data and full restore/export/import preserve definitions", async ({
  page,
}) => {
  await example(page);
  await page.getByRole("button", { name: "Fork branch", exact: true }).click();
  await page
    .getByLabel("Branch name", { exact: true })
    .fill("Simulation experiment");
  await page
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await run(page, 5);
  await approve(page);
  await page
    .getByLabel("Active branch", { exact: true })
    .selectOption({ label: "⑂ main" });
  await expect(row(page).locator("td").nth(1)).toHaveText("10");
  await page
    .getByLabel("Active branch", { exact: true })
    .selectOption({ label: "⑂ Simulation experiment" });
  await expect(row(page).locator("td").nth(1)).toHaveText("-2");
  await page.getByRole("button", { name: /revisions/ }).click();
  await page.getByRole("button", { name: /^Add economic example/ }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Restore design only" }).click();
  await expect(row(page).locator("td").nth(1)).toHaveText("-2");
  await page.getByRole("button", { name: /revisions/ }).click();
  await page.getByRole("button", { name: /^Add economic example/ }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Restore design + records" }).click();
  await expect(row(page).locator("td").nth(1)).toHaveText("10");
  await page.getByRole("button", { name: "Backups & recovery" }).click();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON backup" }).click();
  const file = await event,
    bytes = await readFile((await file.path())!);
  expect(
    JSON.parse(bytes.toString()).document.workspaces[0].commits.at(-1).snapshot
      .automation.rules,
  ).toHaveLength(2);
  await page.getByLabel("Choose backup (maximum 5 MB)").setInputFiles({
    name: "simulation-native.json",
    mimeType: "application/json",
    buffer: bytes,
  });
  await page
    .getByRole("button", { name: "Approve backup replacement" })
    .click();
  await expect(row(page).locator("td").nth(1)).toHaveText("10");
  await explore(page);
  await expect(page.locator(".rule-list")).toContainText("Operating cash flow");
});

test("simulation approval rejects stale tabs and quota failures without partial writes", async ({
  page,
  context,
}) => {
  await example(page);
  await run(page, 5);
  const other = await context.newPage();
  await other.goto("/");
  await run(other, 1);
  await approve(other);
  await page
    .getByRole("button", { name: "Approve & apply", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Another tab changed");
  await page.getByRole("button", { name: "Cancel change" }).click();
  await page.reload();
  await expect(row(page).locator("td").nth(1)).toHaveText("7");
  await run(page, 2);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (key === "current")
        throw new DOMException("Storage quota exceeded", "QuotaExceededError");
      return original.call(this, value, key);
    };
  });
  await page
    .getByRole("button", { name: "Approve & apply", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Storage quota exceeded");
  await page.reload();
  await expect(row(page).locator("td").nth(1)).toHaveText("7");
});
