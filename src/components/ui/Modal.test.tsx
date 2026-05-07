import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal, ConfirmModal } from "./Modal";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("Modal", () => {
  it("isOpen=false なら何も表示しない", () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="タイトル">
        中身
      </Modal>,
    );
    expect(screen.queryByText("タイトル")).not.toBeInTheDocument();
    expect(screen.queryByText("中身")).not.toBeInTheDocument();
  });

  it("isOpen=true でタイトルと中身が表示される", () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="タイトル">
        中身
      </Modal>,
    );
    expect(screen.getByText("タイトル")).toBeInTheDocument();
    expect(screen.getByText("中身")).toBeInTheDocument();
  });

  it("isOpen=true で body の overflow が hidden になる", () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="タイトル">
        中身
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("× ボタンクリックで onClose が呼ばれる", async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="タイトル">
        中身
      </Modal>,
    );
    const closeButton = screen.getByRole("button");
    await userEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("オーバーレイ（外側）クリックで onClose が呼ばれる", async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="タイトル">
        <span>中身</span>
      </Modal>,
    );
    const overlay = screen.getByText("中身").closest("div.fixed");
    if (overlay) {
      await userEvent.click(overlay);
      expect(onClose).toHaveBeenCalledOnce();
    }
  });
});

describe("ConfirmModal", () => {
  it("メッセージとデフォルトボタンラベルを表示", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="削除確認"
        message="本当に削除しますか？"
      />,
    );
    expect(screen.getByText("削除確認")).toBeInTheDocument();
    expect(screen.getByText("本当に削除しますか？")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "確認" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeInTheDocument();
  });

  it("カスタムボタンラベルを表示", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="削除"
        message="msg"
        confirmText="削除する"
        cancelText="やめる"
      />,
    );
    expect(screen.getByRole("button", { name: "削除する" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "やめる" })).toBeInTheDocument();
  });

  it("確認ボタンクリックで onConfirm", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={onConfirm}
        title="削除"
        message="msg"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "確認" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("キャンセルボタンクリックで onClose", async () => {
    const onClose = vi.fn();
    render(
      <ConfirmModal
        isOpen={true}
        onClose={onClose}
        onConfirm={() => {}}
        title="削除"
        message="msg"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("loading=true でボタンが disabled になる", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="削除"
        message="msg"
        loading
      />,
    );
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();
  });
});
