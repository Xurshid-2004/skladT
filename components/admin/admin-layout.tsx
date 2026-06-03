"use client";

import { useState, useEffect } from 'react';
import {
  LayoutDashboard, FileText,
  AlertTriangle, Users, UserCog, Menu, X,
  LogOut, ChevronLeft, ChevronRight, Bell, Home
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getSession, clearSession } from '@/lib/utils/session';
import { Session } from '@/lib/types';

interface AdminLayoutProps {
  children: React.ReactNode;
  hideHeader?: boolean;
}

type MenuColor = {
  bg: string;
  bgHover: string;
  grad: string;
  glow: string;
};

type MenuItem = {
  title?: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  href?: string;
  roles: string[];
  type?: 'divider' | 'logout';
  color?: MenuColor;
};

export default function AdminLayout({ children, hideHeader = false }: AdminLayoutProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const normalizePath = (p: string) =>
    p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
  const currentPath = normalizePath(pathname ?? '');

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== 'admin') {
      router.push('/login');
    } else {
      setSession(s);
    }
  }, [router]);

  if (!session) return null;

  const menuItems: MenuItem[] = [
    {
      title: 'Statistics',
      icon: LayoutDashboard,
      href: '/admin',
      roles: ['admin'],
      color: { bg: 'bg-blue-500', bgHover: 'hover:bg-blue-600', grad: 'from-blue-600 to-indigo-600', glow: 'shadow-blue-600/50' },
    },
    {
      title: 'Hisobotlar',
      icon: FileText,
      href: '/admin/hisobotlar/',
      roles: ['admin'],
      color: { bg: 'bg-green-500', bgHover: 'hover:bg-green-600', grad: 'from-green-600 to-emerald-600', glow: 'shadow-green-600/50' },
    },
    {
      title: "Xodim qo'shish",
      icon: Users,
      href: '/admin/blocked',
      roles: ['admin'],
      color: { bg: 'bg-blue-600', bgHover: 'hover:bg-blue-700', grad: 'from-blue-600 to-indigo-700', glow: 'shadow-blue-600/50' },
    },
    {
      title: 'Operator',
      icon: UserCog,
      href: '/admin/operator',
      roles: ['admin'],
      color: { bg: 'bg-sky-500', bgHover: 'hover:bg-sky-600', grad: 'from-sky-600 to-cyan-600', glow: 'shadow-sky-600/50' },
    },
    {
      title: 'Limitdan oshganlar',
      icon: AlertTriangle,
      href: '/admin/overlimit',
      roles: ['admin'],
      color: { bg: 'bg-red-500', bgHover: 'hover:bg-red-600', grad: 'from-red-600 to-rose-600', glow: 'shadow-red-600/50' },
    },
    {
      type: 'logout',
      title: 'Chiqish',
      icon: LogOut,
      roles: ['admin'],
      color: { bg: 'bg-yellow-500', bgHover: 'hover:bg-yellow-600', grad: 'from-yellow-500 to-amber-600', glow: 'shadow-yellow-500/50' },
    },
  ];

  const handleLogout = () => {
    clearSession();
    router.push('/login');
  };

  const linkBase =
    'group relative flex h-full min-h-0 w-full flex-1 items-center gap-3 overflow-hidden rounded-2xl border-2 border-white/10 px-4 text-sm font-black uppercase tracking-wide text-white shadow-md drop-shadow-sm transition-all duration-200 ease-out select-none hover:brightness-110';

  const SidebarLink = ({
    item,
    onClick,
    collapsed,
  }: {
    item: MenuItem;
    onClick?: () => void;
    collapsed?: boolean;
  }) => {
    if (item.type === 'divider') return null;

    const c = item.color!;
    const Icon = item.icon!;
    const stateClass = (active: boolean) =>
      active
        ? `bg-gradient-to-r ${c.grad} shadow-xl ${c.glow} ring-2 ring-white/60 brightness-110`
        : `${c.bg} ${c.bgHover}`;

    if (item.type === 'logout') {
      return (
        <button
          type="button"
          onClick={handleLogout}
          title={collapsed ? item.title : undefined}
          className={[linkBase, stateClass(false), collapsed ? 'justify-center px-3' : ''].join(' ')}
        >
          <Icon className="h-5 w-5 shrink-0 text-white" />
          {!collapsed && <span className="truncate leading-snug">{item.title}</span>}
        </button>
      );
    }

    const active = currentPath === normalizePath(item.href!);

    return (
      <Link
        href={item.href!}
        onClick={onClick}
        title={collapsed ? item.title : undefined}
        className={[linkBase, stateClass(active), collapsed ? 'justify-center px-3' : ''].join(' ')}
      >
        <Icon className="h-5 w-5 shrink-0 text-white" />

        {!collapsed && <span className="truncate leading-snug">{item.title}</span>}

        {active && !collapsed && (
          <span
            className="absolute right-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white ring-2 ring-white/70"
            aria-hidden
          />
        )}

        {active && (
          <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-white/20 to-transparent" />
        )}
      </Link>
    );
  };

  const SidebarContent = ({ collapsed, onLinkClick }: { collapsed?: boolean; onLinkClick?: () => void }) => (
    <nav className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden px-3 py-2.5">
      {menuItems
        .filter(item => item.roles.includes(session.role))
        .map((item, idx) =>
          item.type === 'divider' ? (
            <div
              key={idx}
              className="mx-2 h-px shrink-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            />
          ) : (
            <div key={item.href ?? `${item.type}-${idx}`} className="flex min-h-0 flex-1 flex-col">
              <SidebarLink item={item} onClick={onLinkClick} collapsed={collapsed} />
            </div>
          )
        )}
    </nav>
  );

  return (
    <div className="admin-shell relative flex min-h-screen w-full items-start text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-48 -left-32 h-[28rem] w-[28rem] rounded-full bg-blue-500/18 blur-[90px] dark:bg-blue-600/10" />
        <div className="absolute top-20 right-12 h-[32rem] w-[32rem] rounded-full bg-violet-500/14 blur-[100px] dark:bg-violet-600/9" />
        <div className="absolute -bottom-48 left-1/3 h-[30rem] w-[30rem] rounded-full bg-fuchsia-400/12 blur-[90px] dark:bg-fuchsia-500/7" />
      </div>

      <aside
        className={[
          'sticky top-0 z-20 hidden h-screen min-h-screen shrink-0 flex-col md:flex',
          'border-r border-white/10',
          'bg-black',
          'shadow-[1px_0_0_0_rgba(255,255,255,0.06),8px_0_32px_rgba(0,0,0,0.45)]',
          'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          isSidebarOpen ? 'w-[17.5rem]' : 'w-[4.75rem]',
        ].join(' ')}
      >
        <div className={['flex h-16 shrink-0 items-center border-b border-white/10 px-4 gap-3', isSidebarOpen ? 'justify-between' : 'justify-center'].join(' ')}>
          {isSidebarOpen && (
            <div className="flex items-center gap-3 min-w-0">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br from-blue-500 via-violet-500 to-fuchsia-500 text-white text-xs font-black shadow-lg shadow-violet-500/30">
                UT
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-black tracking-tighter text-white">ADMIN PANEL</p>
                <p className="truncate text-[9px] font-bold tracking-[0.18em] text-slate-400 uppercase">Yoqilg'i ta'minot</p>
              </div>
            </div>
          )}

          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border-2 border-slate-200 bg-white/80 text-slate-400 shadow-sm transition-all hover:bg-primary/10 hover:border-primary/40 hover:text-primary dark:border-white/15 dark:bg-white/6 dark:hover:bg-white/12"
            aria-label="Sidebar toggle"
          >
            {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>

        <SidebarContent collapsed={!isSidebarOpen} />

      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {!hideHeader && (
          <header className={[
            'flex h-16 flex-shrink-0 items-center justify-between gap-4 px-4 sm:px-6',
            'border-b border-white/60 dark:border-white/8',
            'bg-white/80 dark:bg-slate-950/76',
            'shadow-[0_1px_0_rgba(255,255,255,0.6),0_4px_16px_rgba(15,23,42,0.05)]',
            'backdrop-blur-2xl z-10',
          ].join(' ')}>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden grid h-9 w-9 place-items-center rounded-xl border-2 border-slate-200 bg-white/80 text-slate-500 shadow-sm hover:bg-primary/10 hover:border-primary/40 hover:text-primary dark:border-white/15 dark:bg-white/6"
              >
                <Menu className="h-4.5 w-4.5" style={{ width: '1.1rem', height: '1.1rem' }} />
              </button>

              <div className="min-w-0">
                <p className="text-[9.5px] font-black uppercase tracking-[0.22em] text-slate-400 leading-none">Xush kelibsiz</p>
                <p className="mt-0.5 whitespace-normal break-words font-black tracking-tight text-slate-900 dark:text-white leading-tight">{session.displayName}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/admin"
                className="flex items-center gap-2 rounded-[13px] bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-violet-500/22 transition-all hover:scale-[1.03] hover:shadow-violet-500/32"
              >
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Bosh sahifa</span>
              </Link>

              <button className="relative grid h-9 w-9 place-items-center rounded-xl border-2 border-slate-200 bg-white/80 text-slate-400 shadow-sm transition-all hover:bg-amber-50 hover:border-amber-300 hover:text-amber-500 dark:border-white/15 dark:bg-white/6">
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-400 ring-1 ring-white dark:ring-slate-950" />
              </button>

              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-[13px] font-black text-white shadow-lg shadow-orange-500/22">
                {session.displayName.charAt(0)}
              </div>
            </div>
          </header>
        )}

        <main className="admin-content w-full p-4 pb-16 sm:p-6 sm:pb-20 md:p-8 md:pb-24">
          {children}
        </main>
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[300] md:hidden">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[17rem] flex-col bg-black shadow-2xl animate-in slide-in-from-left duration-250">
            <div className="flex h-[72px] items-center justify-between border-b border-white/10 px-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-[12px] bg-gradient-to-br from-blue-500 via-violet-500 to-fuchsia-500 text-[11px] font-black text-white shadow-lg shadow-violet-500/28">UT</div>
                <p className="text-[11px] font-black tracking-tighter text-white">ADMIN PANEL</p>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-xl border-2 border-slate-200 bg-white/80 text-slate-400 dark:border-white/15 dark:bg-white/6"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <SidebarContent onLinkClick={() => setIsMobileMenuOpen(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}
