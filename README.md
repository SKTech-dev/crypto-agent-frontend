# Bitwise research dashboard

React 19 + TypeScript + Vite + Tailwind CSS, TanStack Query, React Router and Lightweight Charts. Four responsive dark-mode pages: portfolio overview, BTC market, decision/position audit history and bot settings. All numbers come from the sibling FastAPI backend; no demonstration trades or synthetic market prices are presented as real data.

## Run locally

```powershell
npm.cmd ci
Copy-Item .env.example .env
# VITE_API_BASE_URL defaults to http://localhost:8000
npm.cmd run dev
```

Start the backend API and independent PostgreSQL trading worker as described in the sibling backend README. Open `http://localhost:5173`, then enter the backend's private `OPERATOR_TOKEN`. This credential stays in memory only; do not put secrets into Vite environment variables, URLs or Git. Lock/reload clears private access. API errors, uninitialized data and stale market observations are shown explicitly. Routine decisions and fills run in the independent worker even when this dashboard is closed.

The dashboard distinguishes fee-inclusive virtual trading P&L from estimated actual AI expenses, displays incomplete current UTC periods, and labels all capital as virtual. Decision detail shows original agent reasoning, contradictions, model/tokens/costs, market evidence, deterministic risk results and any fill. Positions link to both their original entry and exit decisions. Confidence is subjective and uncalibrated. A losing trade's explanation is always the original recorded explanation.

Risk parameters are backend configuration. Model changes require pausing and entering current estimated token prices. START requires `AUTO_TRADING_ENABLED=true` on both services. PAUSE/STOP preserve monitoring and protective full exits. The backend authenticates every private endpoint; CORS alone never authorizes a control.

## Checks

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Vitest uses mocked API responses to verify portfolio rendering, separate cost reporting, original HOLD evidence, authenticated controls and unavailable-data behavior. Production build emits `dist/`. Node 24 is used locally/CI. `package-lock.json` locks the dependency graph.

## Netlify

Use the included `netlify.toml`: `npm run build`, publish `dist`. Set `VITE_API_BASE_URL` to the Railway API HTTPS origin and configure that frontend origin in backend CORS. SPA redirects and security headers are supplied. The content-security policy permits HTTPS API requests; localhost is allowed for local development only. Never configure OpenAI, Binance, PostgreSQL or operator credentials as frontend build variables. No deployment or publishing is performed automatically.

Source paths: `src/contracts.ts` mirrors the FastAPI JSON contract, `api.ts` owns private API requests, `App.tsx` contains the four pages, `ui.tsx` contains consistent small components, and `charts.tsx` owns financial chart lifecycle/cleanup. Chart floats are for display only; all backend financial math uses Decimal. Backend OpenAPI is available at `/openapi.json`.
