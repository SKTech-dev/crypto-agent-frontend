export interface Bot {
  status: string;
  heartbeat: number | null;
  last_candle: number | null;
  error: string | null;
  risk_halt: boolean;
  settings: Record<string, string>;
  protection?: {
    status: string;
    timestamp: number;
    error?: string;
    risk?: { reasons: string[] };
  };
}
export interface Portfolio {
  initial: string;
  cash: string;
  btc: string;
  basis: string;
  realized: string;
  fees: string;
  slippage: string;
  peak: string;
  started_at: number;
}
export interface Decision {
  id: string;
  timestamp: number;
  ready_at: number | null;
  market_id: string | null;
  action: string;
  status: string;
  reason: string;
  strategy: string;
  prompt_version: string;
  proposal: {
    protection_position_id?: string;
    supporting_agents?: string[];
    opposing_agents?: string[];
    risk_notes?: string[];
    model_confidence?: number;
    analysis?: {
      mode: "DETERMINISTIC" | "MULTI_AGENT";
      policy_version: string;
      paid_roles_invoked: string[];
      paid_roles_not_invoked: string[];
      eligibility: { failed_rules: string[] };
    } | null;
  };
}
export interface Fill {
  id: string;
  decision_id: string;
  position_id: string;
  timestamp: number;
  side: string;
  quantity: string;
  price: string;
  fee: string;
  slippage: string;
}
export interface Position {
  id: string;
  entry_decision_id: string;
  exit_decision_id: string | null;
  opened_at: number;
  closed_at: number | null;
  quantity: string;
  entry_price: string;
  exit_price: string | null;
  invested: string;
  entry_fee: string;
  exit_fee: string | null;
  realized: string | null;
  exit_trigger: string | null;
}
export interface Overview {
  portfolio: Portfolio;
  bot: Bot;
  price: string;
  market_timestamp: number | null;
  equity: string;
  realized_pnl: string;
  unrealized_pnl: string;
  today_pnl: string;
  month_pnl: string;
  lifetime_pnl: string;
  return_percent: string;
  ai_cost: string;
  ai_reserved: string;
  economic_pnl: string;
  closed_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: string;
  average_closed_pnl: string;
  max_drawdown: string;
  recent_decision: Decision | null;
  recent_fills: Fill[];
  benchmarks: { buy_hold: string | null; ema_signal: string | null };
}
export interface Candle {
  open_time: number;
  close_time: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}
export interface Indicators {
  ema_fast: string;
  ema_slow: string;
  rsi: string;
  macd: string;
  macd_signal: string;
  atr: string;
  average_volume: string;
  relative_volume: string | null;
  momentum: string;
  regime: string;
  candle_time: number;
}
export interface Market {
  timestamp: number;
  quote: { bid: string; ask: string; observed_at: number };
  candles: Candle[];
  hourly: Candle[];
  indicators: Indicators;
  trend_indicators: Indicators;
  statistics: {
    lastPrice: string;
    priceChangePercent: string;
    volume: string;
    quoteVolume: string;
    closeTime: number;
  };
}
export interface Snapshot {
  timestamp: number;
  equity: string;
  cash: string;
  btc: string;
  price: string;
  realized: string;
  fees: string;
  drawdown: string;
  benchmark_hold: string;
  benchmark_signal: string;
}
export interface Period {
  period: string;
  beginning_equity: string;
  ending_equity: string;
  pnl: string;
  finalized: boolean;
  last_observation: number;
}
export interface Performance {
  snapshots: Snapshot[];
  daily: Period[];
  monthly: Period[];
}
export interface AgentRun {
  id: string;
  role: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost: string;
  reserved_cost: string;
  duration_ms: number;
  error: string | null;
  output: {
    reason?: string;
    action?: string;
    outlook?: string;
    confidence?: number;
    evidence?: string[];
    contradictions?: string[];
    risks?: string[];
  };
}
export interface ProtectionEvent {
  id: string;
  timestamp: number;
  status: string;
  evidence: Record<string, unknown>;
}
export interface Detail {
  protection_events?: ProtectionEvent[];
  decision: Decision;
  market: { timestamp: number; evidence: Market } | null;
  agents: AgentRun[];
  risk: {
    recorded_result?: Record<string, unknown>;
    result: {
      outcome: string;
      quantity: string;
      rules: string[];
      reasons: string[];
      estimated_fee: string;
      estimated_slippage: string;
      portfolio: Record<string, string>;
    };
  } | null;
  fill: Fill | null;
}
export interface ModelPrice {
  model: string;
  label: string;
  input_per_million: string;
  output_per_million: string;
  currency: string;
  tier: string;
  verified_at: string;
  pricing_version: string;
  source_url: string;
  lifecycle: string;
}
export interface Settings {
  protection_events?: ProtectionEvent[];
  bot: Bot;
  mode: string;
  automation_enabled: boolean;
  initial_capital: string;
  model: string;
  available_models?: ModelPrice[];
  daily_ai_budget: string;
  daily_ai_spent_or_reserved: string;
  risk: Record<string, string>;
  protective_policy: string;
}
