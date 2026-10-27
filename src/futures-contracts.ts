import type {
  AgentRun,
  Candle,
  ModelPrice,
  Period,
  ProtectionEvent,
} from "./contracts";

export interface FuturesBot {
  status: string;
  heartbeat: number | null;
  error: string | null;
  funding_status: string;
  protection: { status?: string; error?: string };
}
export interface FuturesPosition {
  id: string;
  side: "LONG" | "SHORT";
  quantity: string;
  entry_price: string;
  mark: string;
  notional: string;
  initial_margin: string;
  collateral: string;
  maintenance: string;
  leverage: number;
  margin_mode: string;
  liquidation_price: string | null;
  stop_price: string;
  opened_at: number;
  closed_at: number | null;
  status: string;
  exit_price: string | null;
  entry_fee: string;
  exit_fee: string;
  realized: string;
  funding: string;
  limited_liability_adjustment: string;
  entry_decision_id: string;
  exit_decision_id: string | null;
}
export interface FuturesDecision {
  id: string;
  timestamp: number;
  ready_at: number | null;
  candle_time: number | null;
  action: string;
  status: string;
  strategy: string;
  prompt_version: string;
  reason: string;
  evidence: Record<string, unknown>;
  proposal: Record<string, unknown>;
  risk: {
    outcome?: string;
    quantity?: string;
    proposed_quantity?: string;
    leverage?: number;
    reasons?: string[];
    rules?: string[];
    liquidation_price?: string | null;
    initial_margin?: string;
  };
}
export interface FuturesOverview {
  risk_halt: boolean;
  deterministic_risk_halt: boolean;
  run_key: string;
  bot: FuturesBot;
  position: FuturesPosition | null;
  position_side: string;
  wallet: string;
  free_balance: string;
  margin: string;
  equity: string;
  mark: string;
  market_timestamp: number | null;
  unrealized_pnl: string;
  realized_pnl: string;
  funding: string;
  fees: string;
  liquidation_fees: string;
  today_pnl: string;
  month_pnl: string;
  lifetime_pnl: string;
  return_percent: string;
  ai_cost: string;
  ai_reserved: string;
  economic_pnl: string;
  closed_trades: number;
  winning_trades: number;
  liquidations: number;
  max_drawdown: string;
  recent_decision: FuturesDecision | null;
  deterministic_equity: string;
  benchmark_assumptions: string;
  liquidation_assumptions: string;
}
export interface FuturesPerformance {
  snapshots: { timestamp: number; equity: string; benchmark_signal: string }[];
  daily: Period[];
  monthly: Period[];
}
interface Mark {
  observed_at: number;
  mark_time: number;
  mark: string;
  index: string;
  funding_rate: string;
  next_funding_time: number;
}
export interface FuturesMarket {
  quote?: Mark & { bid: string; ask: string };
  latest_mark: Mark | null;
  candles?: Candle[];
  indicators?: Record<string, string>;
  trend_indicators?: Record<string, string>;
  candle_timestamp: number | null;
  quote_timestamp: number | null;
  contract?: {
    min_qty: string;
    step: string;
    min_notional: string;
    contract_type: string;
  };
}
export interface FuturesSettings {
  risk_halt: boolean;
  bot: FuturesBot;
  run_key: string;
  automation_enabled: boolean;
  initial_capital: string;
  risk: Record<string, unknown>;
  max_leverage: number;
  tier_status: string;
  model: string;
  available_models: (ModelPrice & { cached_input_per_million: string })[];
  daily_ai_budget: string;
  daily_ai_spent_or_reserved: string;
  protective_policy: string;
  protection_events: ProtectionEvent[];
}
export interface FuturesDetail {
  decision: FuturesDecision;
  agents: (AgentRun & {
    cached_tokens: number;
    effective_model: string | null;
    pricing: Record<string, unknown>;
  })[];
  fill: Record<string, unknown> | null;
  protection_events: ProtectionEvent[];
}
export interface FuturesFunding {
  id: string;
  position_id: string;
  settlement_time: number;
  rate: string;
  mark: string;
  amount: string;
  shortfall: string;
  late_reconciliation: boolean;
}
