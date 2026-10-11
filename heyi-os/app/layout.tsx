import type { Metadata } from "next";
import "./globals.css";
import "./collaboration.css";
import "./graph.css";
import "./cases.css";
import "./workflow.css";
import "./rehearsal.css";

export const metadata: Metadata = {
  title: "和议书 · HeYi OS",
  description: "面向跨文化协作的 AI 项目治理工作台",
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
