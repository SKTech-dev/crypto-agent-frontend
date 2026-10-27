import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { App } from "./App";
import {
  FuturesDashboard,
  FuturesHistory,
  FuturesMarketPage,
  FuturesSettingsPage,
} from "./futures";

vi.mock("./charts", () => ({
  EquityChart: ({ futures }: { futures?: boolean }) => (
    <div>{futures ? "Futures comparison chart" : "Spot chart"}</div>
  ),
  CandleChart: () => <div>Futures candles</div>,
  PeriodChart: () => <div>Period marks</div>,
}));

const bot = {
  status: "STOPPED",
  heartbeat: Date.now(),
  error: null,
  funding_status: "RECONCILED",
  protection: { status: "MONITORING" },
};
const settings = {
  research_mode: "futures",
  bot,
  run_key: "test-futures",
  automation_enabled: true,
  initial_capital: "100",
  risk: {
    leverage: 2,
    margin_mode: "ISOLATED",
    margin_allocation: ".20",
    max_notional: ".40",
    tiers: null,
  },
  max_leverage: 3,
  tier_status: "UNAVAILABLE_ENTRIES_DISABLED",
  model: "gpt-4.1",
  available_models: [
    {
      model: "gpt-4.1",
      label: "GPT-4.1",
      input_per_million: "2",
      cached_input_per_million: ".5",
      output_per_million: "8",
      verified_at: "2026-10-26",
    },
  ],
  daily_ai_budget: "1",
  daily_ai_spent_or_reserved: ".02",
  protective_policy: "Protection remains active while paused.",
  protection_events: [],
};
const overview = {
  portfolio: { initial: "100" },
  run_key: "test-futures",
  bot,
  position: null,
  position_side: "FLAT",
  wallet: "100",
  free_balance: "100",
  margin: "0",
  equity: "100",
  mark: "80000",
  market_timestamp: Date.now(),
  unrealized_pnl: "0",
  realized_pnl: "0",
  funding: "-0.002",
  fees: ".01",
  liquidation_fees: "0",
  today_pnl: "0",
  month_pnl: "0",
  lifetime_pnl: "0",
  return_percent: "0",
  ai_cost: ".02",
  economic_pnl: "-.02",
  closed_trades: 0,
  winning_trades: 0,
  liquidations: 0,
  max_drawdown: "0",
  recent_decision: null,
  deterministic_equity: "100",
  benchmark_assumptions:
    "Identical risk and execution assumptions; shared quote observations.",
  liquidation_assumptions: "Approximate isolated mark settlement.",
};
function mount(element: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}
function fetchData(values: Record<string, unknown>) {
  const fetch = vi.fn(async (url: string) => {
    const path = url.split("/api/")[1];
    return {
      ok: true,
      json: async () => values[path] ?? values[path.split("?")[0]],
    };
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
beforeEach(() => vi.restoreAllMocks());

it("uses futures routes after operator login", async () => {
  fetchData({
    settings,
    overview,
    performance: { snapshots: [], daily: [], monthly: [] },
  });
  mount(<App />);
  fireEvent.change(screen.getByLabelText("Operator access token"), {
    target: { value: "fixture-token" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: /Open research dashboard/ }),
  );
  expect(
    await screen.findByText("Futures portfolio overview"),
  ).toBeInTheDocument();
  expect(screen.queryByText("BTC holdings")).not.toBeInTheDocument();
});

it("distinguishes wallet, free collateral, reserved margin and equity", async () => {
  fetchData({
    overview: {
      ...overview,
      wallet: "99",
      free_balance: "89",
      margin: "10",
      equity: "102",
    },
    performance: { snapshots: [], daily: [], monthly: [] },
  });
  mount(<FuturesDashboard />);
  expect(await screen.findByText("$102.00")).toBeInTheDocument();
  expect(screen.getByText("99.00 USDT")).toBeInTheDocument();
  expect(screen.getByText("89.00 USDT")).toBeInTheDocument();
  expect(screen.getByText("Futures comparison chart")).toBeInTheDocument();
  expect(screen.queryByText("BTC hold")).not.toBeInTheDocument();
});

it("blocks leverage changes while running and shows unavailable tier evidence", async () => {
  fetchData({ settings: { ...settings, bot: { ...bot, status: "RUNNING" } } });
  mount(<FuturesSettingsPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "New entries are disabled",
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Leverage" }), {
    target: { value: "3" },
  });
  expect(screen.getByRole("button", { name: "Save leverage" })).toBeDisabled();
});

it("saves explicit operator leverage within the cap", async () => {
  const fetch = fetchData({ settings });
  mount(<FuturesSettingsPage />);
  fireEvent.change(await screen.findByRole("combobox", { name: "Leverage" }), {
    target: { value: "3" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save leverage" }));
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/settings/leverage"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ leverage: 3 }),
      }),
    ),
  );
});

it("reports quote freshness separately from a fresh mark", async () => {
  fetchData({
    market: {
      quote: { bid: "80000", ask: "80001" },
      quote_timestamp: Date.now() - 120000,
      latest_mark: {
        mark: "80002",
        index: "80000",
        mark_time: Date.now(),
        funding_rate: ".0001",
        next_funding_time: Date.now() + 10000,
      },
      candles: [],
      candle_timestamp: Date.now() - 900000,
    },
  });
  mount(<FuturesMarketPage />);
  expect(
    await screen.findByText("Executable book quote is stale or unavailable."),
  ).toBeInTheDocument();
  expect(
    screen.queryByText("Mark-price evidence is stale or unavailable."),
  ).not.toBeInTheDocument();
});

it("shows short actions, rejected sizing and funding transfers in the audit journal", async () => {
  const decision = {
    id: "future-1",
    timestamp: Date.now(),
    action: "OPEN_SHORT",
    status: "NO_EXECUTABLE_TRADE",
    reason: "Minimum notional exceeds safe size",
    strategy: "btc_perpetual_v1",
    prompt_version: "futures_agents_v1",
    ready_at: null,
    evidence: {},
    proposal: {},
    risk: {
      outcome: "NO_EXECUTABLE_TRADE",
      quantity: "0",
      proposed_quantity: ".001",
      leverage: 2,
      reasons: ["Minimum notional exceeds safe size"],
    },
  };
  fetchData({
    decisions: [decision],
    positions: [],
    funding: [
      {
        id: "f1",
        position_id: "p1",
        settlement_time: Date.now(),
        rate: ".0001",
        amount: "-.002",
        shortfall: "0",
        late_reconciliation: true,
      },
    ],
    "decisions/future-1": {
      decision,
      agents: [],
      fill: null,
      protection_events: [],
    },
  });
  mount(<FuturesHistory />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Inspect decision" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("dialog")).toHaveTextContent("approved 0 BTC"),
  );
  expect(screen.getByText("-0.002000")).toBeInTheDocument();
  expect(screen.getByText("Late history recovery")).toBeInTheDocument();
});

it("keeps unresolved protective intents visible", async () => {
  fetchData({
    overview: {
      ...overview,
      bot: {
        ...bot,
        protection: {
          status: "UNRESOLVED",
          error: "Full exit blocked by liquidity",
        },
      },
    },
    performance: { snapshots: [], daily: [], monthly: [] },
  });
  mount(<FuturesDashboard />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Full exit blocked by liquidity",
  );
});

it.each([false, true])(
  "explains skipped evidence without fabricated sizing (gate recorded: %s)",
  async (recorded) => {
    const decision = {
      id: "skipped-1",
      timestamp: Date.now(),
      ready_at: null,
      action: "NO_DECISION",
      status: "SKIPPED",
      reason: "Analysis skipped",
      strategy: "btc_perpetual_v1",
      prompt_version: "futures_agents_v1",
      evidence: {
        eligibility: {
          action: "HOLD",
          combination: "ALL",
          checks: [],
          directions: {
            LONG: [
              {
                rule: "EMA_1H",
                passed: false,
                condition: "Directional 1h EMA12/26",
                observed: { ema12: "80012", ema26: "80023" },
              },
            ],
          },
        },
        ...(recorded
          ? {
              operational_gate: {
                allowed: false,
                evaluated_at: Date.now(),
                reasons: ["bot is STOPPED", "paper automation is disabled"],
              },
            }
          : {}),
      },
      proposal: {},
      risk: {},
    };
    fetchData({
      decisions: [decision],
      positions: [],
      funding: [],
      "decisions/skipped-1": {
        decision,
        agents: [],
        fill: null,
        protection_events: [],
      },
    });
    mount(<FuturesHistory />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Inspect decision" }),
    );
    await screen.findByText(
      "Rule result: HOLD. This is strategy evidence, not execution approval.",
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("LONG: 0/1 checks passed");
    expect(dialog).toHaveTextContent("EMA_1H: Not met");
    expect(dialog).toHaveTextContent(
      recorded
        ? "bot is STOPPED; paper automation is disabled"
        : "Exact operational gate flags were not recorded",
    );
    expect(dialog).toHaveTextContent("No order sizing was evaluated.");
    expect(dialog).toHaveTextContent("No agent analysis was recorded");
    expect(dialog).not.toHaveTextContent("approved 0 BTC");
    expect(dialog).not.toHaveTextContent("Completed:");
  },
);

it("explains disabled automation while keeping pause and stop available", async () => {
  fetchData({
    settings: {
      ...settings,
      automation_enabled: false,
      bot: { ...bot, status: "RUNNING" },
    },
  });
  mount(<FuturesSettingsPage />);
  expect(await screen.findByRole("button", { name: "START" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "RESUME" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "PAUSE" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "STOP" })).toBeEnabled();
  expect(screen.getByText(/Set AUTO_TRADING_ENABLED=true/)).toBeInTheDocument();
});

it("runs start, pause, resume and stop through the API and refreshes control state", async () => {
  let status = "STOPPED";
  const transitions: Record<string, string> = {
    start: "RUNNING",
    pause: "PAUSED",
    resume: "RUNNING",
    stop: "STOPPED",
  };
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.split("/api/")[1];
    if (path.startsWith("bot/")) {
      expect(init?.method).toBe("POST");
      status = transitions[path.split("/")[1]];
      return { ok: true, json: async () => ({ ...bot, status }) };
    }
    return {
      ok: true,
      json: async () => ({ ...settings, bot: { ...bot, status } }),
    };
  });
  vi.stubGlobal("fetch", fetch);
  mount(<FuturesSettingsPage />);
  for (const command of ["start", "pause", "resume", "stop"]) {
    const button = await screen.findByRole("button", {
      name: command.toUpperCase(),
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await screen.findByText(
      `Command accepted. Bot state: ${transitions[command]}.`,
    );
  }
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "START" })).toBeEnabled(),
  );
  expect(screen.getByRole("button", { name: "STOP" })).toBeDisabled();
});

it("shows rejected commands and releases pending controls", async () => {
  const fetch = vi.fn(async (url: string) =>
    url.includes("/bot/")
      ? {
          ok: false,
          json: async () => ({ detail: "Invalid state transition" }),
        }
      : { ok: true, json: async () => settings },
  );
  vi.stubGlobal("fetch", fetch);
  mount(<FuturesSettingsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "START" }));
  expect(
    await screen.findByText("Invalid state transition"),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "START" })).toBeEnabled();
});
