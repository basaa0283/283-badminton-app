import { describe, it, expect, vi, beforeEach } from "vitest";

const { findFirst, findUnique } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("./prisma", () => ({
  prisma: {
    user: { findFirst, findUnique },
  },
}));

import { createAuthAdapter } from "./auth";

describe("createAuthAdapter", () => {
  beforeEach(() => {
    findFirst.mockReset();
    findUnique.mockReset();
  });

  // User.email は schema 上 @unique を持たないため、findUnique({ where: { email } }) は
  // Prisma のバリデーションで失敗する (新規ユーザーが LINE ログインできなくなった不具合)。
  it("getUserByEmail は findUnique ではなく findFirst で検索する", async () => {
    findFirst.mockResolvedValue({ id: "u1", email: "x@line.local" });
    const adapter = createAuthAdapter();

    const user = await adapter!.getUserByEmail!("x@line.local");

    expect(findFirst).toHaveBeenCalledWith({ where: { email: "x@line.local" } });
    expect(findUnique).not.toHaveBeenCalled();
    expect(user).toEqual({ id: "u1", email: "x@line.local" });
  });

  it("該当ユーザーがいなければ null を返す", async () => {
    findFirst.mockResolvedValue(null);
    const adapter = createAuthAdapter();

    expect(await adapter!.getUserByEmail!("none@line.local")).toBeNull();
  });
});
