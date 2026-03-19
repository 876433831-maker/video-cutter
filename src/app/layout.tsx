import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "口播智能粗剪工具",
  description: "上传视频、生成字幕、逐字删片、导出成片"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
