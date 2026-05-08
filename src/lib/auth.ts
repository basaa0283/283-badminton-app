import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";

const isDevelopment = process.env.NODE_ENV === "development";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    // 開発環境のみ: テストユーザーでログイン
    ...(isDevelopment
      ? [
          CredentialsProvider({
            id: "dev-login",
            name: "開発用ログイン",
            credentials: {
              userId: { label: "User ID", type: "text" },
            },
            async authorize(credentials) {
              if (!credentials?.userId) return null;

              const user = await prisma.user.findUnique({
                where: { id: credentials.userId },
              });

              if (!user) return null;

              return {
                id: user.id,
                name: user.nickname,
                email: user.email,
                image: user.profileImageUrl,
              };
            },
          }),
        ]
      : []),
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
          email: profile.email || `${profile.sub}@line.local`,
          image: profile.picture,
        };
      },
    },
  ],
  events: {
    async createUser({ user }) {
      await prisma.user.update({
        where: { id: user.id },
        data: { nickname: user.name || "名無し" },
      });
    },
    // adapter 操作完了後に走るため、user.id は DB上の CUID。
    // signIn callback の user.id は profile.id (= LINE User ID) で DB の id と一致しないため、
    // ここで lineId / 画像 / nickname の同期をする。
    async signIn({ user, account, profile }) {
      if (account?.provider !== "line" || !profile || !user?.id) return;
      const lineProfile = profile as { sub: string; name?: string; picture?: string };
      try {
        const existing = await prisma.user.findUnique({ where: { id: user.id } });
        if (!existing) {
          console.warn(`[events.signIn] User not found by id=${user.id}; skipping LINE info update`);
          return;
        }
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lineId: lineProfile.sub,
            nickname:
              existing.nickname === "名無し"
                ? (lineProfile.name ?? existing.nickname)
                : existing.nickname,
            profileImageUrl: lineProfile.picture ?? existing.profileImageUrl ?? null,
          },
        });
      } catch (error) {
        // ログインは止めない。次回ログイン時に再試行されるので致命的ではない。
        console.error("[events.signIn] Failed to update LINE info:", error);
      }
    },
  },
  callbacks: {
    async signIn() {
      // LINE 情報の同期は events.signIn で行う（user.id が DB の id と一致するため）
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
    async jwt({ token, user }) {
      // 初回ログイン時、userオブジェクトが渡される
      if (user) {
        token.sub = user.id;
        token.id = user.id;
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
