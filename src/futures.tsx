import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Activity, ArrowUpRight, Bitcoin } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { Pagination, usePagination } from "./pagination";
import type { ProtectionEvent } from "./contracts";
import { CandleChart, EquityChart, PeriodChart } from "./charts";
import {
  ActionBadge,
  Badge,
  DecisionTime,
  Failure,
  Loading,
  Metric,
  Panel,
  money,
  stamp,
} from "./ui";
import type {
  FuturesBot,
  FuturesDecision,
  FuturesDetail,
  FuturesFunding,
  FuturesMarket,
  FuturesOverview,
  FuturesPerformance,
  FuturesPosition,
  FuturesSettings,
} from "./futures-contracts";

const signedMoney = (value: string, digits = 2) =>
  `${Number(value) >= 0 ? "+" : ""}${money(value, digits)}`;

function indicatorValue(key: string, value: unknown) {
  if (key === "candle_time") return stamp(Number(value));
  if (value == null) return "Unavailable";
  if (key === "regime") return String(value).replaceAll("_", " ");
  return Number.isFinite(Number(value))
    ? money(Number(value), key === "momentum" ? 6 : 2)
    : String(value);
}

const riskLabels: Record<string, string> = {
  version: "Policy version",
  leverage: "Leverage",
  max_leverage: "Maximum leverage",
  margin_mode: "Margin mode",
  margin_allocation: "Margin allocation",
  max_notional: "Maximum notional",
  risk_per_trade: "Risk per trade",
  stop_loss: "Protective stop",
  max_daily_loss: "Daily loss limit",
  max_drawdown: "Drawdown limit",
  max_consecutive_losses: "Consecutive loss limit",
  fee_rate: "Taker fee assumption",
  slippage_rate: "Slippage assumption",
  liquidation_fee_rate: "Liquidation cost assumption",
  cooldown_seconds: "Trade cooldown",
  quote_max_age_seconds: "Maximum quote age",
  maintenance_max_age_seconds: "Tier evidence maximum age",
  cost_assumption: "Cost assumptions",
  liquidation_model: "Liquidation model",
};
const riskFractions = new Set([
  "margin_allocation",
  "max_notional",
  "risk_per_trade",
  "stop_loss",
  "fee_rate",
  "slippage_rate",
  "liquidation_fee_rate",
  "max_daily_loss",
  "max_drawdown",
]);

function riskValue(key: string, value: unknown) {
  if (riskFractions.has(key)) return `${money(Number(value) * 100, 2)}%`;
  if (key.includes("leverage")) return `${value}x`;
  if (key.endsWith("seconds")) return `${money(Number(value), 0)} seconds`;
  return String(value);
}

function useFutures<T>(path: string) {
  return useQuery({
    queryKey: ["futures", path],
    queryFn: () => api<T>(`/${path}`),
    refetchInterval: 15_000,
  });
}
function Protection({ bot }: { bot: FuturesBot }) {
  const accessRestricted = [bot.error, bot.protection.detail].some((message) =>
    message?.includes("HTTP_451"),
  );
  const unresolved = [
    "PENDING",
    "BLOCKED",
    "UNAVAILABLE",
    "UNRESOLVED",
  ].includes(bot.protection.status || "");
  return (
    <>
      {accessRestricted && (
        <div className="notice error" role="alert">
          <strong>Binance Futures data access is restricted (HTTP 451).</strong>{" "}
          The data provider rejected requests from the backend server. Review
          the hosting region and provider access policy to restore an authorized
          data connection. Prices, funding and protective monitoring cannot
          recover until access is restored; new exposure remains blocked.
        </div>
      )}
      {bot.error && (
        <div className="notice error" role="alert">
          Worker: {bot.error}
        </div>
      )}
      {unresolved && (
        <div className="notice error" role="alert">
          Protection {bot.protection.status}:{" "}
          {bot.protection.error || "Exit intent awaiting a valid observation."}{" "}
          {bot.protection.detail && <>{bot.protection.detail}. </>}
          Position exposure remains until closure or simulated liquidation.
        </div>
      )}
      {bot.funding_status !== "RECONCILED" && (
        <div className="notice">
          Funding history is unavailable or pending reconciliation. New exposure
          is blocked; protective monitoring continues.
        </div>
      )}
    </>
  );
}

