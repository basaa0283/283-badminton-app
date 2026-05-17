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
    async session({ session, token }) {
      // JWT戦略の場合はtoken.subを使用
      if (!token?.sub) return session;
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
        });
        if (!dbUser) {
          // JWT が指すユーザーがDBに存在しない (例: 削除された、別環境のCookieが残っている)。
          // session.user に id を入れないことで、保護されたページが unauthenticated 相当として扱える。
          // クライアントはこの状態を検知して signOut → 再ログインに導くこと。
          return session;
        }
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
      } catch (error) {
        // DB一時障害等。null系で fallthrough して session を返す。
        console.error("[session] DB lookup failed:", error);
      }
      return session;
    },
    async jwt({ token, user, account, profile }) {
      // 初回ログイン時、userオブジェクトが渡される
      if (user) {
        let userId = user.id;
        // OAuth の user.id は profile.id (= LINE User ID 等) で DB の CUID と一致しないことがある。
        // Account 行から DB の userId を引いて token に入れる。
        if (account?.provider && account?.providerAccountId) {
          const accountRow = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId,
              },
            },
          });
          if (accountRow?.userId) {
            userId = accountRow.userId;
          }
        }
        token.sub = userId;
        token.id = userId;

        // LINE 情報同期: events.signIn では fire しないケースがあるため、jwt 内でも実施。
        if (account?.provider === "line" && profile) {
          const lineProfile = profile as { sub: string; name?: string; picture?: string };
          try {
            const existing = await prisma.user.findUnique({ where: { id: userId } });
            if (existing) {
              await prisma.user.update({
                where: { id: userId },
                data: {
                  lineId: lineProfile.sub,
                  nickname:
                    existing.nickname === "名無し"
                      ? (lineProfile.name ?? existing.nickname)
                      : existing.nickname,
                  profileImageUrl: lineProfile.picture ?? existing.profileImageUrl ?? null,
                },
              });
            }
          } catch (error) {
            console.error("[jwt] Failed to sync LINE info:", error);
          }
        }
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
