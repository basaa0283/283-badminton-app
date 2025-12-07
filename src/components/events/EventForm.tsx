"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface EventFormData {
  title: string;
  description: string;
  eventDate: string;
  location: string;
  capacity: string;
  fee: string;
  feeVisible: boolean;
  deadline: string;
  deadlineEnabled: boolean;
}

interface EventFormProps {
  initialData?: Partial<EventFormData>;
  onSubmit: (data: EventFormData) => Promise<void>;
  submitLabel?: string;
}

export function EventForm({ initialData, onSubmit, submitLabel = "作成" }: EventFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<EventFormData>({
    title: initialData?.title || "",
    description: initialData?.description || "",
    eventDate: initialData?.eventDate || "",
    location: initialData?.location || "",
    capacity: initialData?.capacity || "",
    fee: initialData?.fee || "",
    feeVisible: initialData?.feeVisible || false,
    deadline: initialData?.deadline || "",
    deadlineEnabled: initialData?.deadlineEnabled || false,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          タイトル <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          required
          maxLength={100}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="例: 12月練習会"
        />
      </div>

      <div>
        <label htmlFor="eventDate" className="block text-sm font-medium text-gray-700 mb-1">
          開催日時 <span className="text-red-500">*</span>
        </label>
        <input
          type="datetime-local"
          id="eventDate"
          name="eventDate"
          value={formData.eventDate}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
          場所
        </label>
        <input
          type="text"
          id="location"
          name="location"
          value={formData.location}
          onChange={handleChange}
          maxLength={200}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="例: ○○体育館"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          説明
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          maxLength={1000}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder="イベントの詳細を入力"
        />
      </div>

      <div>
        <label htmlFor="capacity" className="block text-sm font-medium text-gray-700 mb-1">
          定員（空欄で無制限）
        </label>
        <input
          type="number"
          id="capacity"
          name="capacity"
          value={formData.capacity}
          onChange={handleChange}
          min={1}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="例: 20"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="feeVisible"
            name="feeVisible"
            checked={formData.feeVisible}
            onChange={handleChange}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="feeVisible" className="text-sm font-medium text-gray-700">
            参加費を表示する
          </label>
        </div>

        {formData.feeVisible && (
          <div>
            <label htmlFor="fee" className="block text-sm font-medium text-gray-700 mb-1">
              参加費（円）
            </label>
            <input
              type="number"
              id="fee"
              name="fee"
              value={formData.fee}
              onChange={handleChange}
              min={0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例: 500"
            />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="deadlineEnabled"
            name="deadlineEnabled"
            checked={formData.deadlineEnabled}
            onChange={handleChange}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="deadlineEnabled" className="text-sm font-medium text-gray-700">
            締め切りを設定する
          </label>
        </div>

        {formData.deadlineEnabled && (
          <div>
            <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-1">
              締め切り日時
            </label>
            <input
              type="datetime-local"
              id="deadline"
              name="deadline"
              value={formData.deadline}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="secondary" className="flex-1" onClick={() => router.back()}>
          キャンセル
        </Button>
        <Button type="submit" className="flex-1" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
