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
      client: {
        id_token_signed_response_alg: "HS256",
      },
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
  events: {
    // ユーザー作成後にnicknameとlineIdを設定
    async createUser({ user }) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          nickname: user.name || "名無し",
          lineId: user.id, // LINE User ID (profile.sub)
        },
      });
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "line" && profile) {
        const lineProfile = profile as { sub: string; name: string; picture?: string };

        // 既存ユーザーのlineIdを更新（Account経由で紐づいていない場合）
        const existingUser = await prisma.user.findFirst({
          where: { id: user.id },
        });

        if (existingUser && !existingUser.lineId) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              lineId: lineProfile.sub,
              nickname: existingUser.nickname === "名無し" ? lineProfile.name : existingUser.nickname,
            },
          });
        }
      }
      return true;
    },
    async session({ session, token, user }) {
      // JWT戦略の場合はtoken.subを使用
      if (token?.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
        });
        if (dbUser) {
          session.user = {
            ...session.user,
            id: dbUser.id,
            lineId: dbUser.lineId,
            nickname: dbUser.nickname,
            role: dbUser.role,
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
    async jwt({ token, user, profile, account }) {
      // 初回ログイン時、userオブジェクトが渡される
      if (user) {
        token.sub = user.id;
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
