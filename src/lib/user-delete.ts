import { prisma } from "./prisma";

// ユーザー削除の共通処理。SQL Server 側で User への FK を持つ子テーブルを
// 先に全て消してから User 本体を削除する。全体をトランザクションで包む。
// SQL Server では onDelete が Cascade でも、実運用で孤児レコードが残った実績が
// あるため (過去の削除漏れ)、User を参照する子テーブルは全て明示削除する方針。
// 注: Tournament / TournamentResult を持つユーザーの削除は FK エラーで失敗するが、
// それは「成績データを持つメンバーは削除でなく無効化すべき」という意図的な制約として残す。
export async function deleteUserCascade(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.pointTransaction.deleteMany({ where: { userId } }),
    prisma.achievementUnlock.deleteMany({ where: { userId } }),
    prisma.announcementRead.deleteMany({ where: { userId } }),
    prisma.message.deleteMany({ where: { senderId: userId } }),
    // メンバータグの割り当て。SQL Server では Cascade だが孤児が残った実績があるため明示削除
    prisma.userMemberTag.deleteMany({ where: { userId } }),
    // EmailToken は User への FK を張っていないので明示削除が必須
    prisma.emailToken.deleteMany({ where: { userId } }),
    prisma.invitationToken.deleteMany({ where: { userId } }),
    prisma.attendanceHistory.deleteMany({ where: { userId } }),
    prisma.attendance.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}
