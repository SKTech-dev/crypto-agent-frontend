# Bitwise research dashboard

The default view is now BTCUSDT USD-M perpetual **FUTURES PAPER** research (`btc_perpetual_v1`). Dashboard, Market, History and Settings show LONG/SHORT/FLAT positions, wallet/free collateral/isolated margin, mark equity, funding, approximate liquidation, unresolved protective exits and the deterministic Futures comparator. Separate market timestamps expose stale executable quotes even when mark monitoring remains available. History can select either research portfolio and inspect original prompts, cached tokens, risk constraints, fills and funding transfers. The prior Spot components remain available for archive compatibility and tests; Spot balances are never Futures collateral.

The backend starts a new run STOPPED. A verified, dated maintenance-tier book is required for entries. At the default 100-USDT capital, the risk and exposure limits can make BTCUSDT minimum quantity/notional unexecutable. The UI reports this constraint; it does not increase leverage or relax limits. Review the backend migration report and README before selecting a development database or enabling automation.

React 19 + TypeScript + Vite + Tailwind CSS, TanStack Query, React Router and Lightweight Charts. Four responsive dark-mode pages: portfolio overview, BTC market, decision/position audit history and bot settings. All numbers come from the sibling FastAPI backend; no demonstration trades or synthetic market prices are presented as real data.

## Run locally

```powershell
npm.cmd ci
Copy-Item .env.example .env
# VITE_API_BASE_URL defaults to http://localhost:8000
npm.cmd run dev
```

Start the combined backend with `python -m app.service` as described in the sibling backend README. One backend service runs both the API and PostgreSQL trading worker. Open `http://localhost:5173`, then enter the backend's private `OPERATOR_TOKEN`. This credential stays in memory only; do not put secrets into Vite environment variables, URLs or Git. Lock/reload clears private access. API errors, uninitialized data and stale market observations are shown explicitly. Routine decisions and fills run in the independent worker even when this dashboard is closed.

The dashboard distinguishes fee-inclusive virtual trading P&L from estimated actual AI expenses, displays incomplete current UTC periods, and labels all capital as virtual. Decision detail shows original agent reasoning, contradictions, model/tokens/costs, market evidence, deterministic risk results and any fill. Positions link to both their original entry and exit decisions. Confidence is subjective and uncalibrated. A losing trade's explanation is always the original recorded explanation.

Risk parameters are backend configuration. Model changes require pausing. Selecting a model automatically displays its standard text input/output prices, official source and verification date. Save sends only the model ID; the backend resolves and stores the reviewed prices. No manual price entry is required. The dated catalog is not a live billing feed; API availability depends on the account. START requires `AUTO_TRADING_ENABLED=true` on the combined backend service. PAUSE/STOP preserve monitoring and protective full exits. The backend authenticates every private endpoint; CORS alone never authorizes a control.

## Checks

GitHub Actions runs the `Frontend checks / test` job for pull requests targeting `development`, updates to those PRs, and pushes/merges to `development`; manual runs are available too. It installs locked dependencies, runs ESLint, TypeScript and component tests, then builds the production frontend. The `frontend-dist` artifact is retained for seven days. No deployment secrets are needed. Commit and push the workflow to enable it, and make this check required in the `development` branch rules if failed checks should block merging. Netlify publishing is configured separately from PR validation.

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Vitest uses mocked API responses to verify portfolio rendering, separate cost reporting, original HOLD evidence, authenticated controls and unavailable-data behavior. Production build emits `dist/`. Node 24 is used locally/CI. `package-lock.json` locks the dependency graph.

## Netlify

Use the included `netlify.toml`: `npm run build`, publish `dist`. Set `VITE_API_BASE_URL` to the Railway API HTTPS origin and configure that frontend origin in backend CORS. SPA redirects and security headers are supplied. The content-security policy permits HTTPS API requests; localhost is allowed for local development only. Never configure OpenAI, Binance, PostgreSQL or operator credentials as frontend build variables. No deployment or publishing is performed automatically.

Source paths: `src/futures-contracts.ts` and `src/futures.tsx` contain the Futures contract and pages. `src/contracts.ts` preserves the Spot contract. `api.ts` owns private API requests, `App.tsx` selects the research view, `ui.tsx` contains shared components, and `charts.tsx` owns chart lifecycle/cleanup. Chart floats are for display only; all backend financial math uses Decimal. Backend OpenAPI is available at `/openapi.json`.
