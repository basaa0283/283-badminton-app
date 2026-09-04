import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { logActivity } from "./activity-log";

const isDevelopment = process.env.NODE_ENV === "development";

// HTTPS 環境かどうか (PROD / DEV は Azure で HTTPS、ローカルは HTTP)。
// LINE WebView 経由のログインで OAuth コールバック先のブラウザコンテキストが
// 切り替わる際、SameSite=Lax の cookie が引き継がれずに session が確立されない
// ことがあるため、HTTPS 環境では SameSite=None; Secure に切り替えてクロス
// コンテキスト送信を許可する。
const useSecureCookies = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
const cookiePrefix = useSecureCookies ? "__Secure-" : "";
const oauthSameSite = useSecureCookies ? "none" : "lax";

// マルチテナント P3: テナント自前の LINE Login チャネルを注入できるファクトリ。
// 引数なし (= 28ばど / グローバルページ) は従来どおり env のチャネルを使う。
// /api/auth/[...nextauth] だけが動的に呼び、他の getServerSession(authOptions) は
// 静的な authOptions のまま (JWT 検証は secret のみ使うため provider 設定は無関係)。
export interface TenantLineChannel {
  channelId: string;
  channelSecret: string;
}

export function makeAuthOptions(lineChannel?: TenantLineChannel): NextAuthOptions {
  return {
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
      clientId: lineChannel?.channelId ?? process.env.LINE_CHANNEL_ID!,
      clientSecret: lineChannel?.channelSecret ?? process.env.LINE_CHANNEL_SECRET!,
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
      // マルチテナント P3: 新規ユーザーは現在テナントの Membership (pending) を作る。
      // 失敗してもログインは止めない (session 側のフォールバックで動作は継続する)。
      try {
        const { getCurrentTenantId } = await import("./tenant");
        const tenantId = await getCurrentTenantId();
        await prisma.membership.upsert({
          where: { userId_tenantId: { userId: user.id, tenantId } },
          update: {},
          create: {
            userId: user.id,
            tenantId,
            role: "pending",
            nickname: user.name || "名無し",
          },
        });
      } catch (err) {
        console.error("[events.createUser] membership create failed:", err);
      }
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
        // ログイン記録 (利用状況分析・監査用)
        void logActivity({
          userId: dbUser.id,
          action: "auth.login",
          entityType: "User",
          entityId: dbUser.id,
          metadata: { provider: "line" },
        });
        // signup.bonus: 全ユーザーが 1 回だけ +10 pt をもらえる
        // (PointTransaction.reason = "signup.bonus" が既にあればスキップ)
        try {
          const existing = await prisma.pointTransaction.findFirst({
            where: { userId: dbUser.id, reason: "signup.bonus" },
            select: { id: true },
          });
          if (!existing) {
            const { addPoints } = await import("./points");
            await addPoints(dbUser.id, 10, "signup.bonus", {
              type: "User",
              id: dbUser.id,
            });
          }
        } catch (err) {
          // ボーナス失敗でログインを止めない
          console.error("[events.signIn] signup.bonus failed:", err);
        }
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

        // 「最終操作」を更新。session callback は (a) ページレンダリング時、
        // (b) クライアントが /api/auth/session を叩いたとき、(c) update() 呼び出し時
        // に走るので、ユーザーが実際にアプリを開いているタイミングを概ね拾える。
        // 5分以内に既に更新済みなら何もしない (DB書き込みのスロットル)。
        const FIVE_MIN_MS = 5 * 60 * 1000;
        const now = Date.now();
        const last = dbUser.lastActiveAt?.getTime() ?? 0;
        if (now - last > FIVE_MIN_MS) {
          try {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: { lastActiveAt: new Date(now) },
            });
          } catch (touchErr) {
            console.error("[session] lastActiveAt touch failed:", touchErr);
          }
        }

        // マルチテナント P3: role は現在テナントの Membership から解決する。
        // - Membership あり → その role (テナントごとの顔)
        // - Membership なし + デフォルトテナント (28bad) → User.role にフォールバック
        //   (PROD の Membership 移行前でも 28ばど ユーザーを締め出さない安全弁)
        // - Membership なし + 他テナント → pending (未所属 = 承認待ち扱い、権限を漏らさない)
        let effectiveRole = dbUser.role;
        try {
          const { getCurrentTenantId, getDefaultTenantId } = await import("./tenant");
          const tenantId = await getCurrentTenantId();
          const membership = await prisma.membership.findUnique({
            where: { userId_tenantId: { userId: dbUser.id, tenantId } },
            select: { role: true },
          });
          if (membership) {
            effectiveRole = membership.role;
          } else if (tenantId !== (await getDefaultTenantId())) {
            effectiveRole = "pending";
          }
        } catch (roleErr) {
          // 解決失敗時は User.role のまま (可用性優先)
          console.error("[session] membership role lookup failed:", roleErr);
        }

        session.user = {
          ...session.user,
          id: dbUser.id,
          lineId: dbUser.lineId,
          nickname: dbUser.nickname,
          role: effectiveRole,
          isPlatformAdmin: dbUser.isPlatformAdmin,
          termsAcceptedVersion: dbUser.termsAcceptedVersion,
        } as typeof session.user & {
          id: string;
          lineId: string | null;
          nickname: string;
          role: string;
          isPlatformAdmin: boolean;
          termsAcceptedVersion: string | null;
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
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    callbackUrl: {
      name: `${cookiePrefix}next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: oauthSameSite,
        path: "/",
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      // __Host- prefix は path=/; secure; domain属性なし が必須。NextAuth v4 が
      // 期待するデフォルトの形に合わせる。
      name: `${useSecureCookies ? "__Host-" : ""}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    pkceCodeVerifier: {
      name: `${cookiePrefix}next-auth.pkce.code_verifier`,
      options: {
        httpOnly: true,
        sameSite: oauthSameSite,
        path: "/",
        secure: useSecureCookies,
        maxAge: 60 * 15,
      },
    },
    state: {
      name: `${cookiePrefix}next-auth.state`,
      options: {
        httpOnly: true,
        sameSite: oauthSameSite,
        path: "/",
        secure: useSecureCookies,
        maxAge: 60 * 15,
      },
    },
    nonce: {
      name: `${cookiePrefix}next-auth.nonce`,
      options: {
        httpOnly: true,
        sameSite: oauthSameSite,
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  };
}

// 既存コード互換の静的オプション (env の LINE チャネル = 28ばど)。
// getServerSession はこれを使い続けてよい (セッション検証に provider 設定は不要)。
export const authOptions: NextAuthOptions = makeAuthOptions();
