// Local development only; reads the operator token directly without logging it.
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
const env = await readFile("../crypto-agent-backend/.env", "utf8");
const match = env.match(/^OPERATOR_TOKEN\s*=\s*['"]?([^'"\r\n]+)['"]?\s*$/m);
if (!match)
  throw new Error("Configure local operator token before browser smoke");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.name));
  await page.goto("http://localhost:5173");
  await page.getByLabel("Operator access token").fill(match[1]);
  await page.getByRole("button", { name: "Open research dashboard" }).click();
  await page.getByRole("heading", { name: "Portfolio overview" }).waitFor();
  await page.getByText("TOTAL PORTFOLIO EQUITY").waitFor();
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/dashboard.png", fullPage: true });
  await page.getByRole("link", { name: "BTC market", exact: true }).click();
  await page.getByRole("heading", { name: "Bitcoin market" }).waitFor();
  await page
    .getByRole("heading", { name: "BTCUSDT · 15 minute candles" })
    .waitFor();
  await page.locator("canvas").first().waitFor();
  await page.screenshot({ path: "artifacts/market.png", fullPage: true });
  await page.getByRole("link", { name: "Decisions & trades" }).click();
  await page.getByRole("heading", { name: "Decision journal" }).waitFor();
  await page
    .getByRole("button", { name: /Inspect decision/ })
    .first()
    .click();
  await page.getByText("Recorded explanation").waitFor();
  await page.getByLabel("Close decision").click();
  await page.getByRole("link", { name: "Bot settings" }).click();
  await page
    .getByRole("heading", { name: "Bot settings", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "START", exact: true }).waitFor();
  if (
    !(await page
      .getByRole("button", { name: "START", exact: true })
      .isDisabled())
  )
    throw new Error("Smoke expects disabled automation");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Overview" }).click();
  await page.getByRole("heading", { name: "Portfolio overview" }).waitFor();
  await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
  if (errors.length)
    throw new Error(`Browser runtime errors: ${errors.join(", ")}`);
  console.log(
    "PASS: private login, real portfolio, charts, decisions/detail, disabled controls, responsive layout; no runtime errors",
  );
} finally {
  await browser.close();
}
