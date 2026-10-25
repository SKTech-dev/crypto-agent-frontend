import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App, Dashboard, History, SettingsPage } from "./App";

vi.mock("./charts", () => ({
  EquityChart: () => <div>Equity chart</div>,
  PeriodChart: () => <div>P&L chart</div>,
  CandleChart: () => <div>Candles</div>,
}));
const bot = {
  status: "STOPPED",
  heartbeat: null,
  last_candle: null,
  error: null,
  risk_halt: false,
  settings: {},
};
const overview = {
  portfolio: {
    initial: "100",
    cash: "100",
    btc: "0",
    basis: "0",
    realized: "0",
    fees: "0",
    slippage: "0",
    peak: "100",
    started_at: 0,
  },
  bot,
  price: "100000",
  market_timestamp: Date.now(),
  equity: "100",
  realized_pnl: "0",
  unrealized_pnl: "0",
  today_pnl: "-1",
  month_pnl: "-2",
  lifetime_pnl: "0",
  return_percent: "0",
  ai_cost: "0.02",
  ai_reserved: "0",
  economic_pnl: "-0.02",
  closed_trades: 0,
  winning_trades: 0,
  losing_trades: 0,
  win_rate: "0",
  max_drawdown: "0",
  recent_decision: null,
  recent_fills: [],
  benchmarks: { buy_hold: null, ema_signal: null },
};
const settings = {
  bot,
  mode: "paper",
  automation_enabled: true,
  initial_capital: "100",
  model: "gpt-4.1",
  available_models: [
    {
      model: "gpt-4.1",
      label: "GPT-4.1",
      input_per_million: "2.00",
      output_per_million: "8.00",
      currency: "USD",
      tier: "standard",
      verified_at: "2026-10-25",
      pricing_version: "test",
      source_url: "https://developers.openai.com/api/docs/models/gpt-4.1",
      lifecycle: "deprecated",
    },
    {
      model: "gpt-4.1-mini",
      label: "GPT-4.1 mini",
      input_per_million: "0.40",
      output_per_million: "1.60",
      currency: "USD",
      tier: "standard",
      verified_at: "2026-10-25",
      pricing_version: "test",
      source_url: "https://developers.openai.com/api/docs/models/gpt-4.1-mini",
      lifecycle: "deprecated",
    },
  ],
  daily_ai_budget: "1",
  daily_ai_spent_or_reserved: "0",
  risk: { stop_loss: "0.02" },
  protective_policy: "Protective exits remain active while paused.",
};
function mount(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.restoreAllMocks();
});
describe("private dashboard", () => {
  it("allows model selection while running and explains how to apply it", async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ...settings, bot: { ...bot, status: "RUNNING" } }),
    }));
    vi.stubGlobal("fetch", fetch);
    mount(<SettingsPage />);
    const selector = await screen.findByRole("combobox", { name: "AI model" });
    expect(selector).toBeEnabled();
    fireEvent.change(selector, { target: { value: "gpt-4.1-mini" } });
    expect(selector).toHaveValue("gpt-4.1-mini");
    expect(
      screen.getByLabelText("Estimated input USD / million tokens"),
    ).toHaveValue("0.40");
    expect(screen.getByRole("button", { name: "Save model" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Active: gpt-4.1");
    fireEvent.click(
      screen.getByRole("button", { name: "Pause bot to enable saving" }),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/bot/pause"),
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/settings/model"),
      expect.anything(),
    );
  });
  it("automatically displays the selected model price and saves only the model", async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => settings }));
    vi.stubGlobal("fetch", fetch);
    mount(<SettingsPage />);
    const model = await screen.findByRole("combobox", { name: "AI model" });
    expect(
      screen.getByLabelText("Estimated input USD / million tokens"),
    ).toHaveValue("2.00");
    fireEvent.change(model, { target: { value: "gpt-4.1-mini" } });
    expect(
      screen.getByLabelText("Estimated input USD / million tokens"),
    ).toHaveValue("0.40");
    expect(
      screen.getByLabelText("Estimated output USD / million tokens"),
    ).toHaveValue("1.60");
    expect(
      screen.getByLabelText("Estimated input USD / million tokens"),
    ).toHaveAttribute("readonly");
    fireEvent.click(screen.getByRole("button", { name: "Save model" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/settings/model"),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ model: "gpt-4.1-mini" }),
        }),
      ),
    );
  });
  it("blocks saving a model when verified pricing is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ...settings, available_models: [] }),
      })),
    );
    mount(<SettingsPage />);
    expect(
      await screen.findByRole("button", { name: "Save model" }),
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Verified pricing is unavailable",
    );
  });
  it("requires an operator token before showing private data", () => {
    mount(<App />);
    expect(screen.getByLabelText("Operator access token")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.queryByText("Portfolio overview")).not.toBeInTheDocument();
  });
  it("renders actual portfolio and separates AI expense", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          url.endsWith("/overview")
            ? overview
            : { snapshots: [], daily: [], monthly: [] },
      })),
    );
    mount(<Dashboard />);
    expect(await screen.findByText("Portfolio overview")).toBeInTheDocument();
    expect(screen.getByText("-1.00 USDT")).toHaveClass("negative");
    expect(screen.getByText("AI inference cost")).toBeInTheDocument();
    expect(screen.getByText("$0.0200")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No simulated fills yet. Trades appear here when evidence and risk policy permit.",
      ),
    ).toBeInTheDocument();
  });
  it("shows recorded HOLD reasoning and opens the original evidence", async () => {
    const d = {
      id: "d1",
      timestamp: 1700000000000,
      action: "HOLD",
      status: "COMPLETED",
      reason: "Conflicting momentum; no entry.",
      strategy: "btc_multi_agent_v1",
      prompt_version: "agents_v1",
      proposal: {},
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          url.endsWith("/positions")
            ? []
            : url.endsWith("/d1")
              ? {
                  decision: d,
                  market: null,
                  agents: [],
                  risk: null,
                  fill: null,
                }
              : [d],
      })),
    );
    mount(<History />);
    expect(await screen.findByText(d.reason)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Inspect decision d1"));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByText("Recorded explanation")).toBeInTheDocument();
  });
  it("sends START to the backend and disables invalid controls", async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => settings }));
    vi.stubGlobal("fetch", fetch);
    mount(<SettingsPage />);
    const start = await screen.findByRole("button", { name: "START" });
    expect(screen.getByRole("button", { name: "RESUME" })).toBeDisabled();
    fireEvent.click(start);
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/bot/start"),
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
  it("does not show fabricated market data when the API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({ detail: "Worker not initialized" }),
      })),
    );
    mount(<Dashboard />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Worker not initialized",
    );
    expect(screen.queryByText("100,000.00")).not.toBeInTheDocument();
  });
});
