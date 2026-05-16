// 生年月日から現在の満年齢を算出。誕生日前なら未到達分を引く。
export function computeAge(birthdate: Date | string | null | undefined): number | null {
  if (!birthdate) return null;
  const bd = typeof birthdate === "string" ? new Date(birthdate) : birthdate;
  if (Number.isNaN(bd.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  const monthDiff = now.getMonth() - bd.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < bd.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}
