import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberCard } from "./MemberCard";

const FIXED_NOW = new Date("2026-05-06T12:00:00.000Z");

const baseMember = {
  id: "u1",
  nickname: "ツバサ",
  profileImageUrl: null,
  role: "member",
  gender: null,
  age: null,
  comment: null,
  lastActiveAt: null,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("MemberCard", () => {
  it("nickname が表示される", () => {
    render(<MemberCard member={baseMember} />);
    expect(screen.getByText("ツバサ")).toBeInTheDocument();
  });

  it("RoleBadge が表示される（member → 一般）", () => {
    render(<MemberCard member={baseMember} />);
    expect(screen.getByText("一般")).toBeInTheDocument();
  });

  it("プロフィール画像がない時は頭文字を表示", () => {
    render(<MemberCard member={baseMember} />);
    // 「ツ」が画像placeholderとして表示されるか
    expect(screen.getByText("ツ")).toBeInTheDocument();
  });

  it("プロフィール画像があれば img が表示される", () => {
    const { container } = render(
      <MemberCard
        member={{ ...baseMember, profileImageUrl: "https://example.com/x.png" }}
      />,
    );
    // alt="" の画像は role="img" にならないため querySelector で取得
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://example.com/x.png");
  });

  it("onClick が動作する", async () => {
    vi.useRealTimers(); // userEvent.click は fake timers と相性悪いので解除
    const onClick = vi.fn();
    render(<MemberCard member={baseMember} onClick={onClick} />);
    await userEvent.click(screen.getByText("ツバサ"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  describe("最終操作日時の相対表示", () => {
    it.each([
      [new Date(FIXED_NOW.getTime() - 30 * 1000).toISOString(), "たった今"],
      [new Date(FIXED_NOW.getTime() - 30 * 60 * 1000).toISOString(), "30分前"],
      [new Date(FIXED_NOW.getTime() - 5 * 60 * 60 * 1000).toISOString(), "5時間前"],
      [new Date(FIXED_NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), "3日前"],
      [new Date(FIXED_NOW.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(), "2週間前"],
      [new Date(FIXED_NOW.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(), "2ヶ月前"],
    ])("%s → %s", (lastActiveAt, expected) => {
      render(<MemberCard member={{ ...baseMember, lastActiveAt }} />);
      expect(screen.getByText(`最終操作: ${expected}`)).toBeInTheDocument();
    });

    it("lastActiveAt が null なら 未操作", () => {
      render(<MemberCard member={baseMember} />);
      expect(screen.getByText("最終操作: 未操作")).toBeInTheDocument();
    });
  });
});
