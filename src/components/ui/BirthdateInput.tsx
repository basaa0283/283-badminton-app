"use client";

const NOW = new Date();
// 100年分 (現在 - 100年 〜 現在)
const YEAR_OPTIONS: number[] = Array.from({ length: 101 }, (_, i) => NOW.getFullYear() - i);

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

interface BirthdateInputProps {
  value: string; // "YYYY-MM-DD" 形式 or 空文字
  onChange: (value: string) => void;
  idPrefix?: string;
}

export function BirthdateInput({ value, onChange, idPrefix = "birthdate" }: BirthdateInputProps) {
  // value は常に "YYYY-MM-DD" 形式 (全て揃った状態) または空文字 のいずれかを保つ。
  // 月や日だけクリアされた中途半端な状態は内部的にもファイル外にも出さない:
  // - 過去にここで "1991--" や "1991-01-" のような不正値を返してしまい、
  //   保存処理で new Date(invalid).toISOString() が走って失敗 (または NaN を経て
  //   サイレントに null 保存) するバグがあった。
  const [y, m, d] = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-") : ["", "", ""];

  // クリア導線は「年を空白に戻す」だけに統一。
  // 過去は「月や日を空白に戻す → 全体クリア」にしていたが、ユーザーが他項目を
  // 編集している最中にドロップダウンを誤操作してしまうと生年月日が黙って消える
  // 事故があったため、月日のクリアでは触らない (=年が入っている限り保持) 設計に変更。
  const setY = (newY: string) => {
    if (!newY) {
      onChange("");
      return;
    }
    const mm = m || "01";
    const dd = d || "01";
    const maxD = daysInMonth(Number(newY), Number(mm));
    const safeD = Math.min(Number(dd), maxD);
    onChange(`${newY}-${mm}-${pad2(safeD)}`);
  };
  const setM = (newM: string) => {
    const yy = y || String(NOW.getFullYear() - 30);
    // 月空白に戻す操作は無視 (年クリアでのみ全体リセット)
    const mm = newM || m || "01";
    const dd = d || "01";
    const maxD = daysInMonth(Number(yy), Number(mm));
    const safeD = Math.min(Number(dd), maxD);
    onChange(`${yy}-${pad2(Number(mm))}-${pad2(safeD)}`);
  };
  const setD = (newD: string) => {
    const yy = y || String(NOW.getFullYear() - 30);
    const mm = m || "01";
    // 日空白に戻す操作は無視 (年クリアでのみ全体リセット)
    const dd = newD || d || "01";
    onChange(`${yy}-${pad2(Number(mm))}-${pad2(Number(dd))}`);
  };

  const maxD = y && m ? daysInMonth(Number(y), Number(m)) : 31;

  return (
    <div className="grid grid-cols-3 gap-2">
      <select
        aria-label="生年"
        id={`${idPrefix}-year`}
        value={y || ""}
        onChange={(e) => setY(e.target.value)}
        className="block w-full min-w-0 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
      >
        <option value="">年</option>
        {YEAR_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <select
        aria-label="生月"
        id={`${idPrefix}-month`}
        value={m || ""}
        onChange={(e) => setM(e.target.value)}
        className="block w-full min-w-0 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
      >
        <option value="">月</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((opt) => (
          <option key={opt} value={pad2(opt)}>
            {opt}
          </option>
        ))}
      </select>
      <select
        aria-label="生日"
        id={`${idPrefix}-day`}
        value={d || ""}
        onChange={(e) => setD(e.target.value)}
        className="block w-full min-w-0 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
      >
        <option value="">日</option>
        {Array.from({ length: maxD }, (_, i) => i + 1).map((opt) => (
          <option key={opt} value={pad2(opt)}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
