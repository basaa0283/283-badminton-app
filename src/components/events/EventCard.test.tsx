import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventCard } from "./EventCard";

const baseEvent = {
  id: "evt-1",
  title: "練習会",
  eventDate: "2026-06-01T10:00:00.000Z",
  location: "体育館",
  capacity: 20,
  attendingCount: 10,
  waitlistCount: 0,
  deadline: null,
  deadlineEnabled: false,
  myAttendance: null as null | { status: string; position: number | null },
};

describe("EventCard", () => {
  it("タイトルと場所が表示される", () => {
    render(<EventCard event={baseEvent} />);
    expect(screen.getByText("練習会")).toBeInTheDocument();
    expect(screen.getByText("体育館")).toBeInTheDocument();
  });

  it("参加人数 / 定員 が表示される", () => {
    render(<EventCard event={baseEvent} />);
    expect(screen.getByText(/参加:\s*10\/20人/)).toBeInTheDocument();
  });

  it("満員時は (満員) と表示", () => {
    render(<EventCard event={{ ...baseEvent, attendingCount: 20 }} />);
    expect(screen.getByText(/\(満員\)/)).toBeInTheDocument();
  });

  it("キャンセル待ち人数が表示される", () => {
    render(<EventCard event={{ ...baseEvent, waitlistCount: 3 }} />);
    expect(screen.getByText(/\(待ち3人\)/)).toBeInTheDocument();
  });

  it("締め切り超過なら 締め切り済み を表示", () => {
    render(
      <EventCard
        event={{
          ...baseEvent,
          deadlineEnabled: true,
          deadline: "2020-01-01T00:00:00.000Z",
        }}
      />,
    );
    expect(screen.getByText("締め切り済み")).toBeInTheDocument();
  });

  it("締め切り無効なら 締め切り済み を表示しない", () => {
    render(
      <EventCard
        event={{
          ...baseEvent,
          deadlineEnabled: false,
          deadline: "2020-01-01T00:00:00.000Z",
        }}
      />,
    );
    expect(screen.queryByText("締め切り済み")).not.toBeInTheDocument();
  });

  it("自分のwaitlist position が表示される", () => {
    render(
      <EventCard
        event={{
          ...baseEvent,
          myAttendance: { status: "waitlist", position: 2 },
        }}
      />,
    );
    expect(screen.getByText("キャンセル待ち 2番目")).toBeInTheDocument();
  });

  it("location が null なら場所アイコンを表示しない", () => {
    render(<EventCard event={{ ...baseEvent, location: null }} />);
    expect(screen.queryByText("体育館")).not.toBeInTheDocument();
  });

  it("capacity が null なら定員/付きで表示しない", () => {
    render(<EventCard event={{ ...baseEvent, capacity: null }} />);
    expect(screen.getByText(/参加:\s*10人/)).toBeInTheDocument();
    expect(screen.queryByText(/\/20/)).not.toBeInTheDocument();
  });

  it("/events/{id} へのリンクになっている", () => {
    render(<EventCard event={baseEvent} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/events/evt-1");
  });
});
