"use client"; 
 
import AdminLayout from '@/components/admin/admin-layout'; 
import { useState, useEffect } from 'react'; 
import {  
  History, Search, Filter, Loader2,  
  ArrowRight, Calendar, User, Database, AlertCircle, X
} from 'lucide-react'; 
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'; 
import { db } from '@/lib/firebase/config'; 
import { format } from 'date-fns';
import { AuditLog } from '@/lib/types';

export default function AuditLogPage() { 
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredLogs = logs.filter(l => 
    l.userName.toLowerCase().includes(search.toLowerCase()) || 
    l.entityType.toLowerCase().includes(search.toLowerCase()) || 
    l.action.toLowerCase().includes(search.toLowerCase())
  );

  return ( 
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-black text-primary tracking-tighter uppercase">AUDIT LOG</h1>
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest mt-1">Tizimdagi barcha o'zgarishlar tarixi</p>
        </div>

        <div className="relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <input 
            type="text" 
            placeholder="Xodim, action yoki tur bo'yicha qidirish..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-16 pl-14 pr-6 bg-background border-2 border-primary/5 rounded-3xl font-bold focus:outline-none focus:border-primary transition-all"
          />
        </div>

        <div className="bg-background rounded-[40px] border-2 border-primary/5 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/50 text-[10px] font-black uppercase tracking-widest opacity-40">
                  <th className="px-8 py-4">Vaqt</th>
                  <th className="px-8 py-4">Kim</th>
                  <th className="px-8 py-4">Nima</th>
                  <th className="px-8 py-4">Tafsilot</th>
                  <th className="px-8 py-4 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {loading ? (
                  <tr><td colSpan={5} className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" /></td></tr>
                ) : filteredLogs.length === 0 ? (
                  <tr><td colSpan={5} className="p-20 text-center font-black text-xs opacity-20 uppercase">Audit yozuvlari topilmadi</td></tr>
                ) : filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-primary/5 transition-colors group">
                    <td className="px-8 py-6">
                      <p className="font-black text-primary text-sm leading-none">{format(log.timestamp, "HH:mm")}</p>
                      <p className="text-[10px] font-bold opacity-30 uppercase mt-1">{format(log.timestamp, "dd/MM/yyyy")}</p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center text-primary"><User className="w-4 h-4" /></div>
                        <div>
                          <p className="font-bold text-sm leading-none">{log.userName}</p>
                          <p className="text-[10px] font-bold opacity-40 uppercase mt-1">{log.userRole}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                        log.action === 'create' ? 'bg-success/10 text-success' : 
                        log.action === 'update' ? 'bg-accent/10 text-accent' : 'bg-danger/10 text-danger'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 opacity-20" />
                        <span className="font-bold text-xs uppercase tracking-tight opacity-60">{log.entityType}: {log.entityId.substring(0, 8)}...</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button onClick={() => setSelectedLog(log)} className="p-3 hover:bg-primary/5 text-primary rounded-xl transition-all"><ArrowRight className="w-5 h-5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Modal */}
        {selectedLog && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-background w-full max-w-2xl rounded-[40px] shadow-2xl border-2 border-primary/10 overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">O'zgarish tafsiloti</h3>
                  <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{selectedLog.id}</p>
                </div>
                <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-4 bg-muted rounded-2xl">
                    <p className="text-[10px] font-black uppercase opacity-40 mb-2">Eski qiymat</p>
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all opacity-60">
                      {JSON.stringify(Object.values(selectedLog.changes)[0]?.old || {}, null, 2)}
                    </pre>
                  </div>
                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl">
                    <p className="text-[10px] font-black uppercase text-primary mb-2">Yangi qiymat</p>
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all text-primary font-bold">
                      {JSON.stringify(Object.values(selectedLog.changes)[0]?.new || {}, null, 2)}
                    </pre>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-2xl">
                  <AlertCircle className="w-5 h-5 text-muted-foreground" />
                  <p className="text-xs font-bold text-muted-foreground">Ushbu o'zgarish {format(selectedLog.timestamp, "dd/MM/yyyy HH:mm:ss")} vaqtida {selectedLog.userName} tomonidan amalga oshirilgan.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  ); 
} 
