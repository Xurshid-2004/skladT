"use client"; 
 
import AdminLayout from '@/components/admin/admin-layout'; 
import { useState, useEffect } from 'react'; 
import {  
  Activity, Users, ShieldAlert, History,  
  Terminal, Server, Database, Save, ArrowRight
} from 'lucide-react'; 
import { collection, query, orderBy, limit, onSnapshot, getCountFromServer } from 'firebase/firestore'; 
import { db } from '@/lib/firebase/config'; 
import { format } from 'date-fns';
import Link from 'next/link';
import { getRecentLogs } from '@/lib/firebase/audit-service';
import { AuditLog } from '@/lib/types';

export default function DeveloperDashboard() { 
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [systemStats, setSystemStats] = useState({
    totalSubmissions: 0,
    totalUsers: 0,
    totalLogs: 0
  });

  useEffect(() => {
    // Audit logs listener
    const unsubscribe = onSnapshot(
      query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(10)),
      (snap) => {
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog)));
      }
    );

    // Fetch system counts
    const fetchCounts = async () => {
      const subCount = await getCountFromServer(collection(db, 'submissions'));
      const userCount = await getCountFromServer(collection(db, 'users'));
      const logCount = await getCountFromServer(collection(db, 'audit_logs'));
      
      setSystemStats({
        totalSubmissions: subCount.data().count,
        totalUsers: userCount.data().count,
        totalLogs: logCount.data().count
      });
    };

    fetchCounts();
    return () => unsubscribe();
  }, []);

  const quickActions = [
    { title: "Yangi kod qo'shish", href: "/dasturchi/kodlar", icon: Users, color: "bg-primary" },
    { title: "So'rovnoma qo'shish", href: "/dasturchi/sorovnomalar", icon: Terminal, color: "bg-accent" },
    { title: "Limit o'rnatish", href: "/dasturchi/limitlar", icon: ShieldAlert, color: "bg-danger" },
    { title: "Backup yuklab olish", href: "/dasturchi/backup", icon: Save, color: "bg-emerald-600" },
  ];

  return ( 
    <AdminLayout>
      <div className="space-y-10">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-black text-primary tracking-tighter uppercase">DEVELOPER PANEL</h1>
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest mt-1">Tizim yadrosi va no-code boshqaruv</p>
        </div>

        {/* System Health */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 p-8 rounded-[40px] text-white flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase opacity-40 mb-1 tracking-widest">Foydalanuvchilar</p>
              <h2 className="text-3xl font-black">{systemStats.totalUsers}</h2>
            </div>
            <Server className="w-10 h-10 opacity-20" />
          </div>
          <div className="bg-primary p-8 rounded-[40px] text-white flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase opacity-40 mb-1 tracking-widest">Ma'lumotlar</p>
              <h2 className="text-3xl font-black">{systemStats.totalSubmissions}</h2>
            </div>
            <Database className="w-10 h-10 opacity-20" />
          </div>
          <div className="bg-emerald-600 p-8 rounded-[40px] text-white flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase opacity-40 mb-1 tracking-widest">Audit yozuvlari</p>
              <h2 className="text-3xl font-black">{systemStats.totalLogs}</h2>
            </div>
            <Activity className="w-10 h-10 opacity-20" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Audit Logs */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                <History className="w-6 h-6 text-primary" /> So'nggi o'zgarishlar
              </h2>
              <Link href="/dasturchi/audit" className="text-[10px] font-black uppercase text-primary hover:underline">Audit log</Link>
            </div>

            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="bg-background p-6 rounded-3xl border-2 border-primary/5 flex items-center justify-between group hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${
                      log.action === 'create' ? 'bg-success/10 text-success' : 
                      log.action === 'update' ? 'bg-accent/10 text-accent' : 'bg-danger/10 text-danger'
                    }`}>
                      {log.action.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold leading-none">
                        <span className="text-primary">{log.userName}</span> 
                        <span className="mx-1 opacity-40">tomonidan</span>
                        <span className="uppercase">{log.entityType}</span> 
                        <span className="mx-1 opacity-40">{log.action === 'create' ? 'yaratildi' : log.action === 'update' ? 'yangilandi' : 'o\'chirildi'}</span>
                      </p>
                      <p className="text-[10px] font-bold opacity-30 uppercase mt-1">{format(log.timestamp, "HH:mm dd/MM/yyyy")}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <h2 className="text-xl font-black uppercase tracking-tight">Tezkor harakatlar</h2>
            <div className="grid grid-cols-1 gap-3">
              {quickActions.map((action, idx) => (
                <Link key={idx} href={action.href} className="group">
                  <div className="bg-background p-6 rounded-3xl border-2 border-primary/5 flex items-center gap-4 hover:border-primary/20 transition-all">
                    <div className={`w-12 h-12 ${action.color} text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <action.icon className="w-6 h-6" />
                    </div>
                    <span className="font-black uppercase text-[10px] tracking-widest">{action.title}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  ); 
} 
