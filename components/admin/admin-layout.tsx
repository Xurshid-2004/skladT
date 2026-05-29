"use client"; 
 
import { useState, useEffect } from 'react'; 
import {
  LayoutDashboard, FileText, MessageSquare, ShieldCheck,
  AlertTriangle, Lock, Users, Factory, FormInput,
  Layers, Wallet, FileCode, History, Database, Menu, X,
  LogOut, Sun, Moon, ChevronLeft, ChevronRight, Bell, Home
} from 'lucide-react';
import Link from 'next/link'; 
import { usePathname, useRouter } from 'next/navigation';
import { getSession, clearSession } from '@/lib/utils/session';
import { Session } from '@/lib/types';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  /** trailingSlash: true — /admin/ va /admin ni bir xil hisoblash */
  const normalizePath = (p: string) =>
    p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
  const currentPath = normalizePath(pathname ?? "");

  useEffect(() => {
    const s = getSession();
    if (!s || (s.role !== 'admin' && s.role !== 'developer')) {
      router.push('/login');
    } else {
      setSession(s);
    }
  }, [router]);

  if (!session) return null;

  const isAdmin = session.role === 'admin' || session.role === 'developer';
  const isDeveloper = session.role === 'developer';

  const menuItems = [
    { title: "Dashboard", icon: LayoutDashboard, href: "/admin", roles: ['admin', 'developer'] },
    { title: "Hisobotlar", icon: FileText, href: "/admin/hisobotlar", roles: ['admin', 'developer'] },
    { title: "Chat & So'rovlar", icon: MessageSquare, href: "/admin/chat", roles: ['admin', 'developer'] },
    { title: "Ruxsatnomalar", icon: ShieldCheck, href: "/admin/ruxsatnomalar", roles: ['admin', 'developer'] },
    { title: "Limitdan oshganlar", icon: AlertTriangle, href: "/admin/overlimit", roles: ['admin', 'developer'] },
    { title: "Bloklanganlar", icon: Lock, href: "/admin/blocked", roles: ['admin', 'developer'] },
    
    // Developer only items
    { type: 'divider', roles: ['developer'] },
    { title: "Kodlar boshqaruvi", icon: Users, href: "/dasturchi/kodlar", roles: ['developer'] },
    { title: "Zapravkalar", icon: Factory, href: "/dasturchi/zapravkalar", roles: ['developer'] },
    { title: "So'rovnomalar", icon: FormInput, href: "/dasturchi/sorovnomalar", roles: ['developer'] },
    { title: "Variantlar", icon: Layers, href: "/dasturchi/variantlar", roles: ['developer'] },
    { title: "Limitlar", icon: Wallet, href: "/dasturchi/limitlar", roles: ['developer'] },
    { title: "Hujjat shabloni", icon: FileCode, href: "/dasturchi/shablon", roles: ['developer'] },
    { title: "Audit Log", icon: History, href: "/dasturchi/audit", roles: ['developer'] },
    { title: "Backup", icon: Database, href: "/dasturchi/backup", roles: ['developer'] },
  ];

  const handleLogout = () => {
    clearSession();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-muted flex">
      {/* Sidebar - Desktop */}
      <aside className={`hidden md:flex flex-col bg-background border-r-2 border-primary/10 shadow-sm transition-all duration-300 ${isSidebarOpen ? 'w-72' : 'w-20'}`}>
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-black">UT</div>
              <h1 className="font-black tracking-tighter text-primary">ADMIN PANEL</h1>
            </div>
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-primary/5 rounded-xl transition-colors">
            {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {menuItems.filter(item => item.roles.includes(session.role)).map((item, idx) => (
            item.type === 'divider' ? (
              <div key={idx} className="h-px bg-primary/5 my-4 mx-4" />
            ) : (
              <Link key={item.href} href={item.href!} className={`flex items-center gap-4 px-4 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${currentPath === normalizePath(item.href!) ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'}`}>
                {item.icon && <item.icon className="w-5 h-5" />}
                {isSidebarOpen && <span>{item.title}</span>}
              </Link>
            )
          ))}
        </nav>

        <div className="p-4 border-t-2 border-primary/5">
          <button onClick={handleLogout} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-danger hover:bg-danger/5 transition-all`}>
            <LogOut className="w-5 h-5" />
            {isSidebarOpen && <span>Chiqish</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-20 bg-background border-b-2 border-primary/10 px-6 flex items-center justify-between z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 hover:bg-primary/5 rounded-xl">
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase opacity-40 leading-none">Xush kelibsiz</span>
              <span className="font-black text-primary uppercase">{session.displayName}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/uzellar"
              className="flex items-center gap-2 px-4 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Bosh sahifa</span>
            </Link>
            <button className="p-3 bg-muted rounded-2xl hover:bg-primary/10 transition-colors border border-primary/10">
              <Bell className="w-5 h-5 text-primary" />
            </button>
            <div className="w-10 h-10 bg-accent rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-accent/20">
              {session.displayName.charAt(0)}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          {children}
        </main>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[200] md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-80 bg-background shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-black">UT</div>
                <h1 className="font-black tracking-tighter text-primary">ADMIN PANEL</h1>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 hover:bg-primary/5 rounded-xl">
                <X className="w-6 h-6" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              {menuItems.filter(item => item.roles.includes(session.role)).map((item, idx) => (
                item.type === 'divider' ? (
                  <div key={idx} className="h-px bg-primary/5 my-4 mx-4" />
                ) : (
                  <Link key={item.href} href={item.href!} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-4 px-4 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${currentPath === normalizePath(item.href!) ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'}`}>
                    {item.icon && <item.icon className="w-5 h-5" />}
                    <span>{item.title}</span>
                  </Link>
                )
              ))}
            </nav>
            <div className="p-6 border-t-2 border-primary/5">
              <button onClick={handleLogout} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-danger hover:bg-danger/5 transition-all">
                <LogOut className="w-5 h-5" />
                <span>Chiqish</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
