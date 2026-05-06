import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttendanceForm } from "./AttendanceForm";

describe("AttendanceForm", () => {
  it("締切超過時はメッセージを表示し、フォームを表示しない", () => {
    render(
      <AttendanceForm
        eventId="evt-1"
        isDeadlinePassed={true}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText("締め切りを過ぎたため、出欠の変更はできません")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "参加" })).not.toBeInTheDocument();
  });

  it("締切超過＋既存回答ありなら回答を表示", () => {
    render(
      <AttendanceForm
        eventId="evt-1"
        isDeadlinePassed={true}
        currentAttendance={{ status: "attending", comment: null, position: null }}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText("あなたの回答:")).toBeInTheDocument();
    expect(screen.getByText("参加")).toBeInTheDocument();
  });

  it("初期状態は参加が選択", () => {
    render(
      <AttendanceForm
        eventId="evt-1"
        isDeadlinePassed={false}
        onSubmit={vi.fn()}
      />,
    );
    const attendingBtn = screen.getByRole("button", { name: "参加" });
    expect(attendingBtn.className).toContain("border-green-500");
  });

  it("既存回答が not_attending なら not_attending が選択された状態", () => {
    render(
      <AttendanceForm
        eventId="evt-1"
        isDeadlinePassed={false}
        currentAttendance={{ status: "not_attending", comment: null, position: null }}
        onSubmit={vi.fn()}
      />,
    );
    const notAttendingBtn = screen.getByRole("button", { name: "不参加" });
    expect(notAttendingBtn.className).toContain("border-red-500");
  });

  it("不参加ボタンクリックで切替", async () => {
    render(
      <AttendanceForm
        eventId="evt-1"
        isDeadlinePassed={false}
        onSubmit={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "不参加" }));
    expect(screen.getByRole("button", { name: "不参加" }).className).toContain("border-red-500");
  });

  it("submit で onSubmit が呼ばれる", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <AttendanceForm
        eventId="evt-1"
        isDeadlinePassed={false}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "回答を送信する" }));

    expect(onSubmit).toHaveBeenCalledWith("attending", "");
  });

  it("コメント入力後に submit するとコメントも渡される", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <AttendanceForm
        eventId="evt-1"
        isDeadlinePassed={false}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.type(screen.getByPlaceholderText("遅れます、途中退出など"), "5分遅刻");
    await userEvent.click(screen.getByRole("button", { name: "回答を送信する" }));

    expect(onSubmit).toHaveBeenCalledWith("attending", "5分遅刻");
  });

  it("文字数カウンタが表示される", async () => {
    render(
      <AttendanceForm
        eventId="evt-1"
        isDeadlinePassed={false}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText("0/200")).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("遅れます、途中退出など"), "abc");
    expect(screen.getByText("3/200")).toBeInTheDocument();
  });

  it("既存回答ありのときは「回答を更新する」ボタン", () => {
    render(
      <AttendanceForm
        eventId="evt-1"
        isDeadlinePassed={false}
        currentAttendance={{ status: "attending", comment: null, position: null }}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "回答を更新する" })).toBeInTheDocument();
  });

  it("waitlist の position が表示される", () => {
    render(
      <AttendanceForm
        eventId="evt-1"
        isDeadlinePassed={false}
        currentAttendance={{ status: "waitlist", comment: null, position: 3 }}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText(/3番目/)).toBeInTheDocument();
  });
});