export function FuturesDashboard() {
  const { data: o, error } = useFutures<FuturesOverview>("overview");
  const readiness = useFutures<{ status: string; reasons: string[] }>(
    "readiness",
  );
  const { data: p, error: performanceError } =
    useFutures<FuturesPerformance>("performance");
  if (error) return <Failure error={error} />;
  if (!o) return <Loading />;
  const stale = !o.market_timestamp || Date.now() - o.market_timestamp > 60_000;
  return (
    <>
      {readiness.data?.status === "degraded" && (
        <div className="notice error" role="alert">
          Service needs attention: {readiness.data.reasons.join(", ")}
        </div>
      )}
      {readiness.error && <Failure error={readiness.error} />}
      <div className="page-title">
        <div className="eyebrow">YOUR RESEARCH AT A GLANCE</div>
        <h1>
          Futures portfolio overview <span className="title-dot" />
        </h1>
        <p>Every decision. Every cost. The complete picture.</p>
        <div className="title-right">
          <Badge
            tone={
              o.bot.status === "RUNNING" && !o.bot.error ? "green" : "neutral"
            }
          >
            <i />
            {o.bot.error ? "DATA ERROR" : o.bot.status}
          </Badge>
          <small>
            {stale
              ? "Awaiting fresh mark data"
              : `Updated ${stamp(o.market_timestamp)}`}
          </small>
        </div>
      </div>
      <Protection bot={o.bot} />
      {o.risk_halt && (
        <div className="notice error" role="alert">
          AI portfolio risk halt: new exposure is disabled. Protective
          monitoring remains active.
        </div>
      )}
      {stale && (
        <div className="notice error">
          Mark data is unavailable or stale. Displayed equity is the last
          observed valuation.
        </div>
      )}
      <div className="hero-grid">
        <section className="equity-card" aria-label="Portfolio equity">
          <span className="eyebrow">
            TOTAL PORTFOLIO EQUITY <Badge>VIRTUAL USDT</Badge>
          </span>
          <div className="equity-value">
            <span className="equity-amount">${money(o.equity)}</span>
            <span>USDT</span>
          </div>
          <div
            className={Number(o.lifetime_pnl) >= 0 ? "positive" : "negative"}
          >
            <ArrowUpRight size={16} aria-hidden="true" />
            {signedMoney(o.lifetime_pnl)} USDT
            <Badge tone={Number(o.return_percent) >= 0 ? "green" : "red"}>
              {money(o.return_percent)}%
            </Badge>
            <span className="muted">since inception</span>
          </div>
          <div className="hero-bottom futures-balances">
            <div>
              Starting capital
              <strong>{money(o.portfolio?.initial)} USDT</strong>
            </div>
            <div>
              Wallet balance<strong>{money(o.wallet)} USDT</strong>
            </div>
            <div>
              Free balance<strong>{money(o.free_balance)} USDT</strong>
            </div>
            <div>
              Isolated margin<strong>{money(o.margin)} USDT</strong>
            </div>
          </div>
        </section>
        <section className="btc-card" aria-label="Bitcoin Futures market">
          <div className="btc-card-top">
            <span className="coin">
              <Bitcoin size={23} aria-hidden="true" />
            </span>
            <div>
              <strong>Bitcoin</strong>
              <small>BTC / USDT · PERPETUAL</small>
            </div>
            <Badge>{stale ? "STALE" : "FUTURES"}</Badge>
          </div>
          <strong className="btc-price">
            ${o.market_timestamp ? money(o.mark) : "—"}
          </strong>
          <p>Binance USD-M Futures · mark price</p>
          <div className="market-line">
            <Activity size={16} aria-hidden="true" />
            <span>
              {stale
                ? "Awaiting fresh observations"
                : "Market observations connected"}
            </span>
          </div>
          <div className="position-summary">
            <span>Current position</span>
            <Badge
              tone={
                o.position_side === "LONG"
                  ? "green"
                  : o.position_side === "SHORT"
                    ? "red"
                    : "neutral"
              }
            >
              {o.position_side}
            </Badge>
            {o.position && <small>{o.position.leverage}x isolated</small>}
          </div>
          <NavLink to="/market">
            Explore BTC futures <ArrowUpRight size={16} aria-hidden="true" />
          </NavLink>
        </section>
      </div>
      <div className="metrics-row">
        <Metric
          label="Today's trading P&L"
          value={`${signedMoney(o.today_pnl)} USDT`}
          positive={Number(o.today_pnl) >= 0}
          sub="Current UTC day · incomplete"
        />
        <Metric
          label="This month's P&L"
          value={`${signedMoney(o.month_pnl)} USDT`}
          positive={Number(o.month_pnl) >= 0}
          sub="Current UTC month · incomplete"
        />
        <Metric
          label="Realized / unrealized"
          value={`${money(o.realized_pnl)} / ${money(o.unrealized_pnl)}`}
          sub="USDT · commissions included when charged"
        />
        <Metric
          label="Completed trades"
          value={String(o.closed_trades)}
          sub={`${o.position ? 1 : 0} open · ${o.winning_trades} wins · ${o.liquidations} liquidations`}
        />
      </div>
      {o.position && (
        <Panel title="Open isolated position">
          <div className="metrics-row">
            <Metric
              label="Contract notional"
              value={`${money(o.position.notional)} USDT`}
              sub="Exposure, not available cash"
            />
            <Metric
              label="Maintenance margin"
              value={`${money(o.position.maintenance, 4)} USDT`}
            />
            <Metric
              label="Estimated liquidation mark"
              value={money(o.position.liquidation_price)}
              sub="Approximate tier/cost model"
            />
            <Metric
              label="Protective stop mark"
              value={money(o.position.stop_price)}
              sub="Stop execution is not guaranteed"
            />
          </div>
        </Panel>
      )}
      {performanceError && <Failure error={performanceError} />}
      <Panel
        title="Portfolio performance — last 30 days"
        aside={
          <div className="legend">
            <span className="lime-dot" />
            AI portfolio <span className="orange-dot" />
            Deterministic comparator
          </div>
        }
      >
        <EquityChart rows={p?.snapshots || []} futures />
        <div className="chart-foot">
          <span>Same capital, risk and execution assumptions</span>
          <span>USDT · valued at observed mark</span>
        </div>
        <p className="panel-note">{o.benchmark_assumptions}</p>
      </Panel>
      <div className="two-col">
        <Panel title="Daily profit & loss" aside={<Badge>UTC</Badge>}>
          <PeriodChart rows={p?.daily || []} />
        </Panel>
        <Panel title="Monthly profit & loss" aside={<Badge>UTC</Badge>}>
          <p className="panel-note">
            Selected 30-day window; the first month may be partial. Missing
            observations are not reconstructed.
          </p>
          <PeriodChart rows={p?.monthly || []} />
        </Panel>
      </div>
      <p className="panel-note">
        Charts use observed marks. Outages can leave missing boundary
        valuations; historical dates do not guarantee complete coverage.
      </p>
      <div className="two-col">
        <Panel title="Research economics">
          <div className="economics">
            {[
              ["Trading commissions", money(o.fees, 6) + " USDT"],
              ["Funding net", money(o.funding, 6) + " USDT"],
              ["Liquidation costs", money(o.liquidation_fees, 6) + " USDT"],
              ["Estimated AI cost", "$" + money(o.ai_cost, 6)],
              ["Unresolved AI reservations", "$" + money(o.ai_reserved, 6)],
              [
                "Combined economic P&L",
                money(o.economic_pnl, 4) + " USD equiv.",
              ],
              ["Maximum drawdown", money(Number(o.max_drawdown) * 100) + "%"],
              [
                "Closed / liquidated positions",
                `${o.closed_trades} / ${o.liquidations}`,
              ],
              [
                "Deterministic comparator equity",
                money(o.deterministic_equity, 4) + " USDT",
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <span>{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <p className="panel-note">
            Inference costs are estimates, not provider invoices. USD comparison
            assumes USDT≈USD.
          </p>
        </Panel>
        <Panel
          title="Latest research decision"
          aside={
            <NavLink to="/decisions" className="text-link">
              All decisions <ArrowUpRight size={14} />
            </NavLink>
          }
        >
          <div className="panel-body decision-summary">
            {o.recent_decision ? (
              <>
                <div className="decision-meta">
                  <ActionBadge action={o.recent_decision.action} />
                  <Badge>{o.recent_decision.status}</Badge>
                </div>
                <DecisionTime timestamp={o.recent_decision.timestamp} />
                <p>{o.recent_decision.reason}</p>
              </>
            ) : (
              <p>No decisions yet.</p>
            )}
            <p className="panel-note">{o.liquidation_assumptions}</p>
          </div>
        </Panel>
      </div>
    </>
  );
}

export function FuturesMarketPage() {
  const { data: m, error } = useFutures<FuturesMarket | null>("market");
  if (error) return <Failure error={error} />;
  if (m === undefined) return <Loading />;
  const mark = m?.latest_mark || m?.quote;
  return (
    <>
      <div className="page-title">
        <div className="eyebrow">BINANCE PUBLIC USDⓈ-M FUTURES</div>
        <h1>Bitcoin perpetual Futures</h1>
        <p>BTCUSDT · USDT margin · Public observations only</p>
      </div>
      {!m ? (
        <div className="empty">Awaiting Futures worker observations.</div>
      ) : (
        <>
          <div className="metrics-row market-metrics">
            <div className="metric">
              <span>Futures bid / ask</span>
              <div className="price-pair">
                <div>
                  <small>Bid</small>
                  <strong>{money(m.quote?.bid)}</strong>
                </div>
                <div>
                  <small>Ask</small>
                  <strong>{money(m.quote?.ask)}</strong>
                </div>
              </div>
              <small>Quote observed: {stamp(m.quote_timestamp)}</small>
            </div>
            <div className="metric">
              <span>Mark / index</span>
              <div className="price-pair">
                <div>
                  <small>Mark</small>
                  <strong>{money(mark?.mark)}</strong>
                </div>
                <div>
                  <small>Index</small>
                  <strong>{money(mark?.index)}</strong>
                </div>
              </div>
              <small>Mark source: {stamp(mark?.mark_time)}</small>
            </div>
            <Metric
              label="Last published funding rate"
              value={
                mark
                  ? `${money(Number(mark.funding_rate) * 100, 5)}%`
                  : "Unavailable"
              }
              sub={`Next scheduled funding: ${stamp(mark?.next_funding_time)}`}
            />
            <Metric
              label="Completed decision candle"
              value={stamp(m.candle_timestamp)}
              sub="15m close time · separate from quote freshness"
            />
          </div>
          {(!m.quote_timestamp || Date.now() - m.quote_timestamp > 60_000) && (
            <div className="notice error">
              Executable book quote is stale or unavailable.
            </div>
          )}
          {(!mark || Date.now() - mark.mark_time > 60_000) && (
            <div className="notice error">
              Mark-price evidence is stale or unavailable.
            </div>
          )}
          <Panel title="Completed 15m Futures candles">
            <CandleChart rows={m.candles || []} />
          </Panel>
          <div className="two-col">
            {[
              ["15m indicators", m.indicators],
              ["1h confirmation", m.trend_indicators],
            ].map(([title, values]) => (
              <Panel key={String(title)} title={String(title)}>
                <div className="economics">
                  {Object.entries(values || {}).map(([key, value]) => (
                    <div key={key}>
                      <span>{key.replaceAll("_", " ")}</span>
                      <strong>
                        <span title={String(value)} className="indicator-value">
                          {indicatorValue(key, value)}
                        </span>
                      </strong>
                    </div>
                  ))}
                </div>
              </Panel>
            ))}
          </div>
          <Panel title="Contract constraints">
            <div className="panel-body">
              <dl className="contract-grid">
                <div>
                  <dt>Quantity step</dt>
                  <dd>{m.contract?.step || "Unavailable"} BTC</dd>
                </div>
                <div>
                  <dt>Minimum quantity</dt>
                  <dd>{m.contract?.min_qty || "Unavailable"} BTC</dd>
                </div>
                <div>
                  <dt>Minimum notional</dt>
                  <dd>{m.contract?.min_notional || "Unavailable"} USDT</dd>
                </div>
              </dl>
              <p className="panel-note">
                Current funding is not a forecast or a guarantee of the next
                settlement rate.
              </p>
            </div>
          </Panel>
        </>
      )}
    </>
  );
}

function FuturesDecisionDetail({
  id,
  close,
  runKey,
}: {
  id: string;
  close: () => void;
  runKey?: string;
}) {
  const { data: d, error } = useFutures<FuturesDetail>(
    `decisions/${id}${runKey ? `?run_key=${encodeURIComponent(runKey)}` : ""}`,
  );
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        className="modal"
        role="dialog"
        aria-label="Futures decision evidence"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-head">
          <h2>Futures decision evidence</h2>
          <button onClick={close}>Close</button>
        </div>
        {error && <Failure error={error} />}
        {!d ? (
          <Loading />
        ) : (
          <>
            <div className="decision-meta">
              <ActionBadge action={d.decision.action} />
              <Badge>{d.decision.status}</Badge>
            </div>
            <DecisionTime timestamp={d.decision.timestamp} />
            {d.decision.ready_at && (
              <p>Decision ready: {stamp(d.decision.ready_at)}</p>
            )}
            {d.decision.status === "SKIPPED" && (
              <p>
                Analysis skipped. No agent decision or execution evaluation was
                performed.
              </p>
            )}
            <p>{d.decision.reason}</p>
            <p>
              Strategy {d.decision.strategy} · prompt{" "}
              {d.decision.prompt_version}
            </p>
            <h3>Operational gate</h3>
            {d.decision.evidence.operational_gate ? (
              <p>
                {d.decision.evidence.operational_gate.allowed
                  ? "Routine analysis was permitted."
                  : d.decision.evidence.operational_gate.reasons.join("; ")}
              </p>
            ) : (
              <p>
                Exact operational gate flags were not recorded for this
                historical entry.
              </p>
            )}
            <h3>Recorded strategy checks</h3>
            {d.decision.evidence.eligibility ? (
              <>
                <p>
                  Rule result: {d.decision.evidence.eligibility.action}. This is
                  strategy evidence, not execution approval.
                </p>
                {Object.entries(
                  d.decision.evidence.eligibility.directions || {
                    Position: d.decision.evidence.eligibility.checks,
                  },
                ).map(([side, checks]) => (
                  <details key={side}>
                    <summary>
                      {side}: {checks.filter((c) => c.passed).length}/
                      {checks.length} checks passed
                    </summary>
                    <p>
                      Combination:{" "}
                      {d.decision.evidence.eligibility?.combination}
                    </p>
                    {checks.map((c) => (
                      <div className="agent" key={c.rule}>
                        <strong>
                          {c.rule}: {c.passed ? "Passed" : "Not met"}
                        </strong>
                        <p>{c.condition}</p>
                        <pre>{JSON.stringify(c.observed, null, 2)}</pre>
                      </div>
                    ))}
                  </details>
                ))}
              </>
            ) : (
              <p>No strategy checks were recorded.</p>
            )}
            <h3>Agent analysis</h3>
            {!d.agents.length && (
              <p>No agent analysis was recorded for this entry.</p>
            )}
            {Object.keys(d.decision.proposal).length > 0 && (
              <details>
                <summary>Recorded proposal</summary>
                <pre>{JSON.stringify(d.decision.proposal, null, 2)}</pre>
              </details>
            )}
            {d.agents.map((a) => (
              <div className="agent" key={a.id}>
                <Badge>{a.role}</Badge>
                <ActionBadge action={a.output.action || "NO_DECISION"} />
                <p>{a.output.reason || a.error}</p>
                <small>
                  {a.effective_model || a.model} · input {a.input_tokens}{" "}
                  (cached {a.cached_tokens}) · output {a.output_tokens} ·
                  estimated ${money(a.cost, 6)}
                </small>
                <details>
                  <summary>
                    Original instructions, evidence and findings
                  </summary>
                  <pre>{JSON.stringify(a, null, 2)}</pre>
                </details>
              </div>
            ))}
            <h3>Deterministic execution risk</h3>
            <Badge>{d.decision.risk.outcome || "Not evaluated"}</Badge>
            <p>{d.decision.risk.reasons?.join("; ")}</p>
            {d.decision.risk.proposed_quantity != null ||
            d.decision.risk.quantity != null ? (
              <p>
                {d.decision.risk.proposed_quantity != null && (
                  <>Proposed {d.decision.risk.proposed_quantity} BTC ? </>
                )}
                {d.decision.risk.quantity != null && (
                  <>approved {d.decision.risk.quantity} BTC</>
                )}
                {d.decision.risk.leverage != null && (
                  <> ? leverage {d.decision.risk.leverage}x</>
                )}
              </p>
            ) : (
              <p>No order sizing was evaluated.</p>
            )}
            {Object.keys(d.decision.risk).length > 0 && (
              <details>
                <summary>Recorded risk evidence</summary>
                <pre>{JSON.stringify(d.decision.risk, null, 2)}</pre>
              </details>
            )}
            <h3>Execution / liquidation settlement</h3>
            {d.fill ? (
              <pre>{JSON.stringify(d.fill, null, 2)}</pre>
            ) : (
              <p>No fill or liquidation settlement is linked to this entry.</p>
            )}
            <h3>Protective attempts</h3>
            {d.protection_events.length ? (
              <pre>{JSON.stringify(d.protection_events, null, 2)}</pre>
            ) : (
              <p>No protective attempts are linked to this entry.</p>
            )}
            <details>
              <summary>Original market evidence</summary>
              <pre>{JSON.stringify(d.decision.evidence, null, 2)}</pre>
            </details>
          </>
        )}
      </section>
    </div>
  );
}

export function FuturesHistory() {
  const [runKey, setRunKey] = useState("");
  const runs =
    useFutures<{ run_key: string; current: boolean; status: string }[]>("runs");
  const runParam = runKey ? `&run_key=${encodeURIComponent(runKey)}` : "";
  const [kind, setKind] = useState("AI"),
    [selected, select] = useState<string | null>(null);
  const decisionPage = usePagination();
  const positionPage = usePagination();
  const fundingPage = usePagination();
  const decisionQuery = useFutures<FuturesDecision[]>(
    `decisions?kind=${kind}&offset=${decisionPage.offset}&limit=${decisionPage.pageSize + 1}${runParam}`,
  );
  const positionQuery = useFutures<FuturesPosition[]>(
    `positions?kind=${kind}&offset=${positionPage.offset}&limit=${positionPage.pageSize + 1}${runParam}`,
  );
  const fundingQuery = useFutures<FuturesFunding[]>(
    `funding?kind=${kind}&offset=${fundingPage.offset}&limit=${fundingPage.pageSize + 1}${runParam}`,
  );
  const decisions = decisionQuery.data?.slice(0, decisionPage.pageSize);
  const positions = positionQuery.data?.slice(0, positionPage.pageSize);
  const funding = fundingQuery.data?.slice(0, fundingPage.pageSize);
  return (
    <>
      <div className="page-title">
        <h1>Futures decisions & trading history</h1>
        {runs.error && <Failure error={runs.error} />}
        <label className="form-field">
          Research run
          <select
            value={runKey}
            onChange={(e) => {
              setRunKey(e.target.value);
              select(null);
              decisionPage.setPage(0);
              positionPage.setPage(0);
              fundingPage.setPage(0);
            }}
          >
            <option value="">Current run</option>
            {runs.data
              ?.filter((r) => !r.current)
              .map((r) => (
                <option key={r.run_key} value={r.run_key}>
                  {r.run_key} (archived, read-only)
                </option>
              ))}
          </select>
        </label>
        {runKey && (
          <p className="notice">
            Viewing archived history. Bot controls apply only to the current
            run.
          </p>
        )}
        <div className="history-toolbar">
          <label className="form-field">
            Research portfolio{" "}
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                decisionPage.reset();
                positionPage.reset();
                fundingPage.reset();
                select(null);
              }}
            >
              <option value="AI">AI-controlled</option>
              <option value="DETERMINISTIC">Deterministic comparator</option>
            </select>
          </label>
        </div>
        <p>Spot records are preserved separately and excluded from this run.</p>
      </div>
      {decisionQuery.error && <Failure error={decisionQuery.error} />}
      <Panel title="Decision journal">
        {decisionQuery.isPending && <Loading />}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Outcome</th>
                <th>Reason</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {decisions?.map((d) => (
                <tr key={d.id}>
                  <td>
                    <DecisionTime timestamp={d.timestamp} />
                  </td>
                  <td>
                    <ActionBadge action={d.action} />
                  </td>
                  <td>{d.status}</td>
                  <td className="reason-cell">{d.reason}</td>
                  <td>
                    <button onClick={() => select(d.id)}>
                      Inspect decision
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {decisions && !decisions.length && (
          <div className="empty">
            {decisionPage.page === 0
              ? "No decisions recorded for this portfolio yet."
              : "No decisions on this page. Use Previous to return to newer records."}
          </div>
        )}
        <Pagination
          label="Decision journal"
          {...decisionPage}
          count={decisions?.length ?? 0}
          hasNext={(decisionQuery.data?.length ?? 0) > decisionPage.pageSize}
          loading={decisionQuery.isFetching}
          error={!!decisionQuery.error}
          onPageChange={decisionPage.setPage}
          onPageSizeChange={decisionPage.setPageSize}
        />
      </Panel>
      {positionQuery.error && <Failure error={positionQuery.error} />}
      <Panel title="Isolated positions">
        {positionQuery.isPending && <Loading />}
        {positions && !positions.length && (
          <div className="empty">
            {positionPage.page === 0
              ? "No Futures positions yet. Open and closed positions will appear here."
              : "No positions on this page. Use Previous to return to newer records."}
          </div>
        )}
        {positions?.map((p) => (
          <article className="position" key={p.id}>
            <Badge>
              {p.side} · {p.leverage}x · {p.status}
            </Badge>
            <p>
              {p.quantity} BTC contracts · notional {money(p.notional)} USDT ·
              initial margin {money(p.initial_margin, 4)} USDT
            </p>
            <p>
              Entry {money(p.entry_price)} · exit {money(p.exit_price)} ·
              current mark {money(p.mark)} · estimated liquidation{" "}
              {money(p.liquidation_price)}
            </p>
            <p>
              Trading P&L {money(p.realized, 4)} · funding {money(p.funding, 6)}{" "}
              · fees {money(Number(p.entry_fee) + Number(p.exit_fee), 6)} USDT
            </p>
            <p>
              Limited-liability model adjustment{" "}
              {money(p.limited_liability_adjustment, 6)} USDT
            </p>
            <button onClick={() => select(p.entry_decision_id)}>
              Entry reasoning
            </button>
            {p.exit_decision_id && (
              <button onClick={() => select(p.exit_decision_id!)}>
                Exit reasoning
              </button>
            )}
          </article>
        ))}
        <Pagination
          label="Isolated positions"
          {...positionPage}
          count={positions?.length ?? 0}
          hasNext={(positionQuery.data?.length ?? 0) > positionPage.pageSize}
          loading={positionQuery.isFetching}
          error={!!positionQuery.error}
          onPageChange={positionPage.setPage}
          onPageSizeChange={positionPage.setPageSize}
        />
      </Panel>
      {fundingQuery.error && <Failure error={fundingQuery.error} />}
      <Panel title="Funding transfers">
        {fundingQuery.isPending && <Loading />}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Settlement UTC</th>
                <th>Rate</th>
                <th>Net transfer USDT</th>
                <th>Position</th>
                <th>Reconciliation</th>
              </tr>
            </thead>
            <tbody>
              {funding?.map((f) => (
                <tr key={f.id}>
                  <td>{stamp(f.settlement_time)}</td>
                  <td>{money(Number(f.rate) * 100, 5)}%</td>
                  <td>{money(f.amount, 6)}</td>
                  <td>{f.position_id}</td>
                  <td>
                    {f.late_reconciliation
                      ? "Late history recovery"
                      : "Current"}
                    {Number(f.shortfall) > 0 ? ` · unpaid ${f.shortfall}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {funding && !funding.length && (
          <div className="empty">
            {fundingPage.page === 0
              ? "No funding transfers recorded for this portfolio."
              : "No funding transfers on this page. Use Previous to return to newer records."}
          </div>
        )}
        <Pagination
          label="Funding transfers"
          {...fundingPage}
          count={funding?.length ?? 0}
          hasNext={(fundingQuery.data?.length ?? 0) > fundingPage.pageSize}
          loading={fundingQuery.isFetching}
          error={!!fundingQuery.error}
          onPageChange={fundingPage.setPage}
          onPageSizeChange={fundingPage.setPageSize}
        />
      </Panel>
      {selected && (
        <FuturesDecisionDetail
          id={selected}
          runKey={runKey}
          close={() => select(null)}
        />
      )}
    </>
  );
}

export function FuturesSettingsPage() {
  const { data: s, error } = useFutures<FuturesSettings>("settings"),
    client = useQueryClient();
  const [model, setModel] = useState(""),
    [leverage, setLeverage] = useState(0);
  const [reviewReason, setReviewReason] = useState("");
  const historyPage = usePagination();
  const historyQuery = useFutures<ProtectionEvent[]>(
    `protection-events?offset=${historyPage.offset}&limit=${historyPage.pageSize + 1}`,
  );
  const history = historyQuery.data?.slice(0, historyPage.pageSize);
  const refresh = () => client.invalidateQueries({ queryKey: ["futures"] });
  const controls = useMutation({
    mutationFn: (command: string) =>
      api<FuturesBot>(`/bot/${command}`, { method: "POST" }),
    onSuccess: refresh,
  });
  const haltReview = useMutation({
    mutationFn: (kind: string) =>
      api("/risk-halt/review", {
        method: "POST",
        body: JSON.stringify({ kind, reason: reviewReason }),
      }),
    onSuccess: refresh,
  });
  const modelChange = useMutation({
    mutationFn: () =>
      api("/settings/model", {
        method: "PUT",
        body: JSON.stringify({ model: model || s?.model }),
      }),
    onSuccess: refresh,
  });
  const leverageChange = useMutation({
    mutationFn: () =>
      api("/settings/leverage", {
        method: "PUT",
        body: JSON.stringify({ leverage }),
      }),
    onSuccess: refresh,
  });
  if (error) return <Failure error={error} />;
  if (!s) return <Loading />;
  const selected = s.available_models.find(
    (x) => x.model === (model || s.model),
  );
  return (
    <>
      <div className="page-title">
        <div className="eyebrow">RESEARCH CONFIGURATION</div>
        <h1>Futures bot settings</h1>
        <p>Paper-only · BTCUSDT perpetual · research run {s.run_key}</p>
      </div>
      <Protection bot={s.bot} />
      {s.halt_recovery?.some((r) => r.halted) && (
        <Panel title="Review portfolio risk halts">
          <div className="panel-body">
            <p>
              Pause or stop first. Recovery checks preserve balances, risk
              limits and loss history. Persistent drawdown, loss-streak or
              funding-shortfall blocks cannot be cleared here.
            </p>
            <label className="form-field">
              Review reason
              <textarea
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                minLength={10}
                maxLength={500}
              />
            </label>
            {s.halt_recovery
              .filter((r) => r.halted)
              .map((r) => (
                <div key={r.kind}>
                  <strong>{r.kind}</strong>
                  {r.blockers.map((b) => (
                    <p key={b}>{b}</p>
                  ))}
                  <button
                    disabled={
                      !!r.blockers.length ||
                      reviewReason.trim().length < 10 ||
                      haltReview.isPending
                    }
                    onClick={() => haltReview.mutate(r.kind)}
                  >
                    Acknowledge review and clear {r.kind} halt
                  </button>
                </div>
              ))}
            {haltReview.error && <Failure error={haltReview.error} />}
            {haltReview.isSuccess && (
              <p>Halt cleared. Start or resume separately when ready.</p>
            )}
          </div>
        </Panel>
      )}
      {s.risk_halt && (
        <div className="notice error" role="alert">
          Portfolio risk halt requires operator review before new exposure.
        </div>
      )}
      <Panel title="Autonomous worker" aside={<Badge>{s.bot.status}</Badge>}>
        <div className="panel-body">
          <div
            className="controls bot-controls"
            aria-label="Bot controls"
            aria-busy={controls.isPending}
          >
            {["start", "pause", "resume", "stop"].map((command) => {
              const requiresRunning =
                command === "start" || command === "resume";
              const reason = controls.isPending
                ? "Waiting for the current command."
                : requiresRunning && !s.automation_enabled
                  ? "Paper automation is disabled on the server."
                  : requiresRunning && s.risk_halt
                    ? "Resolve the portfolio risk halt first."
                    : command === "start" &&
                        !["STOPPED", "ERROR"].includes(s.bot.status)
                      ? "Start is available when stopped or recovering from an error."
                      : command === "pause" && s.bot.status !== "RUNNING"
                        ? "Pause is available while running."
                        : command === "resume" && s.bot.status !== "PAUSED"
                          ? "Resume is available while paused."
                          : command === "stop" && s.bot.status === "STOPPED"
                            ? "The bot is already stopped."
                            : "";
              return (
                <span
                  key={command}
                  title={reason || `${command} paper analysis`}
                >
                  <button
                    className={`bot-control bot-control-${command}`}
                    disabled={Boolean(reason)}
                    aria-describedby="bot-control-help"
                    onClick={() => controls.mutate(command)}
                  >
                    {controls.isPending && controls.variables === command
                      ? "APPLYING?"
                      : command.toUpperCase()}
                  </button>
                </span>
              );
            })}
          </div>
          <div id="bot-control-help" className="bot-control-help">
            <p>
              Start runs paper analysis. Pause suspends new analysis; Resume
              continues it. Stop keeps it stopped until Start is selected.
            </p>
            {!s.automation_enabled && (
              <p className="notice">
                Start and Resume are unavailable: paper automation is disabled
                on the server. Set AUTO_TRADING_ENABLED=true in the backend
                configuration and restart the service to permit these controls.
                Starting can invoke paid agents when configured.
              </p>
            )}
            {s.risk_halt && (
              <p>
                Start and Resume are unavailable until the portfolio risk halt
                is resolved.
              </p>
            )}
            {s.bot.status === "STOPPED" && <p>The bot is already stopped.</p>}
          </div>
          {controls.isPending && (
            <p role="status">Applying {controls.variables} command?</p>
          )}
          {controls.isSuccess && (
            <p role="status">
              Command accepted. Bot state: {controls.data.status}.
            </p>
          )}
          {controls.error && <Failure error={controls.error} />}
          <p>{s.protective_policy}</p>
          <p>
            Heartbeat {stamp(s.bot.heartbeat)} · initial balance{" "}
            {money(s.initial_capital)} virtual USDT
          </p>
        </div>
      </Panel>
      {s.tier_status !== "CONFIGURED_OPERATOR_EVIDENCE" && (
        <div className="notice error" role="alert">
          Verified maintenance-margin tiers are unavailable. New entries are
          disabled. Configure a sourced, dated tier book before research
          activation.
        </div>
      )}
      <Panel title="Isolated margin and deterministic risk">
        <div className="panel-body">
          <div className="form-row">
            <label className="form-field">
              Leverage
              <select
                value={leverage || Number(s.risk.leverage)}
                onChange={(e) => setLeverage(Number(e.target.value))}
              >
                {Array.from({ length: s.max_leverage }, (_, i) => i + 1).map(
                  (n) => (
                    <option key={n} value={n}>
                      {n}x
                    </option>
                  ),
                )}
              </select>
            </label>
            <button
              disabled={
                !leverage ||
                s.bot.status === "RUNNING" ||
                leverageChange.isPending
              }
              onClick={() => leverageChange.mutate()}
            >
              Save leverage
            </button>
          </div>
          {leverageChange.error && <Failure error={leverageChange.error} />}
          <p>
            Pause and close positions in both portfolios before changing
            leverage.
          </p>
          <dl className="risk-grid">
            {Object.entries(s.risk)
              .filter(([k]) => k !== "tiers")
              .map(([k, v]) => (
                <div
                  key={k}
                  className={
                    k.endsWith("assumption") || k === "liquidation_model"
                      ? "risk-description"
                      : ""
                  }
                >
                  <dt>{riskLabels[k] || k.replaceAll("_", " ")}</dt>
                  <dd>{riskValue(k, v)}</dd>
                </div>
              ))}
          </dl>
          <details>
            <summary>Maintenance-tier evidence and verification time</summary>
            <pre>{JSON.stringify(s.risk.tiers, null, 2)}</pre>
          </details>
          <p className="panel-note">
            Risk and cost fractions are displayed as percentages. Costs and
            liquidation are explicitly labelled simulation assumptions.
          </p>
        </div>
      </Panel>
      <Panel title="AI model and spending">
        <div className="panel-body">
          <dl className="spending-summary">
            <div>
              <dt>Daily AI budget</dt>
              <dd>${money(s.daily_ai_budget)}</dd>
            </div>
            <div>
              <dt>Spent + reserved today</dt>
              <dd>${money(s.daily_ai_spent_or_reserved, 6)}</dd>
            </div>
          </dl>
          <div className="form-row">
            <label className="form-field">
              Model
              <select
                value={model || s.model}
                onChange={(e) => setModel(e.target.value)}
              >
                {s.available_models.map((x) => (
                  <option key={x.model} value={x.model}>
                    {x.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={
                s.bot.status === "RUNNING" || modelChange.isPending || !selected
              }
              onClick={() => modelChange.mutate()}
            >
              Save model
            </button>
          </div>
          <dl className="pricing-grid">
            <div>
              <dt>Input / 1M tokens</dt>
              <dd>${money(selected?.input_per_million)}</dd>
            </div>
            <div>
              <dt>Cached input / 1M tokens</dt>
              <dd>${money(selected?.cached_input_per_million, 3)}</dd>
            </div>
            <div>
              <dt>Output / 1M tokens</dt>
              <dd>${money(selected?.output_per_million)}</dd>
            </div>
          </dl>
          <p className="panel-note">
            Pricing verified {selected?.verified_at}. Estimates are separate
            from provider invoices. Whole-chain reservation occurs before paid
            inference.
          </p>
          {modelChange.error && <Failure error={modelChange.error} />}
        </div>
      </Panel>
      <Panel title="Protective monitoring history">
        {historyQuery.error && <Failure error={historyQuery.error} />}
        {historyQuery.isPending && <Loading />}
        {history?.length === 0 ? (
          <div className="empty">
            {historyPage.page === 0
              ? "No protective monitoring incidents recorded."
              : "No incidents on this page. Use Previous to return to newer records."}
          </div>
        ) : (
          <div className="panel-body protection-history">
            {history?.map((e) => (
              <details key={e.id}>
                <summary>
                  {stamp(e.timestamp)} · {e.status}
                </summary>
                <pre>{JSON.stringify(e.evidence, null, 2)}</pre>
              </details>
            ))}
          </div>
        )}
        <Pagination
          label="Protective monitoring history"
          {...historyPage}
          count={history?.length ?? 0}
          hasNext={(historyQuery.data?.length ?? 0) > historyPage.pageSize}
          loading={historyQuery.isFetching}
          error={!!historyQuery.error}
          onPageChange={historyPage.setPage}
          onPageSizeChange={historyPage.setPageSize}
        />
      </Panel>
    </>
  );
}
