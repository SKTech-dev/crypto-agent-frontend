import type { ReactNode } from "react";
export const money = (v: string | number | null | undefined, digits = 2) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(Number(v));
export const stamp = (v: number | null | undefined) =>
  v
    ? `${new Date(v).toISOString().replace("T", " ").slice(0, 19)} UTC`
    : "Not yet recorded";
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Panel({
  title,
  aside,
  children,
  className = "",
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
export function Metric({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong
        className={
          positive === undefined ? "" : positive ? "positive" : "negative"
        }
      >
        {value}
      </strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}
export function Loading() {
  return <div className="empty">Loading recorded research data…</div>;
}
export function Failure({ error }: { error: Error }) {
  return (
    <div className="notice error" role="alert">
      {error.message}
    </div>
  );
}
export function ActionBadge({ action }: { action: string }) {
  return (
    <Badge
      tone={action === "BUY" ? "green" : action === "SELL" ? "red" : "neutral"}
    >
      {action}
    </Badge>
  );
}
