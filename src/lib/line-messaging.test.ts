import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./prisma", () => ({
  prisma: {
    systemSetting: {
      findUnique: vi.fn(),
    },
  },
}));

process.env.LINE_MESSAGING_API_CHANNEL_ACCESS_TOKEN = "test-token";

const { prisma } = await import("./prisma");
const {
  notifyWaitlistPromotion,
  notifyNewEvent,
  notifyEventReminder,
} = await import("./line-messaging");

const mockedFindUnique = prisma.systemSetting.findUnique as ReturnType<typeof vi.fn>;

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue(
    new Response("", { status: 200 }),
  );
});

const sampleEventDate = new Date("2026-06-01T10:00:00Z");

describe("notifyWaitlistPromotion", () => {
  it("setting が disabled なら fetch しない", async () => {
    mockedFindUnique.mockResolvedValueOnce({
      key: "notifyWaitlistEnabled",
      value: "false",
    });

    await notifyWaitlistPromotion({
      lineId: "U123",
      eventTitle: "練習会",
      eventDate: sampleEventDate,
      location: "体育館",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("setting が未設定（=デフォルト有効）なら push する", async () => {
    mockedFindUnique.mockResolvedValueOnce(null);

    await notifyWaitlistPromotion({
      lineId: "U123",
      eventTitle: "練習会",
      eventDate: sampleEventDate,
      location: "体育館",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/push");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body);
    expect(body.to).toBe("U123");
    expect(body.messages[0].text).toContain("キャンセル待ちが繰り上がりました");
    expect(body.messages[0].text).toContain("練習会");
    expect(body.messages[0].text).toContain("体育館");
  });

  it("location が null の場合は場所行を含めない", async () => {
    mockedFindUnique.mockResolvedValueOnce({
      key: "notifyWaitlistEnabled",
      value: "true",
    });

    await notifyWaitlistPromotion({
      lineId: "U123",
      eventTitle: "練習会",
      eventDate: sampleEventDate,
      location: null,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].text).not.toContain("📍");
  });
});

describe("notifyNewEvent", () => {
  it("lineIds が空の場合は fetch しない", async () => {
    await notifyNewEvent({
      lineIds: [],
      eventTitle: "新イベント",
      eventDate: sampleEventDate,
      location: null,
      appUrl: "https://example.com",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("単一 chunk（≤500件）の場合は1回 multicast する", async () => {
    const lineIds = ["U1", "U2", "U3"];

    await notifyNewEvent({
      lineIds,
      eventTitle: "新イベント",
      eventDate: sampleEventDate,
      location: "体育館",
      appUrl: "https://example.com",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/multicast");
    const body = JSON.parse(options.body);
    expect(body.to).toEqual(lineIds);
    expect(body.messages[0].text).toContain("新しいイベントが追加されました");
    expect(body.messages[0].text).toContain("https://example.com/events");
  });

  it("501件以上は500件ずつ分割して multicast する", async () => {
    const lineIds = Array.from({ length: 1200 }, (_, i) => `U${i}`);

    await notifyNewEvent({
      lineIds,
      eventTitle: "新イベント",
      eventDate: sampleEventDate,
      location: null,
      appUrl: "https://example.com",
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const chunks = fetchMock.mock.calls.map(
      ([, opts]) => JSON.parse(opts.body).to.length,
    );
    expect(chunks).toEqual([500, 500, 200]);
  });

  it("setting チェックがないので無条件で送信", async () => {
    // notifyNewEvent はイベントごとに送信ON/OFFを判定するため、systemSetting は見ない
    await notifyNewEvent({
      lineIds: ["U1"],
      eventTitle: "新イベント",
      eventDate: sampleEventDate,
      location: null,
      appUrl: "https://example.com",
    });

    expect(mockedFindUnique).not.toHaveBeenCalled();
  });
});

describe("notifyEventReminder", () => {
  it("setting が disabled なら fetch しない", async () => {
    mockedFindUnique.mockResolvedValueOnce({
      key: "notifyReminderEnabled",
      value: "false",
    });

    await notifyEventReminder({
      lineId: "U123",
      eventTitle: "練習会",
      eventDate: sampleEventDate,
      location: null,
      hoursUntil: 24,
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hoursUntil <= 3 なら 'まもなく' ラベル", async () => {
    mockedFindUnique.mockResolvedValueOnce(null);

    await notifyEventReminder({
      lineId: "U123",
      eventTitle: "練習会",
      eventDate: sampleEventDate,
      location: "体育館",
      hoursUntil: 2,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].text).toContain("まもなく");
  });

  it("hoursUntil > 3 なら '明日' ラベル", async () => {
    mockedFindUnique.mockResolvedValueOnce(null);

    await notifyEventReminder({
      lineId: "U123",
      eventTitle: "練習会",
      eventDate: sampleEventDate,
      location: "体育館",
      hoursUntil: 24,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].text).toContain("明日");
    expect(body.messages[0].text).not.toContain("まもなく");
  });

  it("hoursUntil = 3 はぎりぎり 'まもなく'（境界値）", async () => {
    mockedFindUnique.mockResolvedValueOnce(null);

    await notifyEventReminder({
      lineId: "U123",
      eventTitle: "練習会",
      eventDate: sampleEventDate,
      location: null,
      hoursUntil: 3,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].text).toContain("まもなく");
  });
});

describe("LINE API レスポンス処理", () => {
  it("APIが失敗してもエラーを投げない（ログのみ）", async () => {
    mockedFindUnique.mockResolvedValueOnce(null);
    fetchMock.mockResolvedValueOnce(
      new Response("Bad Request", { status: 400 }),
    );

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      notifyWaitlistPromotion({
        lineId: "U123",
        eventTitle: "練習会",
        eventDate: sampleEventDate,
        location: null,
      }),
    ).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("Authorization ヘッダーが付与される", async () => {
    mockedFindUnique.mockResolvedValueOnce(null);

    await notifyWaitlistPromotion({
      lineId: "U123",
      eventTitle: "練習会",
      eventDate: sampleEventDate,
      location: null,
    });

    const options = fetchMock.mock.calls[0][1];
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(options.headers["Content-Type"]).toBe("application/json");
  });
});
