import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "公众号草稿助手",
  description: "在对话中创建、修改与查询微信公众号草稿。",
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
