import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { version } from "../../package.json";

// 環境を区別するためのバージョン suffix（DEV/local向け）
function getEnvSuffix(): string {
  const url = process.env.NEXTAUTH_URL || "";
  if (url.startsWith("http://localhost")) return "+local";
  if (url.includes("dev-")) return "+dev";
  return "";
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "２８ばど 出欠管理",
  description: "バドミントンサークル「２８ばど」の出欠管理アプリ",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "２８ばど",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  themeColor: "#1d6dca",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <Providers>
          <div className="flex-1">{children}</div>
          <SiteFooter version={version} envSuffix={getEnvSuffix()} />
        </Providers>
      </body>
    </html>
  );
}
