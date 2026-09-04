import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      lineId: string | null;
      nickname: string;
      role: string;
      // プラットフォーム全体の管理者 (マルチテナント)。テナント内 role とは独立
      isPlatformAdmin: boolean;
      termsAcceptedVersion: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
