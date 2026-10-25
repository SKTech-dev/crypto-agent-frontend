import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, Route, Routes } from "react-router-dom";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Bitcoin,
  ChartCandlestick,
  ChevronRight,
  CircleHelp,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Settings2,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { api, setToken } from "./api";
import type {
  Decision,
  Detail,
  Market,
  Overview,
  Performance,
  Position,
  Settings,
} from "./contracts";
import { CandleChart, EquityChart, PeriodChart } from "./charts";
import {
  ActionBadge,
  Badge,
  Failure,
  Loading,
  Metric,
  Panel,
  money,
  stamp,
} from "./ui";

export function useData<T>(key: string) {
  return useQuery({
    queryKey: [key],
    queryFn: () => api<T>(`/${key}`),
    refetchInterval: 15_000,
  });
}

export function App() {
  const [authenticated, setAuthenticated] = useState(false),
    [token, updateToken] = useState(""),
    [error, setError] = useState("");
  const client = useQueryClient();
  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setToken(token);
    try {
      await api("/settings");
      setAuthenticated(true);
      updateToken("");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!authenticated)
    return (
      <div className="login">
        <div className="login-card">
          <div className="brand-icon">
            <Bitcoin />
          </div>
          <Badge tone="green">PAPER TRADING RESEARCH</Badge>
          <h1>A clearer view of every decision.</h1>
          <p>
            Private access to your autonomous Bitcoin research portfolio. All
            capital and trades are simulated.
          </p>
          <form onSubmit={connect}>
            <label htmlFor="token">Operator access token</label>
            <input
              id="token"
              type="password"
              value={token}
              onChange={(e) => updateToken(e.target.value)}
              autoComplete="off"
              required
            />
            <button className="primary" type="submit">
              <LockKeyhole size={16} /> Open research dashboard
            </button>
            {error && (
              <p role="alert" className="negative">
                {error}
              </p>
            )}
          </form>
          <small>Your token stays in memory for this session.</small>
        </div>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Bitcoin size={25} />
          </div>
          <div>
            bitwise<span>RESEARCH TERMINAL</span>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {[
            ["/", "Overview", LayoutDashboard],
            ["/market", "BTC market", ChartCandlestick],
            ["/decisions", "Decisions & trades", Workflow],
            ["/settings", "Bot settings", Settings2],
          ].map(([path, label, Icon]) => {
            const I = Icon as typeof Activity;
            return (
              <NavLink key={String(path)} to={String(path)} end={path === "/"}>
                <I size={18} />
                {String(label)}
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="paper-card">
            <ShieldCheck size={19} />
            <strong>100% virtual capital</strong>
            <p>
              Real market observations.
              <br />
              Internal paper execution.
            </p>
          </div>
          <span>
            <CircleHelp size={14} /> Research, measured honestly.
          </span>
          <button
            className="quiet"
            onClick={() => {
              setToken("");
              client.clear();
              setAuthenticated(false);
            }}
          >
            <LogOut size={15} /> Lock workspace
          </button>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            <span className="muted">Workspace</span> <ChevronRight size={13} />{" "}
            Bitcoin research
          </span>
          <Badge tone="green">
            <i /> PAPER MODE
          </Badge>
        </header>
        <div className="page">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/market" element={<MarketPage />} />
            <Route path="/decisions" element={<History />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
        <footer>
          BITWISE RESEARCH{" "}
          <span>Virtual performance · UTC reporting · No real orders</span>
        </footer>
      </main>
    </div>
  );
}

export function Dashboard() {
  const { data: o, error } = useData<Overview>("overview"),
    { data: p } = useData<Performance>("performance");
  if (error) return <Failure error={error} />;
  if (!o) return <Loading />;
  const stale = !o.market_timestamp || Date.now() - o.market_timestamp > 60_000;
  return (
    <>
      <div className="page-title">
        <div className="eyebrow">YOUR RESEARCH AT A GLANCE</div>
        <h1>
          Portfolio overview <span className="title-dot" />
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
              ? "Market data unavailable or stale"
              : `Updated ${stamp(o.market_timestamp)}`}
          </small>
        </div>
      </div>
      {(o.bot.risk_halt || o.bot.error) && (
        <div className="notice error">
          {o.bot.risk_halt ? "Risk halt: new exposure is blocked. " : ""}
          {o.bot.error ? `Worker reported ${o.bot.error}.` : ""}
        </div>
      )}
      <div className="hero-grid">
        <section className="equity-card">
          <span className="eyebrow">
            TOTAL PORTFOLIO EQUITY <Badge>VIRTUAL USDT</Badge>
          </span>
          <div className="equity-value">
            ${money(o.equity)}
            <span>USDT</span>
          </div>
          <div
            className={Number(o.lifetime_pnl) >= 0 ? "positive" : "negative"}
          >
            <ArrowUpRight size={16} /> {Number(o.lifetime_pnl) >= 0 ? "+" : ""}
            {money(o.lifetime_pnl)} USDT{" "}
            <Badge tone={Number(o.return_percent) >= 0 ? "green" : "red"}>
              {money(o.return_percent)}%
            </Badge>
            <span className="muted"> since inception</span>
          </div>
          <div className="hero-bottom">
            <div>
              Starting capital<strong>{money(o.portfolio.initial)} USDT</strong>
            </div>
            <div>
              Available cash<strong>{money(o.portfolio.cash)} USDT</strong>
            </div>
            <div>
              BTC holdings<strong>{money(o.portfolio.btc, 8)} BTC</strong>
            </div>
          </div>
        </section>
        <section className="btc-card">
          <div className="btc-card-top">
            <span className="coin">
              <Bitcoin size={23} />
            </span>
            <div>
              <strong>Bitcoin</strong>
              <small>BTC / USDT</small>
            </div>
            <Badge>{stale ? "STALE" : "SPOT"}</Badge>
          </div>
          <strong className="btc-price">
            ${o.market_timestamp ? money(o.price) : "—"}
          </strong>
          <p>Public Binance Spot market</p>
          <div className="market-line">
            <Activity size={16} />
            <span>
              {stale
                ? "Awaiting fresh observations"
                : "Market observations connected"}
            </span>
          </div>
          <NavLink to="/market">
            Explore BTC market <ArrowUpRight size={16} />
          </NavLink>
        </section>
      </div>
      <div className="metrics-row">
        <Metric
          label="Today's trading P&L"
          value={`${Number(o.today_pnl) >= 0 ? "+" : ""}${money(o.today_pnl)} USDT`}
          positive={Number(o.today_pnl) >= 0}
          sub="Current UTC day · incomplete"
        />
        <Metric
          label="This month's P&L"
          value={`${Number(o.month_pnl) >= 0 ? "+" : ""}${money(o.month_pnl)} USDT`}
          positive={Number(o.month_pnl) >= 0}
          sub="Current UTC month · incomplete"
        />
        <Metric
          label="Realized / unrealized"
          value={`${money(o.realized_pnl)} / ${money(o.unrealized_pnl)}`}
          sub="USDT · fees included in cost basis"
        />
        <Metric
          label="Completed trades"
          value={String(o.closed_trades)}
          sub={`${Number(o.portfolio.btc) > 0 ? 1 : 0} open · ${o.winning_trades} wins · ${o.losing_trades} losses · ${money(o.win_rate)}% win rate`}
        />
      </div>
      <Panel
        title="Portfolio performance"
        aside={
          <div className="legend">
            <span className="lime-dot" /> AI portfolio{" "}
            <span className="purple-dot" /> BTC hold{" "}
            <span className="orange-dot" /> Indicator strategy
          </div>
        }
      >
        <EquityChart rows={p?.snapshots || []} />
        <div className="chart-foot">
          <span>Comparable capital, allocation and cost assumptions</span>
          <span>USDT · Marked at observed bid</span>
        </div>
      </Panel>
      <div className="two-col">
        <Panel title="Daily profit & loss" aside={<Badge>UTC</Badge>}>
          <PeriodChart rows={p?.daily || []} />
        </Panel>
        <Panel title="Monthly profit & loss" aside={<Badge>UTC</Badge>}>
          <PeriodChart rows={p?.monthly || []} />
        </Panel>
      </div>
      <div className="two-col">
        <Panel
          title="Latest AI decision"
          aside={
            <NavLink to="/decisions" className="text-link">
              All decisions <ArrowUpRight size={14} />
            </NavLink>
          }
        >
          {o.recent_decision ? (
            <div className="decision-preview">
              <div>
                <ActionBadge action={o.recent_decision.action} />
                <small>{stamp(o.recent_decision.timestamp)}</small>
              </div>
              <h3>{o.recent_decision.status.replaceAll("_", " ")}</h3>
              <p>{o.recent_decision.reason}</p>
              <small>{o.recent_decision.strategy}</small>
            </div>
          ) : (
            <div className="empty">No decisions recorded yet.</div>
          )}
        </Panel>
        <Panel title="Research economics">
          <div className="economics">
            {[
              ["Trading commissions", `${money(o.portfolio.fees, 4)} USDT`],
              ["Simulated slippage", `${money(o.portfolio.slippage, 4)} USDT`],
              ["AI inference cost", `$${money(o.ai_cost, 4)}`],
              ["Unresolved AI reservations", `$${money(o.ai_reserved, 4)}`],
              [
                "Combined economic P&L",
                `${money(o.economic_pnl, 4)} USD equiv.`,
              ],
              ["Maximum drawdown", `${money(Number(o.max_drawdown) * 100)}%`],
            ].map(([k, v]) => (
              <div key={k}>
                <span>{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <p className="panel-note">
            AI expenses are actual operating estimates, separate from virtual
            trading P&L. Combined value assumes USDT ≈ USD.
          </p>
        </Panel>
      </div>
      <Panel title="Latest paper fills">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time (UTC)</th>
                <th>Action</th>
                <th>Quantity</th>
                <th>Fill price</th>
                <th>Fee</th>
              </tr>
            </thead>
            <tbody>
              {o.recent_fills.map((f) => (
                <tr key={f.id}>
                  <td>{stamp(f.timestamp)}</td>
                  <td>
                    <ActionBadge action={f.side} />
                  </td>
                  <td>{money(f.quantity, 8)} BTC</td>
                  <td>${money(f.price)}</td>
                  <td>{money(f.fee, 5)} USDT</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!o.recent_fills.length && (
            <div className="empty">
              No simulated fills yet. Trades appear here when evidence and risk
              policy permit.
            </div>
          )}
        </div>
      </Panel>
    </>
  );
}

function MarketPage() {
  const { data: m, error } = useData<Market | null>("market");
  if (error) return <Failure error={error} />;
  if (m === undefined) return <Loading />;
  return (
    <>
      <div className="page-title">
        <div className="eyebrow">PUBLIC BINANCE SPOT</div>
        <h1>Bitcoin market</h1>
        <p>Completed candles, deterministic indicators, original evidence.</p>
      </div>
      {!m ? (
        <div className="empty">
          Start the independent worker to collect real market observations.
        </div>
      ) : (
        <>
          <div className="metrics-row">
            <Metric
              label="BTC / USDT"
              value={`$${money(m.quote.bid)}`}
              sub={`Ask $${money(m.quote.ask)}`}
            />
            <Metric
              label="24h change"
              value={`${money(m.statistics.priceChangePercent)}%`}
              positive={Number(m.statistics.priceChangePercent) >= 0}
            />
            <Metric
              label="24h volume"
              value={`${money(m.statistics.volume)} BTC`}
            />
            <Metric
              label="Market regime"
              value={m.indicators.regime.replaceAll("_", " ")}
              sub={stamp(m.timestamp)}
            />
          </div>
          {Date.now() - m.timestamp > 60_000 && (
            <div className="notice error">
              Market observations are stale. New trading proposals must wait for
              fresh data.
            </div>
          )}
          <Panel
            title="BTCUSDT · 15 minute candles"
            aside={
              <div className="legend">
                <span className="purple-dot" /> EMA 12{" "}
                <span className="orange-dot" /> EMA 26
              </div>
            }
          >
            <CandleChart rows={m.candles} />
            <p className="panel-note">
              Only completed UTC candles. Volume appears below price. Latest
              update: {stamp(m.timestamp)}
            </p>
          </Panel>
          <div className="metrics-row">
            <Metric label="RSI · Wilder 14" value={money(m.indicators.rsi)} />
            <Metric
              label="MACD / signal"
              value={`${money(m.indicators.macd)} / ${money(m.indicators.macd_signal)}`}
            />
            <Metric
              label="ATR · Wilder 14"
              value={`$${money(m.indicators.atr)}`}
            />
            <Metric
              label="Relative volume"
              value={
                m.indicators.relative_volume
                  ? `${money(m.indicators.relative_volume)}×`
                  : "Unavailable"
              }
            />
          </div>
          <Panel title="Trend confirmation · 1 hour">
            <div className="metrics-row">
              <Metric label="Regime" value={m.trend_indicators.regime} />
              <Metric
                label="EMA 12"
                value={money(m.trend_indicators.ema_fast)}
              />
              <Metric
                label="EMA 26"
                value={money(m.trend_indicators.ema_slow)}
              />
              <Metric
                label="Momentum · 10 periods"
                value={`${money(Number(m.trend_indicators.momentum) * 100)}%`}
              />
            </div>
          </Panel>
        </>
      )}
    </>
  );
}

export function History() {
  const [offset, setOffset] = useState(0),
    [selected, select] = useState<string | null>(null);
  const { data: decisions, error } = useQuery({
      queryKey: ["decisions", offset],
      queryFn: () => api<Decision[]>(`/decisions?offset=${offset}`),
      refetchInterval: 15_000,
    }),
    { data: positions } = useData<Position[]>("positions");
  return (
    <>
      <div className="page-title">
        <div className="eyebrow">THE COMPLETE AUDIT TRAIL</div>
        <h1>Decisions & trading history</h1>
        <p>
          Inspect the evidence that was available when each decision was made.
        </p>
      </div>
      {error && <Failure error={error} />}
      <Panel
        title="Decision journal"
        aside={<Badge>{decisions?.length || 0} RECORDS</Badge>}
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Timestamp (UTC)</th>
                <th>Action</th>
                <th>Outcome</th>
                <th>Original reasoning</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {decisions?.map((d) => (
                <tr key={d.id}>
                  <td>{stamp(d.timestamp)}</td>
                  <td>
                    <ActionBadge action={d.action} />
                  </td>
                  <td>
                    <Badge
                      tone={
                        d.status === "REJECTED" || d.status === "FAILED"
                          ? "red"
                          : "neutral"
                      }
                    >
                      {d.status}
                    </Badge>
                  </td>
                  <td className="reason-cell">{d.reason}</td>
                  <td>
                    <button
                      className="quiet"
                      onClick={() => select(d.id)}
                      aria-label={`Inspect decision ${d.id}`}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {decisions?.length === 0 && (
            <div className="empty">
              No decisions recorded. HOLD, rejected, missed and failed outcomes
              will all appear here.
            </div>
          )}
        </div>
        <div className="pagination">
          <button
            disabled={!offset}
            onClick={() => setOffset(Math.max(0, offset - 50))}
          >
            Previous
          </button>
          <span>
            Records {offset + 1}–{offset + (decisions?.length || 0)}
          </span>
          <button
            disabled={(decisions?.length || 0) < 50}
            onClick={() => setOffset(offset + 50)}
          >
            Next
          </button>
        </div>
      </Panel>
      <Panel title="Positions & completed trades">
        <div className="position-list">
          {positions?.map((p) => (
            <article key={p.id} className="position">
              <div className="position-head">
                <Badge tone={p.closed_at ? "neutral" : "green"}>
                  {p.closed_at ? "CLOSED" : "OPEN"}
                </Badge>
                <strong>{money(p.quantity, 8)} BTC</strong>
                <span
                  className={Number(p.realized) >= 0 ? "positive" : "negative"}
                >
                  {p.realized == null
                    ? "Unrealized position"
                    : `${money(p.realized, 4)} USDT net`}
                </span>
              </div>
              <div className="two-col">
                <div>
                  <h3>
                    <ArrowDownLeft size={15} /> Entry · ${money(p.entry_price)}
                  </h3>
                  <small>{stamp(p.opened_at)}</small>
                  <p>Fee {money(p.entry_fee, 5)} USDT</p>
                  <button onClick={() => select(p.entry_decision_id)}>
                    View original entry reasoning
                  </button>
                </div>
                <div>
                  <h3>
                    <ArrowUpRight size={15} /> Exit ·{" "}
                    {p.exit_price ? `$${money(p.exit_price)}` : "Still open"}
                  </h3>
                  <small>
                    {p.closed_at ? stamp(p.closed_at) : "Awaiting exit"}
                  </small>
                  <p>
                    {p.exit_trigger || "Protective monitoring enabled"}{" "}
                    {p.closed_at
                      ? `· ${money((p.closed_at - p.opened_at) / 3_600_000)} hours held`
                      : ""}
                  </p>
                  {p.exit_decision_id && (
                    <button onClick={() => select(p.exit_decision_id!)}>
                      View recorded exit reasoning
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
          {!positions?.length && (
            <div className="empty">No positions opened yet.</div>
          )}
        </div>
      </Panel>
      {selected && <DecisionDetail id={selected} close={() => select(null)} />}
    </>
  );
}

function DecisionDetail({ id, close }: { id: string; close: () => void }) {
  const { data: d, error } = useQuery({
    queryKey: ["detail", id],
    queryFn: () => api<Detail>(`/decisions/${id}`),
  });
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Decision evidence"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-head">
          <h2>Decision evidence</h2>
          <button onClick={close} aria-label="Close decision">
            Close
          </button>
        </div>
        {error && <Failure error={error} />}{" "}
        {!d ? (
          <Loading />
        ) : (
          <>
            <div className="detail-top">
              <ActionBadge action={d.decision.action} />
              <Badge>{d.decision.status}</Badge>
              <small>{stamp(d.decision.timestamp)}</small>
            </div>
            <h3>Recorded explanation</h3>
            <p>{d.decision.reason}</p>
            <div className="detail-meta">
              <span>Strategy: {d.decision.strategy}</span>
              <span>Prompt: {d.decision.prompt_version}</span>
              <span>
                Reference: ${money(d.market?.evidence.candles.at(-1)?.close)}
              </span>
              <span>
                Regime: {d.market?.evidence.indicators.regime || "Unavailable"}
              </span>
              <span>Market evidence: {stamp(d.market?.timestamp)}</span>
            </div>
            <p>
              Supporting:{" "}
              {d.decision.proposal.supporting_agents?.join(", ") ||
                "None recorded"}{" "}
              · Opposing:{" "}
              {d.decision.proposal.opposing_agents?.join(", ") ||
                "None recorded"}
            </p>
            <p className="panel-note">
              Model confidence is subjective and uncalibrated. It is not a
              probability of a profitable trade.
            </p>
            <h3>Agent findings</h3>
            {d.agents.map((a) => (
              <div className="agent" key={a.id}>
                <div>
                  <Badge>{a.role}</Badge>{" "}
                  <ActionBadge action={a.output.action || "NO_DECISION"} />
                  <small>
                    {a.model} · {a.input_tokens + a.output_tokens} tokens · $
                    {money(a.cost, 5)} · {a.duration_ms}ms
                  </small>
                </div>
                <p>{a.output.reason || a.error}</p>
                <ul>
                  {a.output.evidence?.map((e, n) => (
                    <li key={n}>{e}</li>
                  ))}
                </ul>
                {a.output.contradictions?.length ? (
                  <p className="negative">
                    Contradictions: {a.output.contradictions.join("; ")}
                  </p>
                ) : null}
                {a.output.risks?.length ? (
                  <p className="muted">Risks: {a.output.risks.join("; ")}</p>
                ) : null}
              </div>
            ))}
            <h3>Deterministic risk evaluation</h3>
            {d.risk ? (
              <>
                <Badge
                  tone={d.risk.result.outcome === "APPROVED" ? "green" : "red"}
                >
                  {d.risk.result.outcome}
                </Badge>
                <p>
                  {d.risk.result.reasons.join("; ") ||
                    d.risk.result.rules.join(" · ")}
                </p>
                <p>
                  Approved quantity {d.risk.result.quantity} BTC · estimated fee{" "}
                  {d.risk.result.estimated_fee} USDT
                </p>
                <details>
                  <summary>Portfolio used for validation</summary>
                  <pre>{JSON.stringify(d.risk.result.portfolio, null, 2)}</pre>
                </details>
              </>
            ) : (
              <p>No execution risk evaluation recorded.</p>
            )}
            {d.fill && (
              <>
                <h3>Paper fill</h3>
                <p>
                  {stamp(d.fill.timestamp)} · {d.fill.quantity} BTC @ $
                  {money(d.fill.price)} · fee {money(d.fill.fee, 5)} USDT
                </p>
              </>
            )}
            <details>
              <summary>Original market and indicator evidence</summary>
              <pre>{JSON.stringify(d.market?.evidence, null, 2)}</pre>
            </details>
          </>
        )}
      </section>
    </div>
  );
}

export function SettingsPage() {
  const { data: s, error } = useData<Settings>("settings"),
    client = useQueryClient();
  const [model, setModel] = useState(""),
    [inputPrice, setInputPrice] = useState("2"),
    [outputPrice, setOutputPrice] = useState("8");
  const mutation = useMutation({
    mutationFn: (command: string) => api(`/bot/${command}`, { method: "POST" }),
    onSuccess: () => client.invalidateQueries(),
  });
  const modelMutation = useMutation({
    mutationFn: () =>
      api("/settings/model", {
        method: "PUT",
        body: JSON.stringify({
          model,
          input_per_million: inputPrice,
          output_per_million: outputPrice,
        }),
      }),
    onSuccess: () => client.invalidateQueries(),
  });
  if (error) return <Failure error={error} />;
  if (!s) return <Loading />;
  return (
    <>
      <div className="page-title">
        <div className="eyebrow">OPERATOR CONTROL</div>
        <h1>Bot settings</h1>
        <p>
          One activation. Autonomous paper decisions within fixed risk limits.
        </p>
      </div>
      <Panel
        title="Trading worker"
        aside={
          <Badge tone={s.bot?.status === "RUNNING" ? "green" : "neutral"}>
            {s.bot?.status || "NOT INITIALIZED"}
          </Badge>
        }
      >
        <div className="controls">
          {(["start", "pause", "resume", "stop"] as const).map((c) => (
            <button
              className={c === "start" || c === "resume" ? "primary" : ""}
              key={c}
              disabled={
                mutation.isPending ||
                !s.bot ||
                ((c === "start" || c === "resume") &&
                  (!s.automation_enabled || s.bot.risk_halt)) ||
                (c === "start" &&
                  !["STOPPED", "ERROR"].includes(s.bot.status)) ||
                (c === "pause" && s.bot.status !== "RUNNING") ||
                (c === "resume" && s.bot.status !== "PAUSED")
              }
              onClick={() => mutation.mutate(c)}
            >
              {c.toUpperCase()}
            </button>
          ))}
        </div>
        {mutation.error && <Failure error={mutation.error} />}
        <p className="panel-note">{s.protective_policy}</p>
        {!s.automation_enabled && (
          <div className="notice">
            Set AUTO_TRADING_ENABLED=true on the backend and worker before
            starting paper automation.
          </div>
        )}
        <div className="metrics-row">
          <Metric label="Execution mode" value="PAPER ONLY" />
          <Metric
            label="Initial virtual capital"
            value={`${money(s.initial_capital)} USDT`}
          />
          <Metric
            label="Last worker heartbeat"
            value={
              s.bot?.heartbeat
                ? new Date(s.bot.heartbeat).toISOString().slice(11, 19)
                : "Awaiting worker"
            }
            sub={stamp(s.bot?.heartbeat)}
          />
          <Metric
            label="Last decision candle"
            value={
              s.bot?.last_candle
                ? new Date(s.bot.last_candle).toISOString().slice(11, 19)
                : "Not recorded"
            }
            sub={s.bot?.risk_halt ? "Risk halt active" : "No active risk halt"}
          />
        </div>
      </Panel>
      <div className="two-col">
        <Panel title="Deterministic risk policy">
          <div className="economics">
            {Object.entries(s.risk).map(([key, value]) => (
              <div key={key}>
                <span>{key.replaceAll("_", " ")}</span>
                <strong>
                  {key.includes("seconds")
                    ? `${value}s`
                    : key.includes("losses")
                      ? value
                      : `${money(Number(value) * 100, 2)}%`}
                </strong>
              </div>
            ))}
          </div>
          <p className="panel-note">
            Risk values are versioned through backend environment configuration.
            AI agents cannot change these limits.
          </p>
        </Panel>
        <Panel title="AI model & spending">
          <div className="economics">
            <div>
              <span>Active model</span>
              <strong>{s.model}</strong>
            </div>
            <div>
              <span>Daily spending limit</span>
              <strong>${money(s.daily_ai_budget)}</strong>
            </div>
            <div>
              <span>Spent + reserved today</span>
              <strong>${money(s.daily_ai_spent_or_reserved, 5)}</strong>
            </div>
            <div>
              <span>News evidence</span>
              <Badge>NEWS_UNAVAILABLE</Badge>
            </div>
          </div>
          <form
            className="model-form"
            onSubmit={(e) => {
              e.preventDefault();
              modelMutation.mutate();
            }}
          >
            <label htmlFor="model">Model name</label>
            <input
              id="model"
              value={model}
              placeholder={s.model}
              onChange={(e) => setModel(e.target.value)}
              required
            />
            <label htmlFor="input-price">
              Estimated input USD / million tokens
            </label>
            <input
              id="input-price"
              type="number"
              min="0.001"
              step="0.001"
              value={inputPrice}
              onChange={(e) => setInputPrice(e.target.value)}
            />
            <label htmlFor="output-price">
              Estimated output USD / million tokens
            </label>
            <input
              id="output-price"
              type="number"
              min="0.001"
              step="0.001"
              value={outputPrice}
              onChange={(e) => setOutputPrice(e.target.value)}
            />
            <button
              disabled={s.bot?.status === "RUNNING" || modelMutation.isPending}
            >
              Save model & estimates
            </button>
          </form>
          {modelMutation.error && <Failure error={modelMutation.error} />}
          <p className="panel-note">
            Pause before changing models. Verify current token prices. Failed
            calls retain conservative reservations when billing is uncertain.
          </p>
        </Panel>
      </div>
    </>
  );
}
