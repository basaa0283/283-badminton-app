import { prisma } from "./prisma";

// ユーザー削除の共通処理。SQL Server 側で onDelete が NoAction のテーブル
// (PointTransaction / AchievementUnlock / AnnouncementRead / Message) を先に消してから
// User 本体を削除する。全体をトランザクションで包む。
// 注: Tournament / TournamentResult を持つユーザーの削除は FK エラーで失敗するが、
// それは「成績データを持つメンバーは削除でなく無効化すべき」という意図的な制約として残す。
export async function deleteUserCascade(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.pointTransaction.deleteMany({ where: { userId } }),
    prisma.achievementUnlock.deleteMany({ where: { userId } }),
    prisma.announcementRead.deleteMany({ where: { userId } }),
    prisma.message.deleteMany({ where: { senderId: userId } }),
    // EmailToken は User への FK を張っていないので明示削除が必須
    prisma.emailToken.deleteMany({ where: { userId } }),
    prisma.invitationToken.deleteMany({ where: { userId } }),
    prisma.attendanceHistory.deleteMany({ where: { userId } }),
    prisma.attendance.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}
