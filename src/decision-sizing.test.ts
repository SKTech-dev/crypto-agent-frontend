import { expect, it } from "vitest";
import { decisionSizing } from "./decision-sizing";
import type { FuturesDecision } from "./futures-contracts";

const base: FuturesDecision = {
  id: "entry",
  timestamp: 1,
  ready_at: 1,
  candle_time: 1,
  action: "OPEN_SHORT",
  status: "EXECUTED",
  strategy: "btc_ai_first_v2",
  prompt_version: "futures_evidence_v3",
  reason: "Short thesis",
  evidence: {},
  proposal: {},
  risk: {
    outcome: "APPROVED",
    proposed_quantity: "0.002",
    quantity: "0.002",
    fill_price: "77596.20",
    initial_margin: "77.5962",
    leverage: 2,
  },
};

it("distinguishes position value from reserved margin on an executed leveraged entry", () => {
  const amounts = decisionSizing(base);
  expect(amounts.planned?.notional).toBeCloseTo(155.1924);
  expect(amounts.traded?.notional).toBeCloseTo(155.1924);
  expect(amounts.planned?.margin).toBeCloseTo(77.5962);
});

it("retains rejected proposed sizing without reporting an execution", () => {
  const amounts = decisionSizing({
    ...base,
    status: "NO_EXECUTABLE_TRADE",
    risk: { ...base.risk, quantity: "0", outcome: "NO_EXECUTABLE_TRADE" },
  });
  expect(amounts.planned?.quantity).toBe(0.002);
  expect(amounts.planned?.notional).toBeCloseTo(155.1924);
  expect(amounts.traded).toBeUndefined();
});

it("an approved sizing result is not a fill while the decision is pending", () => {
  const amounts = decisionSizing({ ...base, status: "PENDING" });
  expect(amounts.planned?.notional).toBeCloseTo(155.1924);
  expect(amounts.executed).toBe(false);
  expect(amounts.traded).toBeUndefined();
});

it("does not invent a USDT value from current prices when historical fill price is missing", () => {
  const amounts = decisionSizing({
    ...base,
    risk: { quantity: ".002", proposed_quantity: ".002" },
    evidence: { quote: { mark: "90000" } },
  });
  expect(amounts.planned?.quantity).toBe(0.002);
  expect(amounts.planned?.notional).toBeUndefined();
  expect(amounts.traded?.notional).toBeUndefined();
});

it("does not pick an arbitrary direction from unselected readiness previews", () => {
  const amounts = decisionSizing({
    ...base,
    action: "NO_DECISION",
    status: "NO_EXECUTABLE_TRADE",
    risk: { previews: { OPEN_LONG: base.risk, OPEN_SHORT: base.risk } },
  });
  expect(amounts.hasProposal).toBe(false);
  expect(amounts.planned).toBeUndefined();
});

it.each(["NaN", "Infinity", "-0.002", ""])(
  "does not display malformed quantity %s as money",
  (quantity) => {
    expect(
      decisionSizing({ ...base, risk: { quantity, fill_price: "77596.20" } })
        .traded,
    ).toBeUndefined();
  },
);

it("does not label an executed record with missing quantity as a zero-value fill", () => {
  expect(
    decisionSizing({ ...base, risk: { quantity: "0", fill_price: "77596.20" } })
      .traded,
  ).toBeUndefined();
});

it("a close shows the position's closing value, not its profit or released collateral", () => {
  const amounts = decisionSizing({
    ...base,
    action: "CLOSE_SHORT",
    risk: { quantity: ".002", fill_price: "77791.60", initial_margin: "0" },
  });
  expect(amounts.traded?.notional).toBeCloseTo(155.5832);
});
