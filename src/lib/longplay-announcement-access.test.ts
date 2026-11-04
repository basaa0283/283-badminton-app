import { describe, expect, it } from "vitest";
import { requireAnnouncementAccess } from "./longplay-announcement-access";

const tenant = { id: "trusted-tenant", plan: "paid", status: "active" };
const env = { LONGPLAY_ANNOUNCEMENTS_FEATURE_ID: "11111111-1111-4111-8111-111111111111", LONGPLAY_APP_ID: "app",
  LONGPLAY_BASE_URL: "https://billing.invalid", LONGPLAY_SECRET_KEY: "server-key", LONGPLAY_ENVIRONMENT: "sandbox" };

describe("announcement admission", () => {
  it("keeps disabled deployments and active complimentary pilots independent of billing", async () => {
    const noClient = () => { throw new Error("must not initialize"); };
    await expect(requireAnnouncementAccess(tenant, {}, noClient)).resolves.toBeUndefined();
    await expect(requireAnnouncementAccess({ ...tenant, plan: "complimentary" }, env, noClient)).resolves.toBeUndefined();
    await expect(requireAnnouncementAccess({ ...tenant, plan: "complimentary", status: "frozen" }, env, noClient)).rejects.toMatchObject({ status: 403 });
  });
  it("checks the stored tenant and observes revocation despite a stale paid flag", async () => {
    let allowed = true;
    const fake = (() => ({ getOrCreateCustomer: async (input: unknown) => {
      expect(input).toEqual({ externalUserId: "283bad:tenant:trusted-tenant" }); return { customer: { id: "customer" } };
    }, checkEntitlement: async () => ({ check: { kind: "access", allowed } }) })) as unknown as Parameters<typeof requireAnnouncementAccess>[2];
    await requireAnnouncementAccess(tenant, env, fake);
    allowed = false;
    await expect(requireAnnouncementAccess(tenant, env, fake)).rejects.toMatchObject({ status: 402 });
  });
  it("configuration and service failures cannot grant access or expose diagnostics", async () => {
    await expect(requireAnnouncementAccess(tenant, { LONGPLAY_ANNOUNCEMENTS_FEATURE_ID: "set" })).rejects.toMatchObject({ status: 503 });
    await expect(requireAnnouncementAccess(tenant, env, () => { throw new Error("private"); })).rejects.toMatchObject({ message: "BILLING_UNAVAILABLE" });
  });
  it("refuses credit/metered checks as a substitute for an access grant", async () => {
    const fake = (() => ({ getOrCreateCustomer: async () => ({ customer: { id: "customer" } }),
      checkEntitlement: async () => ({ check: { kind: "credit", allowed: true } }) })) as unknown as Parameters<typeof requireAnnouncementAccess>[2];
    await expect(requireAnnouncementAccess(tenant, env, fake)).rejects.toMatchObject({ status: 503 });
  });
});
