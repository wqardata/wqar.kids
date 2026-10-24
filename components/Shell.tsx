"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { useAuth } from "@/lib/auth";
import type { NavItem } from "@/lib/data";
import BrandMark from "./BrandMark";
import Avatar from "./Avatar";
import { brandStyle, resolveNav, useSettings } from "@/lib/settings";
import { applyColorMode, readColorMode, type ColorMode } from "@/lib/colorMode";

const MODES: { id: ColorMode; label: string }[] = [
  { id: "auto", label: "تلقائي" },
  { id: "light", label: "فاتح" },
  { id: "dark", label: "داكن" },
];

const SIDE_KEY = "side";

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

function NavLinks({ items, path, size }: { items: readonly NavItem[]; path: string; size?: number }) {
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
            <span>{n.label}</span>
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
  // القائمة الجانبية على الشاشات الكبيرة: موسّعة أو مطويّة إلى أيقونات (تُحفظ في المتصفح).
  const [mini, setMini] = useState(false);
  // نافذة الشخص: تسجيل جديد / دخول، وعلى الجوال تحوي أيضًا القسم الثاني من القائمة.
  const [menuOpen, setMenuOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  // الأسماء والأيقونات المخصّصة من لوحة التحكم تتغلّب على الافتراضية.
  const custom = (items: readonly NavItem[]): NavItem[] => items.map((n) => ({ ...n, ...settings.navItems[n.href] }));
  // العناصر التي أخفاها المشرف من لوحة التحكم لا تظهر في القائمة الجانبية ولا في الشريط السفلي.
  const visible = (items: NavItem[]) => items.filter((n) => !settings.navHidden.includes(n.href));
  const layout = resolveNav(settings.navLayout);
  const navItems = visible(custom(layout.main));
  const moreItems = visible(custom(layout.more));
  const [mode, setMode] = useState<ColorMode>("auto");

  useEffect(() => {
    setMini(document.documentElement.dataset.side === "mini");
    setMode(readColorMode());
  }, []);

  function toggleSide() {
    const next = !mini;
    setMini(next);
    document.documentElement.dataset.side = next ? "mini" : "open";
    try {
      localStorage.setItem(SIDE_KEY, next ? "mini" : "open");
    } catch {
      /* التخزين غير متاح: يبقى التغيير للجلسة فقط */
    }
  }

  function chooseMode(m: ColorMode) {
    setMode(m);
    applyColorMode(m, settings.theme);
  }

  function openMenu() {
    opener.current = document.activeElement as HTMLElement | null;
    setMenuOpen(true);
  }
  function closeMenu() {
    setMenuOpen(false);
    opener.current?.focus?.();
  }

  // تغيّر الصفحة يغلق النافذة.
  useEffect(() => {
    setMenuOpen(false);
  }, [path]);

  // عند الفتح: التركيز على أول عنصر، والإغلاق بزر Escape.
  useEffect(() => {
    if (!menuOpen) return;
    dialogRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        opener.current?.focus?.();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <>
      <header className="top">
        <button
          type="button"
          className="side-toggle"
          aria-label={mini ? "توسيع القائمة الجانبية" : "طيّ القائمة الجانبية"}
          aria-expanded={!mini}
          aria-controls="side-nav"
          title={mini ? "توسيع القائمة" : "طيّ القائمة"}
          onClick={toggleSide}
        >
          <Icon name="menu" size={22} />
        </button>
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
            {/* نافذة فيها حسابي ولون العرض (والقسم الثاني من القائمة على الجوال). */}
            <button type="button" className="logout acct-m" aria-label="الحساب والمزيد" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={openMenu}>
              <Avatar id={profile?.avatar} size={36} />
            </button>
          </>
        ) : (
          <button type="button" className="login login--icon" aria-label="تسجيل الدخول" aria-haspopup="dialog" aria-expanded={menuOpen} title="تسجيل الدخول" onClick={openMenu}>
            <Icon name="user" size={20} />
          </button>
        )}
      </header>

      {menuOpen && (
        <div className="acct-layer">
          <div className="acct-backdrop" onClick={closeMenu} />
          <div
            className="acct-menu"
            role="dialog"
            aria-modal="true"
            aria-label={user ? "الحساب والمزيد" : "تسجيل الدخول"}
            ref={dialogRef}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setMenuOpen(false);
            }}
          >
            <button type="button" className="acct-close" aria-label="إغلاق" onClick={closeMenu}>
              <Icon name="close" size={20} />
            </button>
            {user ? (
              <div className="acct-actions">
                <Link href="/account" className="acct-btn acct-btn--primary">حسابي</Link>
                {canAdd && <Link href="/admin" className="acct-btn">لوحة التحكم</Link>}
              </div>
            ) : (
              <>
                <p className="acct-title">أهلًا بك</p>
                <div className="acct-actions">
                  <Link href="/login?mode=signup" className="acct-btn acct-btn--primary">تسجيل جديد</Link>
                  <Link href="/login?mode=signin" className="acct-btn">تسجيل دخول</Link>
                </div>
              </>
            )}
            <div className="acct-mode" role="radiogroup" aria-label="لون العرض">
              <span>لون العرض</span>
              <div className="seg">
                {MODES.map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} onClick={() => chooseMode(m.id)}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {moreItems.length > 0 && (
              <div className="acct-more">
                <hr />
                <NavLinks items={moreItems} path={path} />
              </div>
            )}
          </div>
        </div>
      )}

      <nav className="side" id="side-nav" aria-label="القائمة الرئيسية">
        <NavLinks items={navItems} path={path} />
        {moreItems.length > 0 && (
          <div className="side-more">
            {navItems.length > 0 && <hr />}
            <NavLinks items={moreItems} path={path} />
          </div>
        )}
      </nav>

      <main className="main" id="main" tabIndex={-1}>{children}</main>

      <nav className="bottom" aria-label="التنقل السريع" style={{ gridTemplateColumns: `repeat(${Math.max(1, navItems.length)}, 1fr)` }}>
        <NavLinks items={navItems} path={path} size={24} />
      </nav>
    </>
  );
}
