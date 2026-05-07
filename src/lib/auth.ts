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
    // LIFF (LINE in-app browser) 内からのログイン: クライアントが取得した
    // ID Token を LINE API で verify してセッション発行する。
    // OAuth フロー（state cookie必要）が動かない iOS Safari の LINE 内ブラウザ
    // 対策として用意。
    CredentialsProvider({
      id: "liff",
      name: "LINE LIFF",
      credentials: {
        idToken: { label: "ID Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.idToken) return null;

        const channelId = process.env.LINE_CHANNEL_ID;
        if (!channelId) {
          console.error("[liff authorize] LINE_CHANNEL_ID not set");
          return null;
        }

        // LINE Verify API で ID Token を検証
        const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            id_token: credentials.idToken,
            client_id: channelId,
          }),
        });

        if (!verifyRes.ok) {
          const body = await verifyRes.text();
          console.error(`[liff authorize] verify failed (${verifyRes.status}): ${body}`);
          return null;
        }

        const claims = (await verifyRes.json()) as {
          sub: string;
          name?: string;
          picture?: string;
          email?: string;
        };

        const lineUserId = claims.sub;

        // Account 経由で既存 User を探す（OAuth ログイン済みの場合）
        const existingAccount = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: "line",
              providerAccountId: lineUserId,
            },
          },
          include: { user: true },
        });

        if (existingAccount) {
          // 既存ユーザー: LIFF 経由で取れた最新情報で更新
          const updated = await prisma.user.update({
            where: { id: existingAccount.userId },
            data: {
              lineId: lineUserId,
              nickname:
                existingAccount.user.nickname === "名無し"
                  ? claims.name ?? existingAccount.user.nickname
                  : existingAccount.user.nickname,
              profileImageUrl:
                claims.picture ?? existingAccount.user.profileImageUrl ?? null,
              image: claims.picture ?? existingAccount.user.image ?? null,
            },
          });
          return {
            id: updated.id,
            name: updated.nickname,
            email: updated.email,
            image: updated.profileImageUrl,
          };
        }

        // 新規ユーザー: User と Account を作成
        const newUser = await prisma.user.create({
          data: {
            lineId: lineUserId,
            nickname: claims.name || "名無し",
            email: claims.email || `${lineUserId}@line.local`,
            image: claims.picture ?? null,
            profileImageUrl: claims.picture ?? null,
            accounts: {
              create: {
                type: "oauth",
                provider: "line",
                providerAccountId: lineUserId,
              },
            },
          },
        });

        return {
          id: newUser.id,
          name: newUser.nickname,
          email: newUser.email,
          image: newUser.profileImageUrl,
        };
      },
    }),
  ],
  events: {
    async createUser({ user }) {
      await prisma.user.update({
        where: { id: user.id },
        data: { nickname: user.name || "名無し" },
      });
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "line" && profile) {
        const lineProfile = profile as { sub: string; name: string; picture?: string };
        try {
          const existingUser = await prisma.user.findUnique({ where: { id: user.id } });
          if (!existingUser) {
            // adapter.createUser/linkAccount が完了している前提なので通常ここには来ない
            console.warn(`[signIn] User not found by id=${user.id}; skipping LINE info update`);
            return true;
          }
          await prisma.user.update({
            where: { id: user.id },
            data: {
              lineId: lineProfile.sub,
              nickname: existingUser.nickname === "名無し" ? lineProfile.name : existingUser.nickname,
              profileImageUrl: lineProfile.picture ?? existingUser.profileImageUrl ?? null,
            },
          });
        } catch (error) {
          // 失敗してもログインは通す（lineId などは次回ログイン時に再試行）
          console.error("[signIn] Failed to update LINE info:", error);
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
