import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
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

function useFutures<T>(path: string) {
  return useQuery({
    queryKey: ["futures", path],
    queryFn: () => api<T>(`/${path}`),
    refetchInterval: 15_000,
  });
}
function Protection({ bot }: { bot: FuturesBot }) {
  const unresolved = ["PENDING", "BLOCKED", "UNAVAILABLE", "UNRESOLVED"].includes(
    bot.protection.status || "",
  );
  return (
    <>
      {bot.error && (
        <div className="notice error" role="alert">
          Worker: {bot.error}
        </div>
      )}
      {unresolved && (
        <div className="notice error" role="alert">
          Protection {bot.protection.status}:{" "}
          {bot.protection.error || "Exit intent awaiting a valid observation."}{" "}
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
  const { data: p, error: performanceError } =
    useFutures<FuturesPerformance>("performance");
  if (error) return <Failure error={error} />;
  if (!o) return <Loading />;
  const stale = !o.market_timestamp || Date.now() - o.market_timestamp > 60_000;
  return (
    <>
      <div className="page-title">
        <div className="eyebrow">
          USDⓈ-M BTCUSDT PERPETUAL · VIRTUAL CAPITAL
        </div>
        <h1>Futures portfolio overview</h1>
        <p>Research run {o.run_key}. Spot history remains separate.</p>
        <Badge>{o.bot.status}</Badge>
      </div>
      <Protection bot={o.bot} />
    {o.risk_halt && <div className="notice error" role="alert">AI portfolio risk halt: new exposure is disabled. Protective monitoring remains active.</div>}
      {stale && (
        <div className="notice error">
          Mark data is unavailable or stale. Displayed equity is the last
          observed valuation.
        </div>
      )}
      <div className="metrics-row">
        <Metric
          label="Total equity"
          value={`${money(o.equity, 4)} USDT`}
          sub={`Lifetime ${money(o.lifetime_pnl, 4)} · ${money(o.return_percent)}%`}
        />
        <Metric
          label="Wallet balance"
          value={`${money(o.wallet, 4)} USDT`}
          sub="Settled balance, including reserved collateral"
        />
        <Metric
          label="Free balance"
          value={`${money(o.free_balance, 4)} USDT`}
          sub={`Isolated margin ${money(o.margin, 4)} USDT`}
        />
        <Metric
          label="Position"
          value={o.position_side}
          sub={
            o.position
              ? `${o.position.quantity} BTC contracts · ${o.position.leverage}x ISOLATED`
              : "No open Futures position"
          }
        />
      </div>
      <div className="metrics-row">
        <Metric
          label="Unrealized P&L"
          value={`${money(o.unrealized_pnl, 4)} USDT`}
          sub="Mark-price P&L before future closing costs"
        />
        <Metric
          label="Realized trading P&L"
          value={`${money(o.realized_pnl, 4)} USDT`}
          sub="Includes commissions when charged"
        />
        <Metric
          label="Today / month"
          value={`${money(o.today_pnl, 4)} / ${money(o.month_pnl, 4)}`}
          sub="USDT · current UTC periods incomplete"
        />
        <Metric
          label="Funding net"
          value={`${money(o.funding, 6)} USDT`}
          sub="Positive receipt · negative payment"
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
        title="Futures equity comparison"
        aside={<Badge>AI / DETERMINISTIC</Badge>}
      >
        <EquityChart rows={p?.snapshots || []} futures />
        <p className="panel-note">{o.benchmark_assumptions}</p>
      </Panel>
      <div className="two-col">
        <Panel title="Daily P&L · UTC">
          <PeriodChart rows={p?.daily || []} />
        </Panel>
        <Panel title="Monthly P&L · UTC">
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
        <Panel title="Latest research decision">
          {o.recent_decision ? (
            <>
              <ActionBadge action={o.recent_decision.action} />
              <Badge>{o.recent_decision.status}</Badge>
              <DecisionTime timestamp={o.recent_decision.timestamp} />
              <p>{o.recent_decision.reason}</p>
            </>
          ) : (
            <p>No decisions yet.</p>
          )}
          <p className="panel-note">{o.liquidation_assumptions}</p>
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
          <div className="metrics-row">
            <Metric
              label="Futures bid / ask"
              value={`${money(m.quote?.bid)} / ${money(m.quote?.ask)}`}
              sub={`Quote observed: ${stamp(m.quote_timestamp)}`}
            />
            <Metric
              label="Mark / index"
              value={`${money(mark?.mark)} / ${money(mark?.index)}`}
              sub={`Mark source: ${stamp(mark?.mark_time)}`}
            />
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
                        {key === "candle_time"
                          ? stamp(Number(value))
                          : String(value)}
                      </strong>
                    </div>
                  ))}
                </div>
              </Panel>
            ))}
          </div>
          <Panel title="Contract constraints">
            <p>
              Quantity step {m.contract?.step || "Unavailable"} BTC · minimum
              quantity {m.contract?.min_qty || "Unavailable"} BTC · minimum
              notional {m.contract?.min_notional || "Unavailable"} USDT
            </p>
            <p className="panel-note">
              Current funding is not a forecast or a guarantee of the next
              settlement rate.
            </p>
          </Panel>
        </>
      )}
    </>
  );
}

