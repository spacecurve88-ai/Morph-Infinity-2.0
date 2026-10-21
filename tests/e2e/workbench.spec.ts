import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function create(page: Page, kind: "reading" | "budget" = "reading") {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create your first workspace" })
    .click();
  await page.getByLabel("Workspace name", { exact: true }).fill("My tools");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await page
    .getByRole("button", {
      name:
        kind === "reading" ? /Reading tracker Books/ : /Personal budget Income/,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText("PROPOSED CHANGE");
  await page.getByRole("button", { name: "Approve & apply" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    kind === "reading" ? "Reading." : "Budget.",
  );
}
async function addBook(
  page: Page,
  title: string,
  pages = "120",
  minutes = "30",
  status = "Reading",
) {
  await page
    .getByRole("button", { name: "Add record", exact: false })
    .first()
    .click();
  await page.getByLabel("Book", { exact: true }).fill(title);
  await page.getByLabel("Pages Read").fill(pages);
  await page.getByLabel("Minutes Read").fill(minutes);
  await page.getByLabel("Status", { exact: true }).selectOption(status);
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function request(page: Page, text: string) {
  await page.getByLabel("Describe a change").fill(text);
  await page.getByRole("button", { name: "Preview change" }).click();
}
async function apply(page: Page, text: string) {
  await request(page, text);
  await page.getByRole("button", { name: "Approve & apply" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("reading formula preview, approval, missing/zero inputs, reload, and backup round-trip", async ({
  page,
}) => {
  await create(page);
  await addBook(page, "The Dispossessed");
  await addBook(page, "Zero minutes", "20", "0");
  await addBook(page, "Missing minutes", "20", "");
  await request(
    page,
    "Calculate reading speed using pages read and minutes read",
  );
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Live calculation preview")).toBeVisible();
  await expect(dialog.getByText("Division by zero")).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Reading Speed" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Approve & apply" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "The Dispossessed" }),
  ).toContainText("4");
  await expect(
    page.getByRole("row").filter({ hasText: "Zero minutes" }),
  ).toContainText("Division by zero");
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "The Dispossessed" }),
  ).toContainText("4");
  await page.getByRole("button", { name: "Backups & recovery" }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON backup" }).click();
  const downloaded = await downloadEvent;
  const bytes = await readFile((await downloaded.path())!);
  const envelope = JSON.parse(bytes.toString());
  expect(envelope.document.workspaces).toHaveLength(1);
  await page.getByLabel("Choose backup (maximum 5 MB)").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: bytes,
  });
  await expect(
    page.getByRole("heading", { name: "Preview replacement" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Approve backup replacement" })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "The Dispossessed" }),
  ).toContainText("4");
});

test("unsupported commands leave data and history untouched", async ({
  page,
}) => {
  await create(page);
  await addBook(page, "Keep this");
  const revisions = await page
    .getByRole("button", { name: /revisions/ })
    .textContent();
  await request(page, "Remind me three days before a deadline");
  await expect(page.getByRole("alert")).toContainText("not supported");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("row").filter({ hasText: "Keep this" }),
  ).toBeVisible();
  expect(
    await page.getByRole("button", { name: /revisions/ }).textContent(),
  ).toBe(revisions);
});

test("abandonment rule captures once and charts actual local month", async ({
  page,
}) => {
  await create(page);
  await addBook(page, "A changing mind");
  await apply(page, "When I mark a book abandoned, record today's date");
  await page.getByRole("button", { name: "Edit A changing mind" }).click();
  await page.getByLabel("Status", { exact: true }).selectOption("Abandoned");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  const localDate = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  await expect(
    page.getByRole("row").filter({ hasText: "A changing mind" }),
  ).toContainText(localDate);
  await expect(
    page.getByRole("region", { name: "Abandonment by month" }),
  ).toContainText(localDate.slice(0, 7));
  await page.getByRole("button", { name: "Edit A changing mind" }).click();
  await expect(page.getByLabel("Abandoned on")).toHaveAttribute("readonly", "");
  await page.getByLabel("Status", { exact: true }).selectOption("Reading");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await page.getByRole("button", { name: "Edit A changing mind" }).click();
  await page.getByLabel("Status", { exact: true }).selectOption("Abandoned");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "A changing mind" }),
  ).toContainText(localDate);
});

