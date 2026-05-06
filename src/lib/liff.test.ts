import { describe, it, expect, vi, beforeEach } from "vitest";

const liffMock = {
  init: vi.fn(),
  isInClient: vi.fn(),
  isLoggedIn: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  getProfile: vi.fn(),
  getAccessToken: vi.fn(),
};

vi.mock("@line/liff", () => ({
  default: liffMock,
}));

const {
  initializeLiff,
  isInLiff,
  isLoggedIn,
  login,
  logout,
  getProfile,
  getAccessToken,
} = await import("./liff");

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.NEXT_PUBLIC_LIFF_ID;
});

describe("initializeLiff", () => {
  it("LIFF_ID 未設定なら警告ログのみで処理続行", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await initializeLiff();

    expect(liffMock.init).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith("LIFF ID is not defined");
    consoleErrorSpy.mockRestore();
  });

  it("LIFF_ID があれば liff.init を呼ぶ", async () => {
    process.env.NEXT_PUBLIC_LIFF_ID = "test-liff-id";
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    liffMock.init.mockResolvedValueOnce(undefined);

    await initializeLiff();

    expect(liffMock.init).toHaveBeenCalledWith({ liffId: "test-liff-id" });
    consoleLogSpy.mockRestore();
  });

  it("init失敗時はエラーをthrowする", async () => {
    process.env.NEXT_PUBLIC_LIFF_ID = "test-liff-id";
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    liffMock.init.mockRejectedValueOnce(new Error("init failed"));

    await expect(initializeLiff()).rejects.toThrow("init failed");
    consoleErrorSpy.mockRestore();
  });
});

describe("isInLiff", () => {
  it("liff.isInClient の結果を返す", () => {
    liffMock.isInClient.mockReturnValueOnce(true);
    expect(isInLiff()).toBe(true);

    liffMock.isInClient.mockReturnValueOnce(false);
    expect(isInLiff()).toBe(false);
  });
});

describe("isLoggedIn", () => {
  it("liff.isLoggedIn の結果を返す", () => {
    liffMock.isLoggedIn.mockReturnValueOnce(true);
    expect(isLoggedIn()).toBe(true);

    liffMock.isLoggedIn.mockReturnValueOnce(false);
    expect(isLoggedIn()).toBe(false);
  });
});

describe("login", () => {
  it("未ログインなら liff.login を呼ぶ", () => {
    liffMock.isLoggedIn.mockReturnValueOnce(false);

    login();

    expect(liffMock.login).toHaveBeenCalled();
  });

  it("既にログイン済みなら liff.login を呼ばない", () => {
    liffMock.isLoggedIn.mockReturnValueOnce(true);

    login();

    expect(liffMock.login).not.toHaveBeenCalled();
  });
});

describe("logout", () => {
  it("ログイン中なら logout してリロードする", () => {
    liffMock.isLoggedIn.mockReturnValueOnce(true);
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: reloadSpy },
      writable: true,
    });

    logout();

    expect(liffMock.logout).toHaveBeenCalled();
    expect(reloadSpy).toHaveBeenCalled();
  });

  it("未ログインなら logout を呼ばない", () => {
    liffMock.isLoggedIn.mockReturnValueOnce(false);

    logout();

    expect(liffMock.logout).not.toHaveBeenCalled();
  });
});

describe("getProfile", () => {
  it("未ログインなら null を返す", async () => {
    liffMock.isLoggedIn.mockReturnValueOnce(false);

    const result = await getProfile();

    expect(result).toBeNull();
    expect(liffMock.getProfile).not.toHaveBeenCalled();
  });

  it("ログイン中なら liff.getProfile の結果を返す", async () => {
    liffMock.isLoggedIn.mockReturnValueOnce(true);
    const profile = { userId: "U123", displayName: "テスト" };
    liffMock.getProfile.mockResolvedValueOnce(profile);

    const result = await getProfile();

    expect(result).toEqual(profile);
  });
});

describe("getAccessToken", () => {
  it("liff.getAccessToken の結果を返す", () => {
    liffMock.getAccessToken.mockReturnValueOnce("access-token-xxx");
    expect(getAccessToken()).toBe("access-token-xxx");
  });

  it("null も返せる", () => {
    liffMock.getAccessToken.mockReturnValueOnce(null);
    expect(getAccessToken()).toBeNull();
  });
});
