"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["/", "Góp ý"],
  ["/stats", "Thống kê"],
  ["/saves", "Tra cứu bản lưu"],
  ["/announcement", "Thông báo"],
] as const;

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl border border-[#e6d6c3] bg-white p-1">
      {TABS.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${path === href ? "bg-caramel text-white" : "text-bean hover:bg-cream"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
