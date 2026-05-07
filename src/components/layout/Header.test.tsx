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

  it("メンバーには管理リンクは出さない", () => {
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
    expect(screen.getByText("イベント")).toBeInTheDocument();
    expect(screen.getByText("プロフィール")).toBeInTheDocument();
    expect(screen.queryByText("管理")).not.toBeInTheDocument();
  });

  it.each(["admin", "subadmin"])("%s は管理リンクが表示される", (role) => {
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
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://example.com/avatar.png");
  });

  it("ログアウトボタンクリックで signOut が呼ばれる", async () => {
    useSessionMock.mockReturnValue({
      data: {
        user: { nickname: "X", role: "member", image: null },
      },
    });
    render(<Header />);
    await userEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });
});
