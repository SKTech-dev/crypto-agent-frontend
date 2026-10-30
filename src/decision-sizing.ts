import type { FuturesDecision, FuturesRiskSizing } from "./futures-contracts";

function amount(value: string | undefined) {
  if (value == null || value.trim() === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function size(risk: FuturesRiskSizing, proposed: boolean) {
  const quantity = amount(
    proposed ? (risk.proposed_quantity ?? risk.quantity) : risk.quantity,
  );
  if (quantity == null) return undefined;
  const price = amount(risk.fill_price);
  const notional =
    quantity === 0
      ? 0
      : price != null && price > 0
        ? quantity * price
        : undefined;
  return {
    quantity,
    // Display-only arithmetic from persisted sizing, never a new trade calculation.
    notional:
      notional != null && Number.isFinite(notional) ? notional : undefined,
    margin: amount(risk.initial_margin),
    leverage: risk.leverage,
  };
}

export function decisionSizing(decision: FuturesDecision) {
  const recordedAction =
    decision.proposal.decision_trace?.coordinator_proposal.action;
  const action =
    recordedAction ??
    (typeof decision.proposal.action === "string"
      ? decision.proposal.action
      : decision.action);
  const executable = /^(OPEN|CLOSE)_(LONG|SHORT)$/.test(action);
  const executed = ["EXECUTED", "LIQUIDATED"].includes(decision.status);
  const direct =
    decision.risk.proposed_quantity != null || decision.risk.fill_price != null;
  const preview = executable
    ? (decision.evidence.ai_snapshot?.risk_previews?.[action] ??
      decision.risk.previews?.[action])
    : undefined;
  const planned =
    executable || executed
      ? direct
        ? size(decision.risk, true)
        : preview
          ? size(preview, true)
          : undefined
      : undefined;
  const traded = executed ? size(decision.risk, false) : undefined;
  return {
    action,
    planned,
    preview: !direct && !!preview,
    traded: traded && traded.quantity > 0 ? traded : undefined,
    executed,
    // Do not pick a direction from a set of candidate previews when none was selected.
    hasProposal: executable || executed,
  };
}
