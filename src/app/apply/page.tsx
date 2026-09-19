"use client";

import { useState } from "react";
import Link from "next/link";

interface FormState {
  circleName: string;
  desiredSlug: string;
  contactName: string;
  contactInfo: string;
  note: string;
  website: string; // honeypot
}

const initialForm: FormState = {
  circleName: "",
  desiredSlug: "",
  contactName: "",
  contactInfo: "",
  note: "",
  website: "",
};

export default function ApplyPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const update = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/public/tenant-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          circleName: form.circleName,
          desiredSlug: form.desiredSlug,
          contactName: form.contactName,
          contactInfo: form.contactInfo,
          note: form.note,
          website: form.website,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setDone(true);
      } else {
        setError(json.error?.message || "申請の送信に失敗しました");
      }
    } catch (err) {
      setError("通信エラー: " + String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="text-sm">
          <Link href="/login" className="text-blue-600 hover:underline">
            ← ログイン
          </Link>
        </div>

        <h1 className="text-xl font-bold text-gray-900">サークル利用申請</h1>
        <p className="text-sm text-gray-700">
          バドミントンサークル向けの出欠管理アプリです。ご利用を希望されるサークルの情報を送信してください。運営が確認後、ご連絡します。
        </p>

        <section className="bg-white rounded-lg shadow p-6">
          {done ? (
            <p className="text-sm text-gray-900">
              申請を受け付けました。内容を確認のうえ、連絡先にご連絡します。
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  サークル名 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={form.circleName}
                  onChange={(e) => update("circleName", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">希望ID</label>
                <input
                  type="text"
                  maxLength={30}
                  value={form.desiredSlug}
                  onChange={(e) => update("desiredSlug", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  URLに使われます (例: 28bad)。英小文字・数字・ハイフンで3〜30文字
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  お名前 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={form.contactName}
                  onChange={(e) => update("contactName", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  連絡先 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  placeholder="メールアドレス または LINE ID"
                  value={form.contactInfo}
                  onChange={(e) => update("contactInfo", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">補足</label>
                <textarea
                  rows={4}
                  placeholder="活動地域・人数・現在の運営方法など"
                  value={form.note}
                  onChange={(e) => update("note", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {/* honeypot: bot 対策。人間には見えない項目なので入力してはいけない */}
              <div className="hidden">
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) => update("website", e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-lg text-sm"
              >
                {submitting ? "送信中..." : "申請する"}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
