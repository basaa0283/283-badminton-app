import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CURRENT_TERMS_VERSION } from "@/lib/legal";

// POST /api/onboarding/terms - 現行バージョンの利用規約・PP に同意
//
// 認証必要。同意したユーザーの termsAcceptedAt / termsAcceptedVersion を更新。
// バージョンを上げたら全ユーザーが再同意する仕様。
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED" } },
        { status: 401 }
      );
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        termsAcceptedAt: new Date(),
        termsAcceptedVersion: CURRENT_TERMS_VERSION,
      },
    });

    return NextResponse.json({
      success: true,
      data: { termsAcceptedVersion: CURRENT_TERMS_VERSION },
    });
  } catch (error) {
    console.error("POST /api/onboarding/terms error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}
