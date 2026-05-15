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
      if (!user?.id) return;
      await prisma.user.update({
        where: { id: user.id },
        data: { nickname: user.name || "名無し" },
      });
    },
    // NextAuth v4 + @auth/prisma-adapter v2 では user.id が DB の CUID と一致しないことがあるため、
    // adapter が作成する Account 行を経由して DB ユーザーを引く。
    async signIn({ user, account, profile }) {
      if (account?.provider !== "line" || !profile) return;
      const lineProfile = profile as { sub: string; name?: string; picture?: string };
      try {
        let dbUser = null;
        if (user?.id) {
          dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        }
        if (!dbUser) {
          const accountRow = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: "line",
                providerAccountId: account.providerAccountId,
              },
            },
            include: { user: true },
          });
          dbUser = accountRow?.user ?? null;
        }
        if (!dbUser) {
          console.warn(
            `[events.signIn] No DB user found; userId=${user?.id} providerAccountId=${account.providerAccountId}`
          );
          return;
        }
        await prisma.user.update({
          where: { id: dbUser.id },
          data: {
            lineId: lineProfile.sub,
            nickname:
              dbUser.nickname === "名無し"
                ? (lineProfile.name ?? dbUser.nickname)
                : dbUser.nickname,
            profileImageUrl: lineProfile.picture ?? dbUser.profileImageUrl ?? null,
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
