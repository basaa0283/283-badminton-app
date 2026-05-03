import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/invite/[token] - 招待トークンの検証（認証不要）
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const invitation = await prisma.invitationToken.findUnique({
      where: { token },
      include: { user: { select: { nickname: true, role: true } } },
    });

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "招待リンクが見つかりません" } },
        { status: 404 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: { code: "EXPIRED", message: "招待リンクの有効期限が切れています" } },
        { status: 410 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { nickname: invitation.user.nickname },
    });
  } catch (error) {
    console.error("GET /api/invite/[token] error:", error);
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
