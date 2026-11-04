import { createLongplayServer } from "@tinkerlandai/longplay-sdk/server";

export class AnnouncementAccessError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

export async function requireAnnouncementAccess(
  tenant: { id: string; plan: string; status: string } | null,
  env: Record<string, string | undefined> = process.env,
  createClient = createLongplayServer,
): Promise<void> {
  if (!env.LONGPLAY_ANNOUNCEMENTS_FEATURE_ID) return;
  if (!tenant || tenant.status !== "active") throw new AnnouncementAccessError(403, "TENANT_INACTIVE");
  // The operator's explicitly complimentary pilot does not need a purchase.
  if (tenant.plan === "complimentary") return;
  let allowed: boolean;
  try {
    if (!env.LONGPLAY_BASE_URL || !env.LONGPLAY_APP_ID || !env.LONGPLAY_SECRET_KEY ||
      !["sandbox", "live"].includes(env.LONGPLAY_ENVIRONMENT ?? "")) throw new Error("Configuration");
    const client = createClient({ baseUrl: env.LONGPLAY_BASE_URL, apiKey: env.LONGPLAY_SECRET_KEY,
      scope: { projectId: env.LONGPLAY_APP_ID, environment: env.LONGPLAY_ENVIRONMENT as "sandbox" | "live" }, timeoutMs: 3000 });
    const { customer } = await client.getOrCreateCustomer({ externalUserId: `283bad:tenant:${tenant.id}` });
    const { check } = await client.checkEntitlement({ customerId: customer.id, requirement: {
      internal_feature_id: env.LONGPLAY_ANNOUNCEMENTS_FEATURE_ID, quantity: "1", properties: {},
    } });
    if (check.kind !== "access") throw new Error("Expected access Feature");
    allowed = check.allowed;
  } catch {
    throw new AnnouncementAccessError(503, "BILLING_UNAVAILABLE");
  }
  if (!allowed) throw new AnnouncementAccessError(402, "PLAN_REQUIRED");
}
