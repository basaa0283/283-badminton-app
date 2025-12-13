import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 既存データの削除（オプション）
  await prisma.attendance.deleteMany();
  await prisma.message.deleteMany();
  await prisma.event.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  console.log("Creating users...");

  // テストユーザー作成
  const admin = await prisma.user.create({
    data: {
      id: "admin-user-1",
      nickname: "管理太郎",
      firstName: "太郎",
      lastName: "管理",
      gender: "male",
      age: 35,
      ageVisible: true,
      role: "admin",
      comment: "管理者です。よろしくお願いします！",
    },
  });

  const subadmin = await prisma.user.create({
    data: {
      id: "subadmin-user-1",
      nickname: "副管理花子",
      firstName: "花子",
      lastName: "副管理",
      gender: "female",
      age: 30,
      ageVisible: true,
      role: "subadmin",
      comment: "副管理者としてお手伝いします",
    },
  });

  const members = await Promise.all([
    prisma.user.create({
      data: {
        id: "member-user-1",
        nickname: "田中一郎",
        firstName: "一郎",
        lastName: "田中",
        gender: "male",
        age: 28,
        ageVisible: true,
        role: "member",
        comment: "バドミントン歴5年です",
      },
    }),
    prisma.user.create({
      data: {
        id: "member-user-2",
        nickname: "佐藤美咲",
        firstName: "美咲",
        lastName: "佐藤",
        gender: "female",
        age: 25,
        ageVisible: true,
        role: "member",
        comment: "初心者ですが頑張ります！",
      },
    }),
    prisma.user.create({
      data: {
        id: "member-user-3",
        nickname: "山田健太",
        firstName: "健太",
        lastName: "山田",
        gender: "male",
        age: 32,
        ageVisible: false,
        role: "member",
        comment: "ダブルス専門です",
      },
    }),
    prisma.user.create({
      data: {
        id: "member-user-4",
        nickname: "鈴木愛",
        firstName: "愛",
        lastName: "鈴木",
        gender: "female",
        age: 27,
        ageVisible: true,
        role: "member",
      },
    }),
    prisma.user.create({
      data: {
        id: "member-user-5",
        nickname: "高橋誠",
        firstName: "誠",
        lastName: "高橋",
        gender: "male",
        age: 40,
        ageVisible: true,
        role: "member",
        comment: "週末参加メインです",
      },
    }),
  ]);

  const visitors = await Promise.all([
    prisma.user.create({
      data: {
        id: "visitor-user-1",
        nickname: "伊藤さん",
        gender: "male",
        role: "visitor",
        comment: "見学希望です",
      },
    }),
    prisma.user.create({
      data: {
        id: "visitor-user-2",
        nickname: "渡辺さん",
        gender: "female",
        role: "visitor",
      },
    }),
  ]);

  const guest = await prisma.user.create({
    data: {
      id: "guest-user-1",
      nickname: "新規ゲスト",
      role: "guest",
    },
  });

  console.log(`Created ${2 + members.length + visitors.length + 1} users`);

  console.log("Creating events...");

  // イベント作成
  const now = new Date();

  // 過去のイベント
  const pastEvent1 = await prisma.event.create({
    data: {
      id: "event-past-1",
      title: "11月練習会",
      description: "11月の定期練習会です。初心者歓迎！",
      eventDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), // 2週間前
      eventEndDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      location: "市民体育館 第1アリーナ",
      capacity: 20,
      fee: 500,
      feeVisible: true,
      createdById: admin.id,
    },
  });

  const pastEvent2 = await prisma.event.create({
    data: {
      id: "event-past-2",
      title: "忘年会練習会",
      description: "年末特別練習会！練習後に忘年会があります。",
      eventDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 1週間前
      eventEndDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
      location: "コミュニティセンター体育館",
      capacity: 16,
      fee: 1000,
      feeVisible: true,
      createdById: subadmin.id,
    },
  });

  // 今後のイベント
  const futureEvent1 = await prisma.event.create({
    data: {
      id: "event-future-1",
      title: "12月練習会",
      description: "12月の定期練習会です。\n\n持ち物：\n- ラケット\n- シューズ\n- 飲み物\n- タオル",
      eventDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3日後
      eventEndDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      location: "市民体育館 第1アリーナ",
      capacity: 20,
      fee: 500,
      feeVisible: true,
      deadline: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // 2日後締め切り
      deadlineEnabled: true,
      createdById: admin.id,
    },
  });

  const futureEvent2 = await prisma.event.create({
    data: {
      id: "event-future-2",
      title: "初心者向け練習会",
      description: "初心者の方向けの練習会です。基礎から丁寧に教えます。経験者の方はサポートお願いします！",
      eventDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), // 10日後
      eventEndDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      location: "区民センター 多目的室",
      capacity: 12,
      fee: 300,
      feeVisible: true,
      createdById: subadmin.id,
    },
  });

  const futureEvent3 = await prisma.event.create({
    data: {
      id: "event-future-3",
      title: "新年初打ち会",
      description: "2025年の初打ち！みんなで新年を祝いましょう。",
      eventDate: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000), // 3週間後
      eventEndDate: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
      location: "市民体育館 第2アリーナ",
      capacity: 24,
      createdById: admin.id,
    },
  });

  // 定員少なめのイベント（キャンセル待ちテスト用）
  const limitedEvent = await prisma.event.create({
    data: {
      id: "event-limited-1",
      title: "少人数練習会",
      description: "定員6名の少人数練習会です。じっくり練習できます。",
      eventDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5日後
      eventEndDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      location: "会議室B（多目的利用）",
      capacity: 6,
      fee: 400,
      feeVisible: true,
      createdById: subadmin.id,
    },
  });

  console.log("Created 6 events");

  console.log("Creating attendances...");

  // 過去イベントの出欠
  await prisma.attendance.createMany({
    data: [
      { userId: admin.id, eventId: pastEvent1.id, status: "attending" },
      { userId: subadmin.id, eventId: pastEvent1.id, status: "attending" },
      { userId: members[0].id, eventId: pastEvent1.id, status: "attending" },
      { userId: members[1].id, eventId: pastEvent1.id, status: "attending" },
      { userId: members[2].id, eventId: pastEvent1.id, status: "not_attending", comment: "仕事で不参加" },
      { userId: members[3].id, eventId: pastEvent1.id, status: "attending" },
      { userId: members[4].id, eventId: pastEvent1.id, status: "attending" },

      { userId: admin.id, eventId: pastEvent2.id, status: "attending" },
      { userId: subadmin.id, eventId: pastEvent2.id, status: "attending" },
      { userId: members[0].id, eventId: pastEvent2.id, status: "attending", comment: "忘年会も参加します！" },
      { userId: members[1].id, eventId: pastEvent2.id, status: "not_attending", comment: "年末で実家に帰省中" },
      { userId: members[2].id, eventId: pastEvent2.id, status: "attending" },
      { userId: members[3].id, eventId: pastEvent2.id, status: "attending" },
    ],
  });

  // 今後のイベントの出欠
  await prisma.attendance.createMany({
    data: [
      { userId: admin.id, eventId: futureEvent1.id, status: "attending" },
      { userId: subadmin.id, eventId: futureEvent1.id, status: "attending" },
      { userId: members[0].id, eventId: futureEvent1.id, status: "attending", comment: "楽しみにしています！" },
      { userId: members[1].id, eventId: futureEvent1.id, status: "attending" },
      { userId: members[2].id, eventId: futureEvent1.id, status: "not_attending", comment: "予定あり" },
      { userId: visitors[0].id, eventId: futureEvent1.id, status: "attending", comment: "見学させてください" },

      { userId: admin.id, eventId: futureEvent2.id, status: "attending", comment: "サポートします" },
      { userId: members[1].id, eventId: futureEvent2.id, status: "attending" },
      { userId: visitors[1].id, eventId: futureEvent2.id, status: "attending", comment: "初参加です" },

      { userId: admin.id, eventId: futureEvent3.id, status: "attending" },
      { userId: subadmin.id, eventId: futureEvent3.id, status: "attending" },
      { userId: members[0].id, eventId: futureEvent3.id, status: "attending" },
    ],
  });

  // キャンセル待ちを含むイベント（定員6名）
  await prisma.attendance.createMany({
    data: [
      { userId: admin.id, eventId: limitedEvent.id, status: "attending" },
      { userId: subadmin.id, eventId: limitedEvent.id, status: "attending" },
      { userId: members[0].id, eventId: limitedEvent.id, status: "attending" },
      { userId: members[1].id, eventId: limitedEvent.id, status: "attending" },
      { userId: members[2].id, eventId: limitedEvent.id, status: "attending" },
      { userId: members[3].id, eventId: limitedEvent.id, status: "attending" },
      // キャンセル待ち
      { userId: members[4].id, eventId: limitedEvent.id, status: "waitlist", position: 1, comment: "キャンセル出たら参加希望" },
      { userId: visitors[0].id, eventId: limitedEvent.id, status: "waitlist", position: 2 },
    ],
  });

  const attendanceCount = await prisma.attendance.count();
  console.log(`Created ${attendanceCount} attendances`);

  console.log("Seed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
