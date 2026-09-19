"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type TenantPlan = "free" | "paid" | "complimentary";
type TenantStatus = "active" | "frozen" | "pending";
type ApplicationStatus = "pending" | "approved" | "rejected";

interface Stats {
  totalTenants: number;
  activeTenants: number;
  paidTenants: number;
  complimentaryTenants: number;
  mrr: number;
  pendingApplications: number;
}

interface Tenant {
  id: string;
  slug: string;
  name: string;
  plan: TenantPlan;
  status: TenantStatus;
  memberCount: number;
  eventCount: number;
  recentActivityCount: number;
  createdAt: string;
}

interface Application {
  id: string;
  circleName: string;
  desiredSlug: string | null;
  contactName: string | null;
  contactInfo: string | null;
  note: string | null;
  status: ApplicationStatus;
  processedAt: string | null;
  resultNote: string | null;
  createdAt: string;
}

interface OverviewData {
  stats: Stats;
  tenants: Tenant[];
  applications: Application[];
}

const PLAN_LABEL: Record<TenantPlan, string> = {
  free: "無料",
  paid: "有料",
  complimentary: "特別無償",
};

const PLAN_BADGE: Record<TenantPlan, string> = {
  free: "bg-gray-100 text-gray-700",
  paid: "bg-green-100 text-green-700",
  complimentary: "bg-blue-100 text-blue-700",
};

const STATUS_LABEL: Record<TenantStatus, string> = {
  active: "有効",
  frozen: "凍結",
  pending: "保留",
};

const STATUS_BADGE: Record<TenantStatus, string> = {
  active: "bg-green-100 text-green-700",
  frozen: "bg-red-100 text-red-700",
  pending: "bg-yellow-100 text-yellow-700",
};

type LineFieldKey =
  | "lineLoginChannelId"
  | "lineLoginChannelSecret"
  | "lineMessagingChannelId"
  | "lineMessagingChannelSecret"
  | "lineMessagingAccessToken";

interface LineFieldDef {
  key: LineFieldKey;
  label: string;
  secret: boolean;
  hasKey?: "hasLineLoginSecret" | "hasLineMessagingSecret" | "hasLineMessagingAccessToken";
}

const LINE_FIELDS: LineFieldDef[] = [
  { key: "lineLoginChannelId", label: "Login チャネルID", secret: false },
  { key: "lineLoginChannelSecret", label: "Login チャネルシークレット", secret: true, hasKey: "hasLineLoginSecret" },
  { key: "lineMessagingChannelId", label: "Messaging チャネルID", secret: false },
  {
    key: "lineMessagingChannelSecret",
    label: "Messaging チャネルシークレット",
    secret: true,
    hasKey: "hasLineMessagingSecret",
  },
  {
    key: "lineMessagingAccessToken",
    label: "Messaging アクセストークン",
    secret: true,
    hasKey: "hasLineMessagingAccessToken",
  },
];

const EMPTY_LINE_VALUES: Record<LineFieldKey, string> = {
  lineLoginChannelId: "",
  lineLoginChannelSecret: "",
  lineMessagingChannelId: "",
  lineMessagingChannelSecret: "",
  lineMessagingAccessToken: "",
};

const EMPTY_LINE_CLEAR: Record<LineFieldKey, boolean> = {
  lineLoginChannelId: false,
  lineLoginChannelSecret: false,
  lineMessagingChannelId: false,
  lineMessagingChannelSecret: false,
  lineMessagingAccessToken: false,
};

interface LineChannelData {
  hasLineLoginSecret: boolean;
  hasLineMessagingSecret: boolean;
  hasLineMessagingAccessToken: boolean;
}

