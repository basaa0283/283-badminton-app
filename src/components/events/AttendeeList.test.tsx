import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AttendeeList } from "./AttendeeList";

const make = (overrides = {}) => ({
  id: "att-1",
  status: "attending",
  comment: null,
  position: null,
  user: {
    id: "u1",
    nickname: "ツバサ",
    profileImageUrl: null,
    gender: null,
  },
  ...overrides,
});

describe("AttendeeList", () => {
  it("空配列なら何のセクションも表示しない", () => {
    const { container } = render(<AttendeeList attendees={[]} />);
    expect(container.querySelector("h4")).toBeNull();
  });

  it("参加者のみのセクションを表示", () => {
    render(
      <AttendeeList
        attendees={[
          make({ id: "1", status: "attending" }),
          make({ id: "2", status: "attending", user: { ...make().user, id: "u2", nickname: "いぶき" } }),
        ]}
      />,
    );
    expect(screen.getByText("参加 (2)")).toBeInTheDocument();
    expect(screen.getByText("ツバサ")).toBeInTheDocument();
    expect(screen.getByText("いぶき")).toBeInTheDocument();
  });

  it("空のセクションは表示しない", () => {
    render(<AttendeeList attendees={[make({ status: "attending" })]} />);
    expect(screen.getByText("参加 (1)")).toBeInTheDocument();
    expect(screen.queryByText(/キャンセル待ち/)).not.toBeInTheDocument();
    expect(screen.queryByText(/不参加/)).not.toBeInTheDocument();
  });

  it("waitlist は position 順にソートされる", () => {
    render(
      <AttendeeList
        attendees={[
          make({ id: "1", status: "waitlist", position: 3, user: { ...make().user, id: "u1", nickname: "Charlie" } }),
          make({ id: "2", status: "waitlist", position: 1, user: { ...make().user, id: "u2", nickname: "Alpha" } }),
          make({ id: "3", status: "waitlist", position: 2, user: { ...make().user, id: "u3", nickname: "Bravo" } }),
        ]}
      />,
    );
    const names = screen.getAllByText(/^(Alpha|Bravo|Charlie)$/);
    expect(names.map((n) => n.textContent)).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("waitlist セクションでは position 番号が表示される", () => {
    render(
      <AttendeeList
        attendees={[make({ status: "waitlist", position: 5 })]}
      />,
    );
    expect(screen.getByText("5.")).toBeInTheDocument();
  });

  it("not_attending と attending と waitlist が同時に表示される", () => {
    render(
      <AttendeeList
        attendees={[
          make({ id: "1", status: "attending" }),
          make({ id: "2", status: "not_attending", user: { ...make().user, id: "u2", nickname: "X" } }),
          make({ id: "3", status: "waitlist", position: 1, user: { ...make().user, id: "u3", nickname: "Y" } }),
        ]}
      />,
    );
    expect(screen.getByText("参加 (1)")).toBeInTheDocument();
    expect(screen.getByText("キャンセル待ち (1)")).toBeInTheDocument();
    expect(screen.getByText("不参加 (1)")).toBeInTheDocument();
  });

  it("コメント有りなら表示", () => {
    render(
      <AttendeeList attendees={[make({ comment: "遅刻します" })]} />,
    );
    expect(screen.getByText("遅刻します")).toBeInTheDocument();
  });

  it("性別ごとに背景色が変わる（male）", () => {
    const { container } = render(
      <AttendeeList
        attendees={[make({ user: { ...make().user, gender: "male" } })]}
      />,
    );
    expect(container.innerHTML).toContain("bg-blue-50");
  });

  it("性別ごとに背景色が変わる（female）", () => {
    const { container } = render(
      <AttendeeList
        attendees={[make({ user: { ...make().user, gender: "female" } })]}
      />,
    );
    expect(container.innerHTML).toContain("bg-pink-50");
  });

  it("性別不明なら gray", () => {
    const { container } = render(<AttendeeList attendees={[make()]} />);
    expect(container.innerHTML).toContain("bg-gray-50");
  });

  it("プロフィール画像がない時は頭文字を表示", () => {
    render(<AttendeeList attendees={[make()]} />);
    expect(screen.getByText("ツ")).toBeInTheDocument();
  });
});
