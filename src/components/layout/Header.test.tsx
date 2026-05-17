import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const useSessionMock = vi.fn();
const signOutMock = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => useSessionMock(),
  signOut: (opts: unknown) => signOutMock(opts),
}));

import { Header } from "./Header";

beforeEach(() => {
  useSessionMock.mockReset();
  signOutMock.mockReset();
});

describe("Header", () => {
  it("セッションがない場合は何も表示しない", () => {
    useSessionMock.mockReturnValue({ data: null });
    const { container } = render(<Header />);
    expect(container.firstChild).toBeNull();
  });

  it("メンバーには管理/メンバーリンクは出さない", () => {
    useSessionMock.mockReturnValue({
      data: {
        user: {
          nickname: "ツバサ",
          role: "member",
          image: null,
        },
      },
    });
    render(<Header />);
    expect(screen.getByText("ツバサ")).toBeInTheDocument();
    expect(screen.getByText("一般")).toBeInTheDocument();
    expect(screen.getByText("イベント一覧")).toBeInTheDocument();
    expect(screen.getByText("プロフィール")).toBeInTheDocument();
    expect(screen.queryByText("管理")).not.toBeInTheDocument();
    expect(screen.queryByText("メンバー")).not.toBeInTheDocument();
  });

  it.each(["admin", "subadmin"])("%s は管理/メンバーリンクが表示される", (role) => {
    useSessionMock.mockReturnValue({
      data: {
        user: {
          nickname: "管理者",
          role,
          image: null,
        },
      },
    });
    render(<Header />);
    expect(screen.getByText("管理")).toBeInTheDocument();
    expect(screen.getByText("メンバー")).toBeInTheDocument();
  });

  it("画像があれば表示する", () => {
    useSessionMock.mockReturnValue({
      data: {
        user: {
          nickname: "ツバサ",
          role: "member",
          image: "https://example.com/avatar.png",
        },
      },
    });
    const { container } = render(<Header />);
    const avatar = container.querySelector('img[src="https://example.com/avatar.png"]');
    expect(avatar).not.toBeNull();
  });

  it("アバターメニューを開いてログアウトボタンクリックで signOut が呼ばれる", async () => {
    useSessionMock.mockReturnValue({
      data: {
        user: { nickname: "X", role: "member", image: null },
      },
    });
    render(<Header />);
    // 初期状態ではログアウトは表示されない
    expect(screen.queryByRole("menuitem", { name: "ログアウト" })).not.toBeInTheDocument();
    // アバターボタンを開く (aria-haspopup="menu")
    await userEvent.click(screen.getByRole("button", { expanded: false }));
    // メニュー内のログアウトをクリック
    await userEvent.click(screen.getByRole("menuitem", { name: "ログアウト" }));
    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });
});
