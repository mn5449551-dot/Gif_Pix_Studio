"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AssetImage } from "@/components/asset-image";

const LINKS = [
  { href: "/", label: "首页" },
  { href: "/create", label: "创作" },
  { href: "/history", label: "历史" },
  { href: "/settings", label: "设置" },
];

function resolvePageHint(pathname: string | null): string {
  if (pathname === "/create") return "创作流程：上传素材 -> 选择动作 -> 生成预览";
  if (pathname?.startsWith("/result/")) return "结果编辑：删帧、调速、导出 GIF";
  if (pathname === "/history") return "历史管理：筛选记录并快速复用参数";
  if (pathname === "/settings") return "配置中心：分开验证模型密钥与 LLM 密钥";
  return "上传图片，三步生成像素动态表情包";
}

export function AppNav() {
  const pathname = usePathname();
  const pageHint = resolvePageHint(pathname);

  return (
    <header className="mb-6 fade-in-up">
      <div className="cute-panel p-2.5 md:p-3" style={{ background: "var(--primary-light)" }}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
          <Link href="/" aria-label="像素GIF工坊首页" className="flex items-center gap-3">
            <AssetImage
              src="/assets/brand/logo-nav.png"
              alt="像素GIF工坊 Logo"
              className="h-14 w-14 object-contain pixelated md:h-16 md:w-16"
              fallbackClassName="asset-fallback-lg"
            />
            <div className="min-w-0">
              <p className="pixel-title text-[11px] leading-none md:text-xs">像素 GIF 工坊</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-text-muted">
                GIF PIXEL STUDIO
              </p>
              <div className="mt-1 hidden flex-wrap gap-1 md:flex">
                <span className="cyber-chip muted text-[10px]">16 帧</span>
                <span className="cyber-chip muted text-[10px]">透明 GIF</span>
                <span className="cyber-chip muted text-[10px]">本地历史</span>
              </div>
            </div>
          </Link>

          <div className="hidden lg:block">
            <p className="rounded-full border-2 border-border-dim bg-white px-4 py-2 text-xs text-text-muted shadow-pixel-sm">
              {pageHint}
            </p>
          </div>

          <nav className="flex flex-wrap justify-start gap-2 lg:justify-end">
            {LINKS.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/" && pathname?.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`arcade-button text-[10px] ${active ? "" : "secondary"}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <p className="mt-2 rounded-md border border-dashed border-border-dim/35 bg-white/70 px-2 py-1 text-[10px] text-text-muted lg:hidden">
          {pageHint}
        </p>

        <div className="mt-2 border-t-2 border-dashed border-border-dim/25" />
      </div>
    </header>
  );
}