const EMPTY_LINE_HAS: LineChannelData = {
  hasLineLoginSecret: false,
  hasLineMessagingSecret: false,
  hasLineMessagingAccessToken: false,
};

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  const d = new Date(dateString);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export default function PlatformPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [updatingTenantId, setUpdatingTenantId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newPlan, setNewPlan] = useState<TenantPlan>("complimentary");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [processingAppId, setProcessingAppId] = useState<string | null>(null);
  const [appError, setAppError] = useState<string | null>(null);

  const [lineTenant, setLineTenant] = useState<Tenant | null>(null);
  const [lineLoading, setLineLoading] = useState(false);
  const [lineSaving, setLineSaving] = useState(false);
  const [lineError, setLineError] = useState<string | null>(null);
  const [lineValues, setLineValues] = useState<Record<LineFieldKey, string>>(EMPTY_LINE_VALUES);
  const [lineInitial, setLineInitial] = useState<Record<LineFieldKey, string>>(EMPTY_LINE_VALUES);
  const [lineClear, setLineClear] = useState<Record<LineFieldKey, boolean>>(EMPTY_LINE_CLEAR);
  const [lineHas, setLineHas] = useState<LineChannelData>(EMPTY_LINE_HAS);

  const isPlatformAdmin = !!session?.user?.isPlatformAdmin;

  const fetchOverview = async () => {
    try {
      const res = await fetch("/api/platform/overview");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setError(null);
      } else {
        setError(json.error?.message || "取得に失敗しました");
      }
    } catch (e) {
      setError("通信エラー: " + String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && isPlatformAdmin) {
      fetchOverview();
    } else if (status !== "loading") {
      setLoading(false);
    }
  }, [status, isPlatformAdmin]);

  const handlePlanChange = async (tenant: Tenant, plan: TenantPlan) => {
    if (plan === tenant.plan) return;
    if (
      !window.confirm(
        `「${tenant.name}」のプランを ${PLAN_LABEL[tenant.plan]} → ${PLAN_LABEL[plan]} に変更しますか？`,
      )
    ) {
      return;
    }
    setUpdatingTenantId(tenant.id);
    setError(null);
    try {
      const res = await fetch(`/api/platform/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchOverview();
      } else {
        setError(json.error?.message || "プラン変更に失敗しました");
      }
    } catch (e) {
      setError("通信エラー: " + String(e));
    } finally {
      setUpdatingTenantId(null);
    }
  };

  const handleStatusChange = async (tenant: Tenant, statusValue: TenantStatus) => {
    if (statusValue === tenant.status) return;
    if (
      !window.confirm(
        `「${tenant.name}」の状態を ${STATUS_LABEL[tenant.status]} → ${STATUS_LABEL[statusValue]} に変更しますか？`,
      )
    ) {
      return;
    }
    setUpdatingTenantId(tenant.id);
    setError(null);
    try {
      const res = await fetch(`/api/platform/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusValue }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchOverview();
      } else {
        setError(json.error?.message || "状態変更に失敗しました");
      }
    } catch (e) {
      setError("通信エラー: " + String(e));
    } finally {
      setUpdatingTenantId(null);
    }
  };

  const handleCreateTenant = async () => {
    if (!newName.trim() || !newSlug.trim() || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/platform/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), slug: newSlug.trim(), plan: newPlan }),
      });
      const json = await res.json();
      if (json.success) {
        setNewName("");
        setNewSlug("");
        setNewPlan("complimentary");
        await fetchOverview();
      } else {
        setCreateError(json.error?.message || "作成に失敗しました");
      }
    } catch (e) {
      setCreateError("通信エラー: " + String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleApprove = async (app: Application) => {
    let slug = app.desiredSlug;
    if (!slug) {
      slug = window.prompt(`「${app.circleName}」の slug を入力してください (英小文字・数字・ハイフン)`);
      if (!slug) return;
    }
    setProcessingAppId(app.id);
    setAppError(null);
    try {
      const res = await fetch(`/api/platform/applications/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", slug }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchOverview();
      } else {
        setAppError(json.error?.message || "承認に失敗しました");
      }
    } catch (e) {
      setAppError("通信エラー: " + String(e));
    } finally {
      setProcessingAppId(null);
    }
  };

  const handleReject = async (app: Application) => {
    if (!window.confirm(`「${app.circleName}」の申請を却下しますか？`)) return;
    setProcessingAppId(app.id);
    setAppError(null);
    try {
      const res = await fetch(`/api/platform/applications/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchOverview();
      } else {
        setAppError(json.error?.message || "却下に失敗しました");
      }
    } catch (e) {
      setAppError("通信エラー: " + String(e));
    } finally {
      setProcessingAppId(null);
    }
  };

  const openLineModal = async (tenant: Tenant) => {
    setLineTenant(tenant);
    setLineError(null);
    setLineValues(EMPTY_LINE_VALUES);
    setLineInitial(EMPTY_LINE_VALUES);
    setLineClear(EMPTY_LINE_CLEAR);
    setLineHas(EMPTY_LINE_HAS);
    setLineLoading(true);
    try {
      const res = await fetch(`/api/platform/tenants/${tenant.id}/line-channel`);
      const json = await res.json();
      if (json.success) {
        const d = json.data;
        const fetched: Record<LineFieldKey, string> = {
          ...EMPTY_LINE_VALUES,
          lineLoginChannelId: d.lineLoginChannelId ?? "",
          lineMessagingChannelId: d.lineMessagingChannelId ?? "",
        };
        setLineValues(fetched);
        setLineInitial(fetched);
        setLineHas({
          hasLineLoginSecret: !!d.hasLineLoginSecret,
          hasLineMessagingSecret: !!d.hasLineMessagingSecret,
          hasLineMessagingAccessToken: !!d.hasLineMessagingAccessToken,
        });
      } else {
        setLineError(json.error?.message || "取得に失敗しました");
      }
    } catch (e) {
      setLineError("通信エラー: " + String(e));
    } finally {
      setLineLoading(false);
    }
  };

  const closeLineModal = () => {
    if (lineSaving) return;
    setLineTenant(null);
  };

  const handleLineFieldChange = (field: LineFieldKey, value: string) => {
    setLineValues((prev) => ({ ...prev, [field]: value }));
    // 入力を始めたら「クリア予定」は取り消す (入力値を優先する)
    if (lineClear[field]) {
      setLineClear((prev) => ({ ...prev, [field]: false }));
    }
  };

  const handleLineFieldClear = (field: LineFieldKey) => {
    setLineValues((prev) => ({ ...prev, [field]: "" }));
    setLineClear((prev) => ({ ...prev, [field]: true }));
  };

  const handleSaveLine = async () => {
    if (!lineTenant || lineSaving) return;
    const body: Record<string, string> = {};
    for (const f of LINE_FIELDS) {
      const current = lineValues[f.key].trim();
      if (f.secret) {
        if (lineClear[f.key]) {
          body[f.key] = "";
        } else if (current.length > 0) {
          body[f.key] = current;
        }
      } else if (current !== lineInitial[f.key].trim()) {
        body[f.key] = current;
      }
    }
    if (Object.keys(body).length === 0) {
      setLineError("変更がありません");
      return;
    }
    setLineSaving(true);
    setLineError(null);
    try {
      const res = await fetch(`/api/platform/tenants/${lineTenant.id}/line-channel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setLineTenant(null);
        await fetchOverview();
      } else {
        setLineError(json.error?.message || "保存に失敗しました");
      }
    } catch (e) {
      setLineError("通信エラー: " + String(e));
    } finally {
      setLineSaving(false);
    }
  };

  // 未ログイン・非プラットフォーム管理者には存在を秘匿する
  if (status === "unauthenticated" || (status === "authenticated" && !isPlatformAdmin)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">ページが見つかりません</div>
      </div>
    );
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  const pendingApplications = (data?.applications ?? []).filter((a) => a.status === "pending");
  const processedApplications = (data?.applications ?? []).filter((a) => a.status !== "pending");

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">プラットフォーム管理</h1>
          <p className="text-xs text-gray-500 mt-0.5">テナント（サークル）の一覧・プラン・申請を管理します</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* 統計タイル */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-gray-500">テナント総数</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{data.stats.totalTenants}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-gray-500">有効テナント</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{data.stats.activeTenants}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-gray-500">有料テナント</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{data.stats.paidTenants}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-gray-500">MRR</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatYen(data.stats.mrr)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-gray-500">承認待ち申請</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{data.stats.pendingApplications}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* テナント一覧 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            テナント一覧 ({data?.tenants.length ?? 0})
          </h2>
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">slug</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">名前</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">プラン</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">状態</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider">メンバー</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider">イベント</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider">直近30日操作</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">作成日</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.tenants.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-6 text-gray-500">テナントがありません</td>
                  </tr>
                ) : (
                  data!.tenants.map((tenant) => (
                    <tr key={tenant.id}>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700 whitespace-nowrap">{tenant.slug}</td>
                      <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{tenant.name}</td>
                      <td className="px-3 py-2">
                        <select
                          value={tenant.plan}
                          disabled={updatingTenantId === tenant.id}
                          onChange={(e) => handlePlanChange(tenant, e.target.value as TenantPlan)}
                          className={`text-xs font-medium rounded-full px-2 py-1 border-0 disabled:opacity-50 ${PLAN_BADGE[tenant.plan]}`}
                        >
                          <option value="free">無料</option>
                          <option value="paid">有料</option>
                          <option value="complimentary">特別無償</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={tenant.status}
                          disabled={updatingTenantId === tenant.id}
                          onChange={(e) => handleStatusChange(tenant, e.target.value as TenantStatus)}
                          className={`text-xs font-medium rounded-full px-2 py-1 border-0 disabled:opacity-50 ${STATUS_BADGE[tenant.status]}`}
                        >
                          <option value="active">有効</option>
                          <option value="frozen">凍結</option>
                          <option value="pending">保留</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">{tenant.memberCount}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{tenant.eventCount}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{tenant.recentActivityCount}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{formatDate(tenant.createdAt)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Button size="sm" variant="secondary" onClick={() => openLineModal(tenant)}>
                          LINE設定
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 新規テナント作成 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">新規テナント作成</h2>
          <Card>
            <CardContent className="py-4">
              {createError && (
                <p className="text-sm text-red-600 mb-3">{createError}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="サークル名"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm sm:col-span-2"
                />
                <input
                  type="text"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="slug (例: sample-circle)"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value as TenantPlan)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="complimentary">特別無償</option>
                  <option value="free">無料</option>
                  <option value="paid">有料</option>
                </select>
              </div>
              <div className="mt-3">
                <Button
                  onClick={handleCreateTenant}
                  loading={creating}
                  disabled={!newName.trim() || !newSlug.trim()}
                  className="text-sm"
                >
                  作成
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 申請一覧 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            申請一覧 (承認待ち {pendingApplications.length})
          </h2>
          {appError && (
            <p className="text-sm text-red-600 mb-2">{appError}</p>
          )}
          <div className="space-y-2">
            {pendingApplications.length === 0 && processedApplications.length === 0 && (
              <p className="text-sm text-gray-500">申請はありません</p>
            )}
            {pendingApplications.map((app) => (
              <Card key={app.id}>
                <CardContent className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">
                      {app.circleName}
                      {app.desiredSlug && (
                        <span className="ml-2 text-xs font-mono text-gray-500">({app.desiredSlug})</span>
                      )}
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                        承認待ち
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {app.contactName ?? "—"} / {app.contactInfo ?? "—"}
                    </p>
                    {app.note && <p className="text-xs text-gray-500 mt-0.5">{app.note}</p>}
                    <p className="text-[10px] text-gray-400 mt-0.5">申請日: {formatDate(app.createdAt)}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(app)}
                      loading={processingAppId === app.id}
                      disabled={processingAppId !== null && processingAppId !== app.id}
                    >
                      承認
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleReject(app)}
                      loading={processingAppId === app.id}
                      disabled={processingAppId !== null && processingAppId !== app.id}
                    >
                      却下
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {processedApplications.map((app) => (
              <Card key={app.id} className="opacity-60">
                <CardContent className="py-3">
                  <p className="font-medium text-gray-700">
                    {app.circleName}
                    <span
                      className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${
                        app.status === "approved" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {app.status === "approved" ? "承認済み" : "却下済み"}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {app.contactName ?? "—"} / 処理日: {formatDate(app.processedAt)}
                  </p>
                  {app.resultNote && <p className="text-xs text-gray-500 mt-0.5">{app.resultNote}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <Modal
        isOpen={!!lineTenant}
        onClose={closeLineModal}
        title={`LINE設定 - ${lineTenant?.name ?? ""}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            各サークルが LINE Developers で作成した LINE Login チャネルを登録すると、そのサークルの URL からはそのチャネルでログインされます。コールバックURLには
            https://&lt;このアプリのドメイン&gt;/api/auth/callback/line を登録してもらってください。
          </p>

          {lineError && (
            <p className="text-sm text-red-600">{lineError}</p>
          )}

          {lineLoading ? (
            <p className="text-sm text-gray-500">読み込み中...</p>
          ) : (
            <div className="space-y-3">
              {LINE_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type={f.secret ? "password" : "text"}
                      value={lineValues[f.key]}
                      onChange={(e) => handleLineFieldChange(f.key, e.target.value)}
                      placeholder={
                        f.secret && f.hasKey && lineHas[f.hasKey]
                          ? "設定済み (変更する場合のみ入力)"
                          : undefined
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      disabled={lineSaving}
                    />
                    {f.secret && (
                      <button
                        type="button"
                        onClick={() => handleLineFieldClear(f.key)}
                        disabled={lineSaving}
                        className="text-xs text-red-600 hover:underline shrink-0 disabled:opacity-50"
                      >
                        クリア
                      </button>
                    )}
                  </div>
                  {f.secret && lineClear[f.key] && (
                    <p className="text-xs text-red-600 mt-0.5">クリア予定</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={closeLineModal} disabled={lineSaving}>
              キャンセル
            </Button>
            <Button onClick={handleSaveLine} loading={lineSaving} disabled={lineLoading}>
              保存
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
