"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import { useAuth } from "@/lib/auth";
import { nav, more, type NavItem } from "@/lib/data";
import BrandMark from "./BrandMark";
import Avatar from "./Avatar";
import { brandStyle, useSettings } from "@/lib/settings";

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
  const { user, canAdd, profile } = useAuth();
  const { settings } = useSettings();
  // الأسماء والأيقونات المخصّصة من لوحة التحكم تتغلّب على الافتراضية.
  const custom = (items: readonly NavItem[]): NavItem[] => items.map((n) => ({ ...n, ...settings.navItems[n.href] }));
  // العناصر التي أخفاها المشرف من لوحة التحكم لا تظهر في القائمة الجانبية ولا في الشريط السفلي.
  const visible = (items: NavItem[]) => items.filter((n) => !settings.navHidden.includes(n.href));
  const navItems = visible(custom(nav));
  const moreItems = visible(custom(more));

  return (
    <>
      <header className="top">
        <Link href="/" className="brand" aria-label={settings.siteName} style={brandStyle(settings)}>
          <BrandMark s={settings} />
        </Link>
        <form className="search" role="search" action="/search" method="get">
          <label htmlFor="site-q" className="search-ico"><Icon name="search" size={18} /></label>
          <input
            type="search"
            id="site-q"
            name="q"
            placeholder="ابحث عن مسلسل أو حلقة"
            aria-label="بحث"
            enterKeyHint="search"
            autoComplete="off"
          />
        </form>
        {user ? (
          <>
            {canAdd && (
              <Link href="/admin" className="logout" aria-label="لوحة التحكم" title="لوحة التحكم">
                <Icon name="gear" size={20} />
              </Link>
            )}
            <Link href="/account" className="logout" aria-label={`حسابي (${user.email ?? ""})`} title="حسابي">
              <Avatar id={profile?.avatar} size={36} />
            </Link>
          </>
        ) : (
          <Link href="/login" className="login login--icon" aria-label="تسجيل الدخول" title="تسجيل الدخول">
            <Icon name="user" size={20} />
          </Link>
        )}
      </header>

      <nav className="side" aria-label="القائمة الرئيسية">
        <NavLinks items={navItems} path={path} />
        {navItems.length > 0 && moreItems.length > 0 && <hr />}
        <NavLinks items={moreItems} path={path} />
      </nav>

      <main className="main" id="main" tabIndex={-1}>{children}</main>

      <nav className="bottom" aria-label="التنقل السريع" style={{ gridTemplateColumns: `repeat(${Math.max(1, navItems.length)}, 1fr)` }}>
        <NavLinks items={navItems} path={path} size={24} stacked />
      </nav>
    </>
  );
}
