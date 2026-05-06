import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";

const isDevelopment = process.env.NODE_ENV === "development";

export const authOptions: NextAuthOptions = {
  useSecureCookies: false,
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
          email: profile.email,
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
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "line" && profile) {
        const lineProfile = profile as { sub: string; name: string; picture?: string };
        const existingUser = await prisma.user.findUnique({ where: { id: user.id } });
        await prisma.user.upsert({
          where: { id: user.id },
          create: {
            id: user.id,
            lineId: lineProfile.sub,
            nickname: lineProfile.name || "名無し",
          },
          update: {
            lineId: lineProfile.sub,
            nickname: existingUser?.nickname === "名無し" ? lineProfile.name : (existingUser?.nickname ?? lineProfile.name),
          },
        });
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
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: false,
      },
    },
    callbackUrl: {
      name: "next-auth.callback-url",
      options: {
        sameSite: "lax" as const,
        path: "/",
        secure: false,
      },
    },
    csrfToken: {
      name: "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: false,
      },
    },
    state: {
      name: "next-auth.state",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: false,
      },
    },
    pkceCodeVerifier: {
      name: "next-auth.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: false,
      },
    },
    nonce: {
      name: "next-auth.nonce",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: false,
      },
    },
  },
};
