import { chromium, webkit, expect } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
const url =
  process.env.MORPH_PREVIEW_URL ??
  "https://spacecurve88-ai.github.io/Morph-Infinity-2.0/";
const target = new URL(url);
if (
  target.protocol !== "https:" &&
  !["localhost", "127.0.0.1"].includes(target.hostname)
)
  throw new Error("Remote deployment checks require HTTPS.");
const expected = process.env.MORPH_EXPECTED_SOURCE_SHA;
if (expected) {
  let matched = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const marker = new URL("deployment.json", url);
      marker.searchParams.set("verify", expected);
      const response = await fetch(marker, { cache: "no-store" });
      if (response.ok && (await response.json()).sourceCommit === expected) {
        matched = true;
        break;
      }
    } catch {
      /* Publication may still be propagating. */
    }
    console.log(
      `Waiting for Pages source ${expected}, attempt ${attempt + 1}/30`,
    );
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  if (!matched)
    throw new Error(`Pages has not published expected source ${expected}.`);
}
const output = process.env.MORPH_REPORT_DIR ?? "test-results/deployment";
mkdirSync(output, { recursive: true });
const results = [];
for (const engine of (
  process.env.MORPH_BROWSER_ENGINES ?? "chromium,webkit"
).split(",")) {
  const type = { chromium, webkit }[engine];
  if (!type) throw new Error(`Unknown browser ${engine}`);
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
        }),
        page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      try {
        const response = await page.goto(url, { waitUntil: "networkidle" });
        expect(response?.status()).toBe(200);
        expect(page.url().startsWith(url)).toBe(true);
        const approve = async () => {
          await page
            .getByRole("button", { name: "Approve & apply", exact: true })
            .click();
          await expect(page.getByRole("dialog")).toHaveCount(0);
        };
        await page
          .getByRole("button", { name: "Create your first workspace" })
          .click();
        await page
          .getByLabel("Workspace name", { exact: true })
          .fill("Deployment verification");
        await page
          .getByRole("button", { name: "Create workspace", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await page
          .getByRole("button", { name: /Reading tracker Books/ })
          .click();
        await approve();
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
        await approve();
        await page.reload({ waitUntil: "networkidle" });
        await expect(
          page
            .locator("tbody tr")
            .filter({ hasText: "Preview persistence check" })
            .locator("td")
            .nth(4),
        ).toHaveText("3");
        await page.getByRole("button", { name: /Rules & simulations/ }).click();
        await page
          .getByRole("button", {
            name: "Preview economic example",
            exact: true,
          })
          .click();
        await approve();
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          "Companies.",
        );
        await page
          .getByRole("button", { name: "Fork branch", exact: true })
          .click();
        await page
          .getByLabel("Branch name", { exact: true })
          .fill("Simulation check");
        await page
          .getByRole("button", { name: "Create branch", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        const showCompanies = async () => {
          if (
            (await page.getByRole("heading", { level: 1 }).textContent()) ===
            "Companies."
          )
            return;
          const nav = page
            .locator("nav button")
            .filter({ hasText: "Companies" });
          if (!(await nav.isVisible()) || (await nav.boundingBox())?.x < 0)
            await page
              .getByRole("button", { name: "Toggle workspace explorer" })
              .click();
          await nav.click();
        };
        const company = (name = "Company A") =>
          page.locator("tbody tr").filter({ hasText: name });
        const simulate = async () => {
          await page.getByLabel("Simulation steps", { exact: true }).fill("5");
          await page
            .getByRole("button", { name: "Preview simulation", exact: true })
            .click();
          await expect(
            page.getByText("5 steps previewed", { exact: false }),
          ).toBeVisible();
        };
        await simulate();
        await page
          .getByRole("button", { name: "Cancel change", exact: true })
          .click();
        await expect(company().locator("td").nth(1)).toHaveText("10");
        await simulate();
        await approve();
        await expect(company().locator("td").nth(1)).toHaveText("-2");
        await expect(company()).toContainText("Bankrupt");
        await expect(company("Company B").locator("td").nth(1)).toHaveText(
          "18",
        );
        await page
          .getByLabel("Active branch", { exact: true })
          .selectOption({ label: "⑂ main" });
        await expect(company().locator("td").nth(1)).toHaveText("10");
        await page
          .getByLabel("Active branch", { exact: true })
          .selectOption({ label: "⑂ Simulation check" });
        await expect(company().locator("td").nth(1)).toHaveText("-2");
        await page.getByRole("button", { name: /revisions/ }).click();
        await page
          .getByRole("button", { name: /^Add economic example/ })
          .click();
        page.once("dialog", (d) => d.accept());
        await page
          .getByRole("button", { name: "Restore design + records" })
          .click();
        await expect(company().locator("td").nth(1)).toHaveText("10");
        await simulate();
        await approve();
        await page.reload({ waitUntil: "networkidle" });
        await showCompanies();
        await expect(company()).toContainText("Bankrupt");
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
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
        await showCompanies();
        await expect(company()).toContainText("Bankrupt");
        expect(errors).toEqual([]);
        await page.screenshot({
          path: `${output}/${engine}-${viewport.width}.png`,
          fullPage: true,
        });
        const result = {
          url,
          engine,
          viewport,
          status: "passed",
          httpStatus: 200,
          expectedSource: expected ?? null,
          readingCalculation: 3,
          reloadPersistence: true,
          simulation: {
            steps: 5,
            cashA: -2,
            stateA: "Bankrupt",
            cashB: 18,
            cancelPreservesData: true,
            branchIsolation: true,
            fullRestore: true,
          },
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
