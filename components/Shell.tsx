"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import { nav, more, SITE_NAME } from "@/lib/data";

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const cls = (href: string) =>
    "navlink" + ((href === "/" ? path === "/" : path.startsWith(href)) ? " on" : "");

  return (
    <>
      <header className="top">
        <Link href="/" className="brand">{SITE_NAME}</Link>
        <label className="search">
          <Icon name="search" size={18} />
          <input type="search" placeholder="ابحث عن مسلسل أو حلقة" aria-label="بحث" />
        </label>
        <Link href="/login" className="login">تسجيل الدخول</Link>
      </header>

      <aside className="side" aria-label="القائمة الرئيسية">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className={cls(n.href)}>
            <Icon name={n.icon} /> {n.label}
          </Link>
        ))}
        <hr />
        {more.map((n) => (
          <Link key={n.href} href={n.href} className={cls(n.href)}>
            <Icon name={n.icon} /> {n.label}
          </Link>
        ))}
      </aside>

      <main className="main" id="main">{children}</main>

      <nav className="bottom" aria-label="التنقل السريع">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className={cls(n.href)}>
            <Icon name={n.icon} size={24} />
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
