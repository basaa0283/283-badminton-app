import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    {
      id: "line",
      name: "LINE",
      type: "oauth",
      wellKnown: "https://access.line.me/.well-known/openid-configuration",
      authorization: { params: { scope: "profile openid" } },
      idToken: true,
      checks: ["state"],
      clientId: process.env.LINE_CHANNEL_ID!,
      clientSecret: process.env.LINE_CHANNEL_SECRET!,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    },
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "line" && profile) {
        const lineProfile = profile as { sub: string; name: string; picture?: string };

        // 既存ユーザーを検索
        const existingUser = await prisma.user.findUnique({
          where: { lineId: lineProfile.sub },
        });

        if (!existingUser) {
          // 新規ユーザーの場合、ゲストとして作成
          await prisma.user.create({
            data: {
              lineId: lineProfile.sub,
              nickname: lineProfile.name,
              profileImageUrl: lineProfile.picture,
              role: "guest",
            },
          });
        } else {
          // 既存ユーザーの場合、プロフィール画像を更新
          await prisma.user.update({
            where: { lineId: lineProfile.sub },
            data: {
              profileImageUrl: lineProfile.picture,
            },
          });
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (token?.sub) {
        const user = await prisma.user.findUnique({
          where: { lineId: token.sub },
        });
        if (user) {
          session.user = {
            ...session.user,
            id: user.id,
            lineId: user.lineId,
            nickname: user.nickname,
            role: user.role,
          } as typeof session.user & {
            id: string;
            lineId: string | null;
            nickname: string;
            role: string;
          };
        }
      }
      return session;
    },
    async jwt({ token, profile }) {
      if (profile) {
        token.sub = (profile as { sub: string }).sub;
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
};
