import { chromium, webkit, expect } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const url =
  process.env.MORPH_PREVIEW_URL ??
  "https://spacecurve88-ai.github.io/Morph-Infinity-2.0/";
const target = new URL(url);
if (
  target.protocol !== "https:" &&
  !["localhost", "127.0.0.1"].includes(target.hostname)
) {
  throw new Error("Remote deployment checks require HTTPS.");
}
const engines = (process.env.MORPH_BROWSER_ENGINES ?? "chromium,webkit").split(
  ",",
);
const output = process.env.MORPH_REPORT_DIR ?? "test-results/deployment";
mkdirSync(output, { recursive: true });
const results = [];
for (const engine of engines) {
  const type = { chromium, webkit }[engine];
  if (!type) throw new Error(`Unknown browser: ${engine}`);
  const browser = await type.launch(
    engine === "chromium" && existsSync("/usr/bin/chromium")
      ? { executablePath: "/usr/bin/chromium" }
      : {},
  );
  try {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
    ]) {
      const context = await browser.newContext({
        viewport,
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        const response = await page.goto(url, { waitUntil: "networkidle" });
        expect(response?.status(), "public page status").toBe(200);
        expect(
          page.url().startsWith(url),
          "preview stays on its own origin and path",
        ).toBe(true);
        await page
          .getByRole("button", { name: "Create your first workspace" })
          .click();
        await page
          .getByLabel("Workspace name", { exact: true })
          .fill("Deployment smoke check");
        await page
          .getByRole("button", { name: "Create workspace", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await page
          .getByRole("button", { name: /Reading tracker Books/ })
          .click();
        await page.getByRole("button", { name: "Approve & apply" }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await page
          .getByRole("button", { name: "Add record", exact: false })
          .first()
          .click();
        await page
          .getByLabel("Book", { exact: true })
          .fill("Preview persistence check");
        await page.getByLabel("Pages Read", { exact: true }).fill("90");
        await page.getByLabel("Minutes Read", { exact: true }).fill("30");
        await page
          .getByRole("button", { name: "Save record", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await page
          .getByLabel("Describe a change")
          .fill("Reading Speed = Pages Read / Minutes Read");
        await page.getByRole("button", { name: "Preview change" }).click();
        await page.getByRole("button", { name: "Approve & apply" }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await page.reload({ waitUntil: "networkidle" });
        const row = page
          .getByRole("row")
          .filter({ hasText: "Preview persistence check" });
        await expect(row).toBeVisible();
        await expect(row.locator("td").nth(4)).toHaveText("3");
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "no page overflow",
        ).toBe(true);
        await expect
          .poll(
            () =>
              page.evaluate(async () =>
                (await navigator.serviceWorker.getRegistrations()).some(
                  (r) => r.active?.state === "activated",
                ),
              ),
            { timeout: 15000 },
          )
          .toBe(true);
        await page.reload({ waitUntil: "networkidle" });
        await expect
          .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
          .toBe(true);
        await context.setOffline(true);
        await page.reload();
        await expect(
          page
            .getByRole("row")
            .filter({ hasText: "Preview persistence check" }),
        ).toBeVisible();
        expect(errors, "JavaScript errors").toEqual([]);
        await page.screenshot({
          path: `${output}/${engine}-${viewport.width}.png`,
          fullPage: true,
        });
        const result = {
          url,
          engine,
          viewport,
          status: "passed",
          httpStatus: response.status(),
          reloadPersistence: true,
          computedValue: 3,
          offlineReload: true,
          pageOverflow: false,
          pageErrors: errors,
        };
        results.push(result);
        console.log(JSON.stringify(result));
      } catch (error) {
        await page
          .screenshot({
            path: `${output}/${engine}-${viewport.width}-failure.png`,
            fullPage: true,
          })
          .catch(() => {});
        throw error;
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    writeFileSync(
      `${output}/results.json`,
      JSON.stringify(results, null, 2) + "\n",
    );
  }
}
