"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import { nav, more, SITE_NAME, type NavItem } from "@/lib/data";

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

function NavLinks({ items, path, size, stacked }: { items: readonly NavItem[]; path: string; size?: number; stacked?: boolean }) {
  return (
    <>
      {items.map((n) => {
        const on = isActive(path, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={on ? "navlink on" : "navlink"}
            aria-current={on ? "page" : undefined}
          >
            <Icon name={n.icon} size={size} />
            {stacked ? <span>{n.label}</span> : n.label}
          </Link>
        );
      })}
    </>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/";

  return (
    <>
      <header className="top">
        <Link href="/" className="brand">{SITE_NAME}</Link>
        <form className="search" role="search" action="/search" method="get">
          <Icon name="search" size={18} />
          <input
            type="search"
            name="q"
            placeholder="ابحث عن مسلسل أو حلقة"
            aria-label="بحث"
            enterKeyHint="search"
            autoComplete="off"
          />
        </form>
        <Link href="/login" className="login">تسجيل الدخول</Link>
      </header>

      <nav className="side" aria-label="القائمة الرئيسية">
        <NavLinks items={nav} path={path} />
        <hr />
        <NavLinks items={more} path={path} />
      </nav>

      <main className="main" id="main" tabIndex={-1}>{children}</main>

      <nav className="bottom" aria-label="التنقل السريع">
        <NavLinks items={nav} path={path} size={24} stacked />
      </nav>
    </>
  );
}
