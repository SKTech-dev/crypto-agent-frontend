import { useEffect, useRef } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type Time,
} from "lightweight-charts";
import type { Candle, Period, Snapshot } from "./contracts";

const base = {
  layout: {
    background: { type: ColorType.Solid, color: "transparent" },
    textColor: "#7f8b9f",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: 11,
  },
  grid: { vertLines: { color: "#171f2d" }, horzLines: { color: "#171f2d" } },
  rightPriceScale: { borderVisible: false },
  timeScale: { borderVisible: false, timeVisible: true },
  handleScroll: false,
  handleScale: false,
};
export function EquityChart({ rows }: { rows: Snapshot[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !rows.length) return;
    const chart = createChart(ref.current, {
      ...base,
      height: 270,
      autoSize: true,
    });
    const distinct = [
      ...new Map(rows.map((r) => [Math.floor(r.timestamp / 1000), r])).values(),
    ];
    chart
      .addSeries(AreaSeries, {
        lineColor: "#b0f37a",
        topColor: "#b0f37a30",
        bottomColor: "#b0f37a00",
        lineWidth: 2,
      })
      .setData(
        distinct.map((r) => ({
          time: Math.floor(r.timestamp / 1000) as Time,
          value: Number(r.equity),
        })),
      );
    chart
      .addSeries(LineSeries, { color: "#7e8ffa", lineWidth: 1, lineStyle: 2 })
      .setData(
        distinct.map((r) => ({
          time: Math.floor(r.timestamp / 1000) as Time,
          value: Number(r.benchmark_hold),
        })),
      );
    chart
      .addSeries(LineSeries, { color: "#e6ac68", lineWidth: 1, lineStyle: 2 })
      .setData(
        distinct.map((r) => ({
          time: Math.floor(r.timestamp / 1000) as Time,
          value: Number(r.benchmark_signal),
        })),
      );
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [rows]);
  return (
    <div ref={ref} className="chart">
      {!rows.length && (
        <div className="empty">
          Equity history will appear after the worker receives market data.
        </div>
      )}
    </div>
  );
}
export function PeriodChart({ rows }: { rows: Period[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !rows.length) return;
    const chart = createChart(ref.current, {
      ...base,
      timeScale: { borderVisible: false, timeVisible: false },
      height: 200,
      autoSize: true,
    });
    chart
      .addSeries(HistogramSeries, {
        priceFormat: { type: "price", precision: 3, minMove: 0.001 },
      })
      .setData(
        rows.map((r) => ({
          time: (r.period.length === 7 ? `${r.period}-01` : r.period) as Time,
          value: Number(r.pnl),
          color: Number(r.pnl) >= 0 ? "#b0f37a" : "#f27d8b",
        })),
      );
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [rows]);
  return (
    <div ref={ref} className="small-chart">
      {!rows.length && (
        <div className="empty">No recorded performance yet.</div>
      )}
    </div>
  );
}
function emas(rows: Candle[], period: number) {
  if (rows.length < period) return [];
  let avg =
    rows.slice(0, period).reduce((a, b) => a + Number(b.close), 0) / period;
  const output = [
    { time: Math.floor(rows[period - 1].open_time / 1000) as Time, value: avg },
  ];
  for (const row of rows.slice(period)) {
    avg = (Number(row.close) * 2) / (period + 1) + avg * (1 - 2 / (period + 1));
    output.push({ time: Math.floor(row.open_time / 1000) as Time, value: avg });
  }
  return output;
}
export function CandleChart({ rows }: { rows: Candle[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !rows.length) return;
    const chart = createChart(ref.current, {
      ...base,
      height: 420,
      autoSize: true,
      handleScroll: true,
      handleScale: true,
    });
    chart
      .addSeries(CandlestickSeries, {
        upColor: "#b0f37a",
        downColor: "#ef7d8d",
        borderVisible: false,
        wickUpColor: "#b0f37a",
        wickDownColor: "#ef7d8d",
      })
      .setData(
        rows.map((r) => ({
          time: Math.floor(r.open_time / 1000) as Time,
          open: Number(r.open),
          high: Number(r.high),
          low: Number(r.low),
          close: Number(r.close),
        })),
      );
    chart
      .addSeries(LineSeries, { color: "#9b9bff", lineWidth: 1 })
      .setData(emas(rows, 12));
    chart
      .addSeries(LineSeries, { color: "#e6ac68", lineWidth: 1 })
      .setData(emas(rows, 26));
    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: "volume",
      priceFormat: { type: "volume" },
    });
    volume
      .priceScale()
      .applyOptions({ scaleMargins: { top: 0.83, bottom: 0 } });
    volume.setData(
      rows.map((r) => ({
        time: Math.floor(r.open_time / 1000) as Time,
        value: Number(r.volume),
        color: Number(r.close) >= Number(r.open) ? "#b0f37a35" : "#ef7d8d35",
      })),
    );
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [rows]);
  return <div ref={ref} className="candle-chart" />;
}
