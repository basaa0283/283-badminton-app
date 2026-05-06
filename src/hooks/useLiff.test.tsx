import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const liffMock = {
  init: vi.fn(),
  isInClient: vi.fn(),
  isLoggedIn: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  getProfile: vi.fn(),
};

vi.mock("@/lib/liff", () => ({
  initializeLiff: vi.fn(),
  isLoggedIn: () => liffMock.isLoggedIn(),
  getProfile: () => liffMock.getProfile(),
  liff: liffMock,
}));

const { useLiff } = await import("./useLiff");
const { initializeLiff } = await import("@/lib/liff");
const initializeLiffMock = initializeLiff as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useLiff", () => {
  it("初期化成功＆未ログインなら isInitialized=true, isLiffLoggedIn=false", async () => {
    initializeLiffMock.mockResolvedValueOnce(undefined);
    liffMock.isLoggedIn.mockReturnValue(false);

    const { result } = renderHook(() => useLiff());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });
    expect(result.current.isLiffLoggedIn).toBe(false);
    expect(result.current.profile).toBeNull();
  });

  it("初期化成功＆ログイン済みなら profile を取得する", async () => {
    initializeLiffMock.mockResolvedValueOnce(undefined);
    liffMock.isLoggedIn.mockReturnValue(true);
    liffMock.getProfile.mockResolvedValueOnce({
      userId: "U123",
      displayName: "テスト",
    });

    const { result } = renderHook(() => useLiff());

    await waitFor(() => {
      expect(result.current.profile).toEqual({
        userId: "U123",
        displayName: "テスト",
      });
    });
    expect(result.current.isLiffLoggedIn).toBe(true);
  });

  it("初期化失敗時もエラーがセットされ、isInitialized=true になる", async () => {
    initializeLiffMock.mockRejectedValueOnce(new Error("init failed"));

    const { result } = renderHook(() => useLiff());

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });
    expect(result.current.isInitialized).toBe(true);
  });

  it("login() を呼ぶと未ログインなら liff.login が呼ばれる", async () => {
    initializeLiffMock.mockResolvedValueOnce(undefined);
    liffMock.isLoggedIn.mockReturnValue(false);

    const { result } = renderHook(() => useLiff());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    result.current.login();
    expect(liffMock.login).toHaveBeenCalled();
  });

  it("login() でログイン済みなら liff.login は呼ばれない", async () => {
    initializeLiffMock.mockResolvedValueOnce(undefined);
    liffMock.isLoggedIn.mockReturnValue(true);
    liffMock.getProfile.mockResolvedValueOnce({
      userId: "U1",
      displayName: "X",
    });

    const { result } = renderHook(() => useLiff());

    await waitFor(() => result.current.isInitialized);

    result.current.login();
    expect(liffMock.login).not.toHaveBeenCalled();
  });

  it("logout() でログイン中なら logout＋reload", async () => {
    initializeLiffMock.mockResolvedValueOnce(undefined);
    liffMock.isLoggedIn.mockReturnValue(true);
    liffMock.getProfile.mockResolvedValueOnce({ userId: "U1", displayName: "X" });

    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: reloadSpy },
      writable: true,
    });

    const { result } = renderHook(() => useLiff());

    await waitFor(() => result.current.isInitialized);

    result.current.logout();
    expect(liffMock.logout).toHaveBeenCalled();
    expect(reloadSpy).toHaveBeenCalled();
  });

  it("isInClient() は liff.isInClient の結果を返す", async () => {
    initializeLiffMock.mockResolvedValueOnce(undefined);
    liffMock.isLoggedIn.mockReturnValue(false);
    liffMock.isInClient.mockReturnValue(true);

    const { result } = renderHook(() => useLiff());

    await waitFor(() => result.current.isInitialized);

    expect(result.current.isInClient()).toBe(true);
  });

  it("liff オブジェクトのメソッドが使えない場合 isInClient は false を返す", async () => {
    initializeLiffMock.mockResolvedValueOnce(undefined);
    liffMock.isLoggedIn.mockReturnValue(false);
    liffMock.isInClient.mockImplementation(() => {
      throw new Error("not initialized");
    });

    const { result } = renderHook(() => useLiff());

    await waitFor(() => result.current.isInitialized);

    expect(result.current.isInClient()).toBe(false);
  });
});