test("budget formulas, numeric sorting, filters, and cards preserve values", async ({
  page,
}) => {
  await create(page, "budget");
  for (const [name, income, expenses] of [
    ["February", "100", "80"],
    ["January", "1000", "100"],
  ]) {
    await page
      .getByRole("button", { name: "Add record", exact: false })
      .first()
      .click();
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Income").fill(income);
    await page.getByLabel("Expenses").fill(expenses);
    await page
      .getByRole("button", { name: "Save record", exact: true })
      .click();
  }
  await apply(page, "Balance = Income - Expenses");
  await page
    .getByLabel("Sort records", { exact: true })
    .selectOption({ label: "Balance ↑" });
  await expect(page.getByRole("row").nth(1)).toContainText("February");
  await page.getByLabel("Filter records", { exact: true }).fill("January");
  await expect(page.getByRole("row")).toHaveCount(2);
  await page.getByRole("button", { name: "Cards", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "January", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("900", { exact: true })).toBeVisible();
  await page.getByLabel("Filter records", { exact: true }).fill("");
  await expect(
    page.getByRole("heading", { name: "February", exact: true }),
  ).toBeVisible();
});

test("branch isolation, comparison, and full history restore", async ({
  page,
}) => {
  await create(page);
  await addBook(page, "Original book");
  await page.getByRole("button", { name: "Fork branch", exact: true }).click();
  await page.getByLabel("Branch name", { exact: true }).fill("Experiment");
  await page
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit Original book" }).click();
  await page.getByLabel("Book", { exact: true }).fill("Branch book");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await page
    .getByLabel("Active branch", { exact: true })
    .selectOption({ label: "⑂ main" });
  await expect(
    page.getByRole("row").filter({ hasText: "Original book" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Branch book" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "History & restore" }).click();
  await page
    .getByLabel("Compare with branch")
    .selectOption({ label: "Experiment" });
  await expect(
    page.getByText("Reading records: 0 added, 0 removed, 1 changed"),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Restore design + records" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Branch book" }),
  ).toBeVisible();
});

test("corrupt and legacy imports keep existing records; native fixture needs approval", async ({
  page,
}) => {
  await create(page);
  await addBook(page, "Never reset");
  await page.getByRole("button", { name: "Backups & recovery" }).click();
  const input = page.getByLabel("Choose backup (maximum 5 MB)");
  await input.setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  await expect(page.getByRole("alert")).toContainText("not valid JSON");
  await input.setInputFiles(
    path.resolve("tests/fixtures/legacy-envelope-unverified.json"),
  );
  await expect(page.getByRole("alert")).toContainText(
    "Legacy v8 backups are not supported yet",
  );
  await input.setInputFiles(path.resolve("tests/fixtures/native-v2.json"));
  await expect(
    page.getByRole("heading", { name: "Preview replacement" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Never reset" }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Approve backup replacement" })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "A synthetic book" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Backups & recovery" }).click();
  await page
    .getByRole("button", { name: "Preview previous pre-import recovery copy" })
    .click();
  await page
    .getByRole("button", { name: "Approve backup replacement" })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "Never reset" }),
  ).toBeVisible();
});

test("stale concurrent writes fail without losing another tab’s edit", async ({
  page,
  context,
}) => {
  await create(page);
  await addBook(page, "Shared book");
  const other = await context.newPage();
  await other.goto("/");
  await expect(
    other.getByRole("row").filter({ hasText: "Shared book" }),
  ).toBeVisible();
  await other.getByRole("button", { name: "Edit Shared book" }).click();
  await other.getByLabel("Book", { exact: true }).fill("Stale edit");
  await page.getByRole("button", { name: "Edit Shared book" }).click();
  await page.getByLabel("Book", { exact: true }).fill("Winner");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await other.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(other.getByRole("alert")).toContainText("Another tab changed");
  await other.getByRole("button", { name: "Close dialog" }).click();
  await other.reload();
  await expect(
    other.getByRole("row").filter({ hasText: "Winner" }),
  ).toBeVisible();
  await expect(
    other.getByRole("row").filter({ hasText: "Stale edit" }),
  ).toHaveCount(0);
});

