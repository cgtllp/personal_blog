import type { Metadata } from "next";
import "./globals.css";

const favicon = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#20312f"/><path d="M16 17h32v3H16zm0 13h25v3H16zm0 13h19v3H16z" fill="#f6f5f0"/><circle cx="46" cy="45" r="5" fill="#d2623e"/></svg>')}`;

export const metadata: Metadata = {
  title: "日笺 · 每日计划",
  description: "写下今天的待办，回看每一天的计划。",
  icons: {
    icon: favicon,
    shortcut: favicon,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
