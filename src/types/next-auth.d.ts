import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      lineId: string | null;
      nickname: string;
      role: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
