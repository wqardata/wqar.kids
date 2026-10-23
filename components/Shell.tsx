"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import { useAuth } from "@/lib/auth";
import { nav, more, type NavItem } from "@/lib/data";
import { useSettings } from "@/lib/settings";

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
  const { user, canAdd, signOut } = useAuth();
  const { settings } = useSettings();

  return (
    <>
      <header className="top">
        <Link href="/" className="brand" aria-label={settings.siteName}>
          {settings.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo} alt="" className="brand-logo" style={{ height: settings.logoHeight }} />
          )}
          {(!settings.logo || settings.showName) && <span>{settings.siteName}</span>}
        </Link>
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
        {user ? (
          <>
            {canAdd && <Link href="/admin" className="login">لوحة التحكم</Link>}
            <button type="button" className="logout" onClick={() => void signOut()} title="تسجيل الخروج" aria-label={`تسجيل الخروج (${user.email ?? ""})`}>
              {user.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
              ) : (
                <Icon name="user" size={20} />
              )}
            </button>
          </>
        ) : (
          <Link href="/login" className="login">تسجيل الدخول</Link>
        )}
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
