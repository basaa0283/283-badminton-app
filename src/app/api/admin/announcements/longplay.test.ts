import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: { tenant: { findUnique: vi.fn() }, announcement: { create: vi.fn() } } }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenantId: vi.fn(), tenantWhere: vi.fn() }));
vi.mock("@/lib/activity-log", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/notify-email-dispatch", () => ({ dispatchNotificationEmails: vi.fn() }));
vi.mock("@/lib/longplay-announcement-access", async (original) => ({
  ...(await original<typeof import("@/lib/longplay-announcement-access")>()), requireAnnouncementAccess: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { dispatchNotificationEmails } from "@/lib/notify-email-dispatch";
import { AnnouncementAccessError, requireAnnouncementAccess } from "@/lib/longplay-announcement-access";
import { POST } from "./route";

const request = () => new NextRequest("http://localhost/api/admin/announcements", { method: "POST", body: JSON.stringify({ title: "Test", body: "Content", tenantId: "browser-selected" }) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "verified-user", role: "admin" } } as never);
  vi.mocked(getCurrentTenantId).mockResolvedValue("resolved-tenant");
  vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ id: "resolved-tenant", plan: "paid", status: "active" } as never);
});
it("refuses before storage or email and checks the server-resolved tenant", async () => {
  vi.mocked(requireAnnouncementAccess).mockRejectedValue(new AnnouncementAccessError(402, "PLAN_REQUIRED"));
  const response = await POST(request());
  expect(response.status).toBe(402);
  expect(requireAnnouncementAccess).toHaveBeenCalledWith({ id: "resolved-tenant", plan: "paid", status: "active" });
  expect(prisma.announcement.create).not.toHaveBeenCalled();
  expect(dispatchNotificationEmails).not.toHaveBeenCalled();
});
it("does not query billing before existing authentication and authorization", async () => {
  vi.mocked(getServerSession).mockResolvedValue(null);
  expect((await POST(request())).status).toBe(401);
  expect(requireAnnouncementAccess).not.toHaveBeenCalled();
});
it("uses the same resolved tenant for the admitted write", async () => {
  vi.mocked(prisma.announcement.create).mockResolvedValue({ id: "new", title: "Test", severity: "info", eventId: null, publishedAt: new Date("2099-01-01") } as never);
  expect((await POST(request())).status).toBe(201);
  expect(prisma.announcement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: "resolved-tenant", createdById: "verified-user" }) }));
});