test("tablet and narrow layouts have no page overflow and keyboard-operable dialogs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await create(page);
  await addBook(page, "Tablet book");
  await expect(
    page.getByRole("button", { name: "Toggle workspace explorer" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Edit Tablet book" }).click();
  await expect(page.getByLabel("Book", { exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("installed service worker loads the app and stored records offline", async ({
  page,
  context,
}) => {
  await create(page);
  await addBook(page, "Offline book");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "Offline book" }),
  ).toBeVisible();
  await addBook(page, "Written offline");
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "Written offline" }),
  ).toBeVisible();
  await context.setOffline(false);
});

test("design-only restore keeps current values while full restore recovers historical values", async ({
  page,
}) => {
  await create(page);
  await addBook(page, "Historical title");
  await apply(page, "Reading Speed = Pages Read / Minutes Read");
  await page.getByRole("button", { name: "Edit Historical title" }).click();
  await page.getByLabel("Book", { exact: true }).fill("Current title");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await page.getByRole("button", { name: "History & restore" }).click();
  await page.getByRole("button", { name: /^Added record to Reading/ }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Restore design only" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Current title" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: /Reading Speed/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "History & restore" }).click();
  await page.getByRole("button", { name: /^Added record to Reading/ }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Restore design + records" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Historical title" }),
  ).toBeVisible();
});

test("real relations display linked records and reject unsafe target deletion", async ({
  page,
}) => {
  await create(page);
  await addBook(page, "The Left Hand of Darkness");
  await page
    .getByRole("button", { name: "New collection", exact: true })
    .click();
  await page.getByLabel("Collection name", { exact: true }).fill("Authors");
  await page.getByRole("button", { name: "Preview collection" }).click();
  await page.getByRole("button", { name: "Approve & apply" }).click();
  await page.getByRole("button", { name: /▤ Authors/ }).click();
  await page
    .getByRole("button", { name: "Add record", exact: false })
    .first()
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Ursula Le Guin");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await page.getByRole("button", { name: /▤ Reading/ }).click();
  await page
    .getByRole("button", { name: "Field", exact: false })
    .filter({ hasText: "Field" })
    .click();
  await page.getByLabel("Field name", { exact: true }).fill("Author");
  await page.getByLabel("Field type").selectOption("relation");
  await page
    .getByLabel("Related collection")
    .selectOption({ label: "Authors" });
  await page.getByRole("button", { name: "Preview field" }).click();
  await page.getByRole("button", { name: "Approve & apply" }).click();
  await page
    .getByRole("button", { name: "Edit The Left Hand of Darkness" })
    .click();
  await page
    .getByLabel("Author", { exact: true })
    .selectOption({ label: "Ursula Le Guin" });
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "The Left Hand of Darkness" }),
  ).toContainText("Ursula Le Guin");
  await page.getByRole("button", { name: /▤ Authors/ }).click();
  await page.getByRole("button", { name: "Edit Ursula Le Guin" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete record", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Remove its references");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Ursula Le Guin" }),
  ).toBeVisible();
});

test("unavailable storage shows recovery without inventing a blank workspace", async ({
  page,
}) => {
  await page.addInitScript(() => {
    indexedDB.open = () => {
      throw new DOMException("Storage unavailable", "SecurityError");
    };
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your data comes first." }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Storage unavailable");
  await expect(
    page.getByRole("button", { name: "Create your first workspace" }),
  ).toHaveCount(0);
});

test("quota write failure keeps the last saved record across reload", async ({
  page,
}) => {
  await create(page);
  await addBook(page, "Keep this saved value");
  await page
    .getByRole("button", { name: "Edit Keep this saved value" })
    .click();
  await page.getByLabel("Book", { exact: true }).fill("Must not be saved");
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
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Storage quota exceeded");
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "Keep this saved value" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Must not be saved" }),
  ).toHaveCount(0);
});

test("corrupt stored state can be exported raw and replaced with a validated backup", async ({
  page,
}) => {
  await create(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("morph-infinity-2", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("documents", "readwrite");
      tx.objectStore("documents").put(
        { damaged: true, preserve: "original bytes" },
        "current",
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your data comes first." }),
  ).toBeVisible();
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download raw recovery copy" })
    .click();
  const file = await event;
  expect(JSON.parse(await readFile((await file.path())!, "utf8")).raw).toEqual({
    damaged: true,
    preserve: "original bytes",
  });
  await page
    .getByLabel("Choose a known-good native backup")
    .setInputFiles(path.resolve("tests/fixtures/native-v2.json"));
  await page.getByRole("button", { name: "Restore this backup" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "A synthetic book" }),
  ).toBeVisible();
});
