import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { z } from "zod";

const createProvisionalMemberSchema = z.object({
  nickname: z.string().min(1, "ニックネームは必須です").max(50),
  firstName: z.string().max(50).optional().nullable(),
  lastName: z.string().max(50).optional().nullable(),
  gender: z.enum(["male", "female"]).optional().nullable(),
  age: z.number().int().min(0).max(150).optional().nullable(),
  comment: z.string().max(500).optional().nullable(),
  skillLevel: z.number().int().min(1).max(10).optional().nullable(),
  adminNote: z.string().max(1000).optional().nullable(),
});

// POST /api/admin/members - 仮アカウント作成
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }

    const role = session.user.role as UserRole;
    if (!permissions.canAccessAdmin(role)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createProvisionalMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } },
        { status: 400 }
      );
    }

    const user = await prisma.user.create({
      data: {
        nickname: parsed.data.nickname,
        firstName: parsed.data.firstName ?? null,
        lastName: parsed.data.lastName ?? null,
        gender: parsed.data.gender ?? null,
        age: parsed.data.age ?? null,
        comment: parsed.data.comment ?? null,
        skillLevel: parsed.data.skillLevel ?? null,
        adminNote: parsed.data.adminNote ?? null,
        role: "visitor",
      },
      select: {
        id: true,
        nickname: true,
        role: true,
      },
    });

    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/members error:", error);
    return NextResponse.json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: String(error) },
    }, { status: 500 });
  }
}
