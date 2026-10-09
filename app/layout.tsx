import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "日笺 · 每日计划",
  description: "写下今天的待办，回看每一天的计划。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
