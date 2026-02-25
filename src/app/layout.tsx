import type { Metadata } from "next";
import "./globals.css";
import { AppNav } from "@/components/app-nav";
import { BottomNav } from "@/components/bottom-nav";
import { ErrorBoundary } from "@/components/error-boundary";
import { PetRouterBridge } from "@/components/pet/pet-router-bridge";
import { PetWidget } from "@/components/pet/pet-widget";
import { PetProvider } from "@/lib/pet/pet-events";

export const metadata: Metadata = {
  title: "像素 GIF 工坊",
  description: "上传图片，选择动作，一键生成可爱像素动态表情包",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="pixel-root">
        <PetProvider>
          <PetRouterBridge />
          <div className="pixel-bg" />
          <div className="scanlines" />
          <div className="relative z-10 mx-auto min-h-screen w-full max-w-7xl px-4 pb-32 pt-4 md:px-8 md:pb-16 lg:pb-24 lg:pt-6">
            <div className="hidden lg:block">
              <AppNav />
            </div>
            <main className="lg:mt-6"><ErrorBoundary>{children}</ErrorBoundary></main>
          </div>
          <BottomNav />
          <PetWidget />
        </PetProvider>
      </body>
    </html>
  );
}
