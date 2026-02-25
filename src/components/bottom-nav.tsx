"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Pixel art style SVG icons for navigation
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
      <path strokeLinecap="square" strokeLinejoin="miter" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" />
    </svg>
  );
}

function CreateIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="square" d="M12 5v14M5 12h14" />
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5} />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="square" d="M12 7v5l3 3" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="3" />
      <path strokeLinecap="square" d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  );
}

const LINKS = [
  { href: "/", label: "首页", key: "home" as const, Icon: HomeIcon },
  { href: "/create", label: "创作", key: "create" as const, Icon: CreateIcon },
  { href: "/history", label: "历史", key: "history" as const, Icon: HistoryIcon },
  { href: "/settings", label: "设置", key: "settings" as const, Icon: SettingsIcon },
];

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      {/* Blur backdrop */}
      <div className="absolute inset-0 bg-white/90 backdrop-blur-md border-t-2 border-border-dim/30" />

      {/* Navigation items */}
      <div className="relative flex items-center justify-around px-2 py-2">
        {LINKS.map((link) => {
          const active = isActive(link.href);
          const { Icon } = link;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 transition-all duration-150 ${
                active
                  ? "text-primary-color"
                  : "text-text-muted hover:text-text-primary"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon active={active} />
              <span className="text-[10px] font-medium">{link.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Safe area indicator */}
      <div className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-border-dim/20" />
    </nav>
  );
}
