import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const routerBackMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: routerBackMock }),
}));

import { EventForm } from "./EventForm";

beforeEach(() => {
  routerBackMock.mockReset();
});

describe("EventForm", () => {
  it("必須フィールド（title, eventDate）が表示される", () => {
    render(<EventForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/タイトル/)).toBeInTheDocument();
    expect(screen.getByLabelText(/開催日時/)).toBeInTheDocument();
  });

  it("初期値が反映される", () => {
    render(
      <EventForm
        initialData={{
          title: "練習会",
          location: "体育館",
          description: "毎週恒例",
        }}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("練習会")).toBeInTheDocument();
    expect(screen.getByDisplayValue("体育館")).toBeInTheDocument();
    expect(screen.getByDisplayValue("毎週恒例")).toBeInTheDocument();
  });

  it("submitLabel が反映される", () => {
    render(<EventForm onSubmit={vi.fn()} submitLabel="更新" />);
    expect(screen.getByRole("button", { name: "更新" })).toBeInTheDocument();
  });

  it("デフォルトの submitLabel は 作成", () => {
    render(<EventForm onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "作成" })).toBeInTheDocument();
  });

  it("キャンセルボタンで router.back が呼ばれる", async () => {
    render(<EventForm onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(routerBackMock).toHaveBeenCalled();
  });

  it("参加費表示チェックボックスON で参加費入力欄が現れる", async () => {
    render(<EventForm onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText(/参加費（円）/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("参加費を表示する"));

    expect(screen.getByLabelText(/参加費（円）/)).toBeInTheDocument();
  });

  it("締め切り設定ONで締め切り日時欄が現れる", async () => {
    render(<EventForm onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText("締め切り日時")).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("締め切りを設定する"));

    expect(screen.getByLabelText("締め切り日時")).toBeInTheDocument();
  });

  it("showNotifyOption=true で通知チェックボックスが表示される", () => {
    render(<EventForm onSubmit={vi.fn()} showNotifyOption />);
    expect(screen.getByLabelText("作成時にメンバーへLINE通知を送る")).toBeInTheDocument();
  });

  it("showNotifyOption=false（デフォルト）では通知チェックボックスが表示されない", () => {
    render(<EventForm onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText("作成時にメンバーへLINE通知を送る")).not.toBeInTheDocument();
  });

  it("終了時刻 ≤ 開始時刻 で バリデーションエラー", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<EventForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/タイトル/), "練習");
    await userEvent.type(
      screen.getByLabelText(/開催日時/),
      "2026-06-01T10:00",
    );
    await userEvent.type(
      screen.getByLabelText("終了時刻（任意）"),
      "2026-06-01T09:00",
    );

    await userEvent.click(screen.getByRole("button", { name: "作成" }));

    expect(screen.getByText("終了時刻は開始時刻より後に設定してください")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("正常な入力で onSubmit が呼ばれる", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<EventForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/タイトル/), "練習");
    await userEvent.type(
      screen.getByLabelText(/開催日時/),
      "2026-06-01T10:00",
    );

    await userEvent.click(screen.getByRole("button", { name: "作成" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "練習",
        eventDate: "2026-06-01T10:00",
      }),
    );
  });

  it("onSubmit がthrowしたらエラー表示", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("APIエラー発生"));
    render(<EventForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/タイトル/), "練習");
    await userEvent.type(
      screen.getByLabelText(/開催日時/),
      "2026-06-01T10:00",
    );

    await userEvent.click(screen.getByRole("button", { name: "作成" }));

    expect(await screen.findByText("APIエラー発生")).toBeInTheDocument();
  });

  it("onSubmit がError以外をthrowしたら汎用メッセージ", async () => {
    const onSubmit = vi.fn().mockRejectedValue("string error");
    render(<EventForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/タイトル/), "練習");
    await userEvent.type(
      screen.getByLabelText(/開催日時/),
      "2026-06-01T10:00",
    );

    await userEvent.click(screen.getByRole("button", { name: "作成" }));

    expect(await screen.findByText("エラーが発生しました")).toBeInTheDocument();
  });

  it("通知チェックボックスはデフォルトでON", () => {
    render(<EventForm onSubmit={vi.fn()} showNotifyOption />);
    expect(screen.getByLabelText("作成時にメンバーへLINE通知を送る")).toBeChecked();
  });
});
