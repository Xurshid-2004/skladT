"use client"; 
 
import AdminLayout from '@/components/admin/admin-layout'; 
import { useState, useEffect } from 'react'; 
import {  
  Search, UserPlus, Shield, CheckCircle2, XCircle, 
  Edit3, Trash2, Save, X, Loader2
} from 'lucide-react'; 
import { subscribeToAllCodes, updateCodeName, deactivateCode, activateReserveCode, addNewAdminCode } from '@/lib/firebase/codes-service'; 
import { getSession } from '@/lib/utils/session';
import { ZAPRAVKALAR } from '@/lib/data/uzellar';

export default function CodesManagement() { 
  const [codes, setCodes] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStation, setFilterStation] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCodeData, setNewCodeData] = useState({ code: "", name: "", stationId: "", role: "worker" });
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    setSession(getSession());
    const unsubscribe = subscribeToAllCodes((data) => {
      setCodes(data.sort((a, b) => a.code.localeCompare(b.code)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredCodes = codes.filter(c => {
    if (filterRole !== "all" && c.role !== filterRole) return false;
    if (filterStation !== "all" && c.stationId !== filterStation) return false;
    if (search) {
      const q = search.toLowerCase();
      const hit =
        c.code.includes(search) ||
        c.displayName?.toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });

  const handleUpdateName = async (code: string) => {
    if (!newName.trim() || !session) return;
    setLoading(true);
    await updateCodeName(code, newName, session.code, session.displayName);
    setEditingCode(null);
    setNewName("");
    setLoading(false);
  };

  const handleDeactivate = async (code: string) => {
    if (!confirm("Ushbu kodni nofaol qilishni xohlaysizmi?") || !session) return;
    setLoading(true);
    await deactivateCode(code, session.code, session.displayName);
    setLoading(false);
  };

  const handleAddCode = async () => {
    if (!newCodeData.code || !newCodeData.name || !session) return;
    setLoading(true);
    if (newCodeData.role === 'admin') {
      await addNewAdminCode(newCodeData.code, newCodeData.name, session.code, session.displayName);
    } else {
      const zap = ZAPRAVKALAR.find(z => z.id === newCodeData.stationId);
      await activateReserveCode(newCodeData.code, newCodeData.name, newCodeData.stationId, zap?.uzelId || "", session.code, session.displayName);
    }
    setShowAddModal(false);
    setNewCodeData({ code: "", name: "", stationId: "", role: "worker" });
    setLoading(false);
  };

  return ( 
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary tracking-tighter uppercase">KODLAR VA XODIMLAR</h1>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest mt-1">132 ta kod boshqaruvi va rollar</p>
          </div>
          <button onClick={() => setShowAddModal(true)} className="px-8 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase shadow-xl shadow-primary/20 hover:scale-105 transition-all flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Yangi kod qo'shish
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,auto] gap-3">
          <div className="relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <input
              type="text"
              placeholder="Kod yoki ism bo'yicha qidirish..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-14 pl-14 pr-6 bg-background border-2 border-primary/5 rounded-2xl font-bold focus:outline-none focus:border-primary transition-all"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="h-14 px-5 bg-background border-2 border-primary/5 rounded-2xl font-bold text-sm focus:outline-none focus:border-primary"
          >
            <option value="all">Barcha rollar</option>
            <option value="worker">Ishchi</option>
            <option value="admin">Admin</option>
            <option value="developer">Dasturchi</option>
          </select>
          <select
            value={filterStation}
            onChange={(e) => setFilterStation(e.target.value)}
            className="h-14 px-5 bg-background border-2 border-primary/5 rounded-2xl font-bold text-sm focus:outline-none focus:border-primary"
          >
            <option value="all">Barcha zapravkalar</option>
            {ZAPRAVKALAR.map((z) => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
        </div>

        <div className="bg-background rounded-[40px] border-2 border-primary/5 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/50 text-[10px] font-black uppercase tracking-widest opacity-40">
                  <th className="px-8 py-4">Kod</th>
                  <th className="px-8 py-4">Ism-familiya</th>
                  <th className="px-8 py-4">Role</th>
                  <th className="px-8 py-4">Zapravka</th>
                  <th className="px-8 py-4">Holat</th>
                  <th className="px-8 py-4 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {filteredCodes.map((c) => (
                  <tr key={c.code} className="hover:bg-primary/5 transition-colors group">
                    <td className="px-8 py-6">
                      <span className="font-black text-primary text-lg tracking-tighter">{c.code}</span>
                    </td>
                    <td className="px-8 py-6">
                      {editingCode === c.code ? (
                        <div className="flex items-center gap-2">
                          <input 
                            autoFocus
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="h-10 px-4 bg-muted border-2 border-primary rounded-xl font-bold text-sm"
                          />
                          <button onClick={() => handleUpdateName(c.code)} className="p-2 bg-success text-white rounded-xl"><Save className="w-4 h-4" /></button>
                          <button onClick={() => setEditingCode(null)} className="p-2 bg-muted rounded-xl"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm">{c.displayName || "Zaxira kodi"}</p>
                          <button onClick={() => { setEditingCode(c.code); setNewName(c.displayName || ""); }} className="p-1 opacity-0 group-hover:opacity-100 hover:text-primary transition-all"><Edit3 className="w-3 h-3" /></button>
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                        c.role === 'developer' ? 'bg-slate-900 text-white' : 
                        c.role === 'admin' ? 'bg-accent text-white' : 'bg-primary/10 text-primary'
                      }`}>
                        {c.role}
                      </span>
                    </td>
                    <td className="px-8 py-6 font-bold text-xs opacity-60 uppercase">{c.stationId || "-"}</td>
                    <td className="px-8 py-6">
                      {c.isActive !== false ? (
                        <span className="flex items-center gap-1 text-success text-[10px] font-black uppercase"><CheckCircle2 className="w-3 h-3" /> Faol</span>
                      ) : (
                        <span className="flex items-center gap-1 text-danger text-[10px] font-black uppercase"><XCircle className="w-3 h-3" /> Nofaol</span>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right">
                      {c.isActive !== false && (
                        <button onClick={() => handleDeactivate(c.code)} className="p-3 text-danger hover:bg-danger/10 rounded-2xl transition-all"><Trash2 className="w-5 h-5" /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-background w-full max-w-md rounded-[40px] shadow-2xl border-2 border-primary/10 overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8 bg-primary text-white flex items-center justify-between">
                <h3 className="text-xl font-black uppercase tracking-tight">Yangi kod qo'shish</h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase opacity-40">Kod (4 raqam)</label>
                  <input 
                    value={newCodeData.code}
                    onChange={(e) => setNewCodeData(p => ({ ...p, code: e.target.value }))}
                    className="w-full h-14 px-6 bg-muted border-2 border-transparent focus:border-primary rounded-2xl font-black text-xl tracking-widest transition-all"
                    maxLength={4}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase opacity-40">Ism-familiya</label>
                  <input 
                    value={newCodeData.name}
                    onChange={(e) => setNewCodeData(p => ({ ...p, name: e.target.value }))}
                    className="w-full h-14 px-6 bg-muted border-2 border-transparent focus:border-primary rounded-2xl font-bold transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase opacity-40">Roli</label>
                  <select 
                    value={newCodeData.role}
                    onChange={(e) => setNewCodeData(p => ({ ...p, role: e.target.value }))}
                    className="w-full h-14 px-6 bg-muted border-2 border-transparent focus:border-primary rounded-2xl font-bold transition-all"
                  >
                    <option value="worker">Worker (Ishchi)</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {newCodeData.role === 'worker' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase opacity-40">Zapravka</label>
                    <select 
                      value={newCodeData.stationId}
                      onChange={(e) => setNewCodeData(p => ({ ...p, stationId: e.target.value }))}
                      className="w-full h-14 px-6 bg-muted border-2 border-transparent focus:border-primary rounded-2xl font-bold transition-all"
                    >
                      <option value="">Tanlang...</option>
                      {ZAPRAVKALAR.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                  </div>
                )}
                <button 
                  onClick={handleAddCode}
                  disabled={loading || !newCodeData.code || !newCodeData.name}
                  className="w-full py-5 bg-primary text-white rounded-3xl font-black uppercase shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "SAQLASH"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  ); 
} 