function FuturesDecisionDetail({
  id,
  close,
}: {
  id: string;
  close: () => void;
}) {
  const { data: d, error } = useFutures<FuturesDetail>(`decisions/${id}`);
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
            <ActionBadge action={d.decision.action} />
            <Badge>{d.decision.status}</Badge>
            <DecisionTime timestamp={d.decision.timestamp} />
            <p>Completed: {stamp(d.decision.ready_at)}</p>
            <p>{d.decision.reason}</p>
            <p>
              Strategy {d.decision.strategy} · prompt{" "}
              {d.decision.prompt_version}
            </p>
            <h3>Eligibility and agent agreement</h3>
            <pre>{JSON.stringify(d.decision.proposal, null, 2)}</pre>
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
            <p>
              Proposed {d.decision.risk.proposed_quantity || "0"} BTC · approved{" "}
              {d.decision.risk.quantity || "0"} BTC · leverage{" "}
              {d.decision.risk.leverage || "—"}x
            </p>
            <pre>{JSON.stringify(d.decision.risk, null, 2)}</pre>
            <h3>Execution / liquidation settlement</h3>
            <pre>{JSON.stringify(d.fill, null, 2)}</pre>
            <h3>Protective attempts</h3>
            <pre>{JSON.stringify(d.protection_events, null, 2)}</pre>
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
  const [kind, setKind] = useState("AI"),
    [offset, setOffset] = useState(0),
    [selected, select] = useState<string | null>(null);
  const { data: decisions, error } = useFutures<FuturesDecision[]>(
    `decisions?kind=${kind}&offset=${offset}`,
  );
  const { data: positions, error: positionError } = useFutures<
    FuturesPosition[]
  >(`positions?kind=${kind}&offset=${offset}`);
  const { data: funding, error: fundingError } = useFutures<FuturesFunding[]>(
    `funding?kind=${kind}&offset=${offset}`,
  );
  return (
    <>
      <div className="page-title">
        <h1>Futures decisions & trading history</h1>
        <label>
          Research portfolio{" "}
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setOffset(0);
            }}
          >
            <option value="AI">AI-controlled</option>
            <option value="DETERMINISTIC">Deterministic comparator</option>
          </select>
        </label>
        <p>Spot records are preserved separately and excluded from this run.</p>
      </div>
      {error && <Failure error={error} />}
      <Panel title="Decision journal">
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
                  <td>{d.reason}</td>
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
      </Panel>
      {positionError && <Failure error={positionError} />}
      <Panel title="Isolated positions">
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
      </Panel>
      {fundingError && <Failure error={fundingError} />}
      <Panel title="Funding transfers">
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
      </Panel>
      <div className="pagination">
        <button
          disabled={!offset}
          onClick={() => setOffset(Math.max(0, offset - 50))}
        >
          Previous
        </button>
        <span>Page {offset / 50 + 1} · each journal is paginated</span>
        <button
          disabled={
            Math.max(
              decisions?.length || 0,
              positions?.length || 0,
              funding?.length || 0,
            ) < 50
          }
          onClick={() => setOffset(offset + 50)}
        >
          Next
        </button>
      </div>
      {selected && (
        <FuturesDecisionDetail id={selected} close={() => select(null)} />
      )}
    </>
  );
}

