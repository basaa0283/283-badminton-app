import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("子要素を表示する", () => {
    render(<Button>送信</Button>);
    expect(screen.getByRole("button", { name: "送信" })).toBeInTheDocument();
  });

  it("クリックでハンドラが呼ばれる", async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>click me</Button>);

    await userEvent.click(screen.getByRole("button"));

    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("disabled の場合クリックされない", async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick} disabled>disabled</Button>);

    await userEvent.click(screen.getByRole("button"));

    expect(handleClick).not.toHaveBeenCalled();
  });

  it("loading=true なら disabled になる", () => {
    render(<Button loading>loading</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("loading=true でスピナー(SVG)が表示される", () => {
    const { container } = render(<Button loading>loading</Button>);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it.each([
    ["primary", "bg-blue-600"],
    ["secondary", "bg-gray-100"],
    ["danger", "bg-red-600"],
    ["ghost", "text-gray-600"],
  ] as const)("variant=%s で %s クラスが適用される", (variant, expectedClass) => {
    render(<Button variant={variant}>v</Button>);
    expect(screen.getByRole("button").className).toContain(expectedClass);
  });

  it.each([
    ["sm", "px-3"],
    ["md", "px-4"],
    ["lg", "px-6"],
  ] as const)("size=%s で %s クラスが適用される", (size, expectedClass) => {
    render(<Button size={size}>s</Button>);
    expect(screen.getByRole("button").className).toContain(expectedClass);
  });

  it("type='submit' を渡せる", () => {
    render(<Button type="submit">送信</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
});
