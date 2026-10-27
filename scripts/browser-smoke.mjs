// Local UI verification only. Reads the private token without logging it; never submits controls.
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
const origin = new URL(process.argv[2] || "http://127.0.0.1:5174");
assert(
  ["localhost", "127.0.0.1"].includes(origin.hostname),
  "Local frontend required",
);
const env = await readFile("../crypto-agent-backend/.env", "utf8");
const match = env.match(/^OPERATOR_TOKEN\s*=\s*['"]?([^'"\r\n]+)['"]?\s*$/m);
assert(
  match,
  "Configure the private local operator token before browser verification",
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.name));
  page.on("requestfailed", (request) => {
    if (request.url().includes("/api/"))
      errors.push(`Network failure ${new URL(request.url()).pathname}`);
  });
  page.on("response", (response) => {
    if (response.url().includes("/api/") && response.status() >= 400)
      errors.push(
        `API ${response.status()} ${new URL(response.url()).pathname}`,
      );
  });
  await page.goto(origin.href);
  await page.getByLabel("Operator access token").fill(match[1]);
  await page.getByRole("button", { name: "Open research dashboard" }).click();
  await page.getByRole("heading", { name: /portfolio overview/i }).waitFor();
  const futures = await page
    .getByRole("heading", { name: "Futures portfolio overview" })
    .count();
  await mkdir("artifacts", { recursive: true });
  const routes = [
    ["overview", "Overview", /portfolio overview/i],
    [
      "market",
      futures ? "BTC futures" : "BTC market",
      futures ? "Bitcoin perpetual Futures" : "Bitcoin market",
    ],
    ["history", "Decisions & trades", "Decision journal"],
    [
      "settings",
      "Bot settings",
      futures ? "Futures bot settings" : "Bot settings",
    ],
  ];
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, link, heading] of routes) {
      await page.getByRole("link", { name: link, exact: true }).click();
      await page.getByRole("heading", { name: heading, exact: true }).waitFor();
      await page.waitForLoadState("networkidle");
      if (name === "history") {
        await page
          .getByRole("button", { name: "Inspect decision" })
          .first()
          .or(page.getByText("No decisions recorded for this portfolio yet."))
          .waitFor();
      }
      const geometry = await page.evaluate(() => ({
        viewport: globalThis.window.innerWidth,
        document: globalThis.document.documentElement.scrollWidth,
        panelPadding: [
          ...globalThis.document.querySelectorAll(".futures-page .panel-body"),
        ].map((el) =>
          Number.parseFloat(globalThis.getComputedStyle(el).paddingLeft),
        ),
      }));
      assert(
        geometry.document <= geometry.viewport + 1,
        `${name} at ${width}px overflows: ${geometry.document}px`,
      );
      assert(
        geometry.panelPadding.every((value) => value >= 18),
        `${name}: card body padding missing`,
      );
      if (name === "overview") {
        await page.getByText("TOTAL PORTFOLIO EQUITY").waitFor();
        assert.equal(await page.locator(".hero-grid .equity-card").count(), 1);
        assert.equal(await page.locator(".hero-grid .btc-card").count(), 1);
      }
      if (futures && name === "settings") {
        for (const row of await page.locator(".form-row").all()) {
          const select = await row.locator("select").boundingBox();
          const button = await row.locator("button").boundingBox();
          if (width > 600)
            assert(
              Math.abs(select.y + select.height - button.y - button.height) <=
                1,
              "Select and save button are misaligned",
            );
        }
      }
      await page.screenshot({
        path: `artifacts/${name}-${width}.png`,
        fullPage: true,
      });
      if (
        futures &&
        name === "history" &&
        width === 1440 &&
        (await page.getByRole("button", { name: "Inspect decision" }).count())
      ) {
        await page
          .getByRole("button", { name: "Inspect decision" })
          .first()
          .click();
        await page
          .getByRole("dialog", { name: "Futures decision evidence" })
          .waitFor();
        await page
          .getByRole("heading", { name: "Deterministic execution risk" })
          .waitFor();
        await page.screenshot({
          path: "artifacts/decision-detail.png",
          fullPage: true,
        });
        await page.getByRole("button", { name: "Close", exact: true }).click();
      }
      console.log(
        `PASS ${name} ${width}px: contained layout and padded panels`,
      );
    }
  }
  assert.deepEqual(
    errors,
    [],
    "No browser exceptions or API failures expected",
  );
  console.log(
    "PASS: four pages at three widths, original overview hierarchy, aligned controls; no bot controls submitted",
  );
} finally {
  await browser.close();
}