export function FuturesSettingsPage() {
  const { data: s, error } = useFutures<FuturesSettings>("settings"),
    client = useQueryClient();
  const [model, setModel] = useState(""),
    [leverage, setLeverage] = useState(0);
  const refresh = () => client.invalidateQueries({ queryKey: ["futures"] });
  const controls = useMutation({
    mutationFn: (command: string) => api(`/bot/${command}`, { method: "POST" }),
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
        <h1>Futures bot settings</h1>
        <p>Paper-only · BTCUSDT perpetual · research run {s.run_key}</p>
      </div>
      <Protection bot={s.bot} />
    {s.risk_halt && <div className="notice error" role="alert">Portfolio risk halt requires operator review before new exposure.</div>}
      <Panel title="Autonomous worker" aside={<Badge>{s.bot.status}</Badge>}>
        <div className="controls">
          {["start", "pause", "resume", "stop"].map((command) => (
            <button
              key={command}
              disabled={
                controls.isPending ||
                ((command === "start" || command === "resume") &&
                  !s.automation_enabled)
              }
              onClick={() => controls.mutate(command)}
            >
              {command.toUpperCase()}
            </button>
          ))}
        </div>
        {controls.error && <Failure error={controls.error} />}
        <p>{s.protective_policy}</p>
        <p>
          Heartbeat {stamp(s.bot.heartbeat)} · initial balance{" "}
          {s.initial_capital} virtual USDT
        </p>
      </Panel>
      {s.tier_status !== "CONFIGURED_OPERATOR_EVIDENCE" && (
        <div className="notice error" role="alert">
          Verified maintenance-margin tiers are unavailable. New entries are
          disabled. Configure a sourced, dated tier book before research
          activation.
        </div>
      )}
      <Panel title="Isolated margin and deterministic risk">
        <label>
          Leverage{" "}
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
            !leverage || s.bot.status === "RUNNING" || leverageChange.isPending
          }
          onClick={() => leverageChange.mutate()}
        >
          Save leverage
        </button>
        {leverageChange.error && <Failure error={leverageChange.error} />}
        <p>
          Pause and close positions in both portfolios before changing leverage.
        </p>
        <div className="economics">
          {Object.entries(s.risk)
            .filter(([k]) => k !== "tiers")
            .map(([k, v]) => (
              <div key={k}>
                <span>{k.replaceAll("_", " ")}</span>
                <strong>{["margin_allocation", "max_notional", "risk_per_trade", "stop_loss", "fee_rate", "slippage_rate", "liquidation_fee_rate", "max_daily_loss", "max_drawdown"].includes(k) ? `${money(Number(v)*100, 3)}%` : k.includes("leverage") ? `${v}x` : k.endsWith("seconds") ? `${v}s` : String(v)}</strong>
              </div>
            ))}
        </div>
        <details>
          <summary>Maintenance-tier evidence and verification time</summary>
          <pre>{JSON.stringify(s.risk.tiers, null, 2)}</pre>
        </details>
        <p className="panel-note">
          Risk and cost fractions are displayed as percentages. Costs and liquidation are explicitly labelled simulation assumptions.
        </p>
      </Panel>
      <Panel title="AI model and spending">
        <p>
          Daily limit ${s.daily_ai_budget} · spent plus reserved $
          {money(s.daily_ai_spent_or_reserved, 6)}
        </p>
        <label>
          Model{" "}
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
        <p>
          Per million tokens: input ${selected?.input_per_million} · cached $
          {selected?.cached_input_per_million} · output $
          {selected?.output_per_million}
        </p>
        <p>
          Pricing verified {selected?.verified_at}. Estimates are separate from
          provider invoices. Whole-chain reservation occurs before paid
          inference.
        </p>
        <button
          disabled={
            s.bot.status === "RUNNING" || modelChange.isPending || !selected
          }
          onClick={() => modelChange.mutate()}
        >
          Save model
        </button>
        {modelChange.error && <Failure error={modelChange.error} />}
      </Panel>
      <Panel title="Protective monitoring history">
        {s.protection_events.map((e) => (
          <details key={e.id}>
            <summary>
              {stamp(e.timestamp)} · {e.status}
            </summary>
            <pre>{JSON.stringify(e.evidence, null, 2)}</pre>
          </details>
        ))}
      </Panel>
    </>
  );
}
