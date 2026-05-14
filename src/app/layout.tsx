import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TestFlow v2",
  description: "한국형 테스트 관리 도구",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
