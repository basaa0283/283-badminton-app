import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Card, CardHeader, CardContent, CardFooter } from "./Card";

describe("Card", () => {
  it("子要素を表示する", () => {
    render(<Card>カード内容</Card>);
    expect(screen.getByText("カード内容")).toBeInTheDocument();
  });

  it("hover=true でホバー用クラスが付く", () => {
    render(<Card hover>hover card</Card>);
    expect(screen.getByText("hover card").className).toContain("cursor-pointer");
  });

  it("hover=false ではホバー用クラスが付かない", () => {
    render(<Card>plain card</Card>);
    expect(screen.getByText("plain card").className).not.toContain("cursor-pointer");
  });

  it("onClick が動作する", async () => {
    const handleClick = vi.fn();
    render(<Card onClick={handleClick}>clickable</Card>);

    await userEvent.click(screen.getByText("clickable"));

    expect(handleClick).toHaveBeenCalledOnce();
  });
});

describe("CardHeader / CardContent / CardFooter", () => {
  it("CardHeader が children を表示", () => {
    render(<CardHeader>ヘッダ</CardHeader>);
    expect(screen.getByText("ヘッダ")).toBeInTheDocument();
  });

  it("CardContent が children を表示", () => {
    render(<CardContent>本文</CardContent>);
    expect(screen.getByText("本文")).toBeInTheDocument();
  });

  it("CardFooter が children を表示", () => {
    render(<CardFooter>フッタ</CardFooter>);
    expect(screen.getByText("フッタ")).toBeInTheDocument();
  });
});
