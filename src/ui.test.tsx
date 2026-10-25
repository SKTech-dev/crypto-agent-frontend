import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { DecisionTime } from "./ui";

it("shows the journal timestamp in Sri Lanka alongside the original UTC time", () => {
  render(<DecisionTime timestamp={Date.parse("2026-10-25T17:15:07Z")} />);
  expect(
    screen.getByText("2026-10-25 22:45:07 Sri Lanka (UTC+05:30)"),
  ).toBeInTheDocument();
  expect(screen.getByText("2026-10-25 17:15:07 UTC")).toBeInTheDocument();
});

it("handles Sri Lankan midnight without changing the underlying UTC date", () => {
  render(<DecisionTime timestamp={Date.parse("2026-10-25T18:30:00Z")} />);
  expect(
    screen.getByText("2026-10-26 00:00:00 Sri Lanka (UTC+05:30)"),
  ).toBeInTheDocument();
  expect(screen.getByText("2026-10-25 18:30:00 UTC")).toBeInTheDocument();
});
