"use client"; 
 
import AdminLayout from '@/components/admin/admin-layout'; 
import { useState, useEffect } from 'react'; 
import {
  Wallet, Plus, Edit3, Trash2, Save, X,
  Loader2, Filter, ShieldCheck, ShieldAlert, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { subscribeToAllLimits, createLimit, updateLimit, deleteLimit } from '@/lib/firebase/limits-service'; 
import { getSession } from '@/lib/utils/session';
import { Limit } from '@/lib/types';
import { ZAPRAVKALAR } from '@/lib/data/uzellar';
import { SERIYA_LIST } from '@/lib/data/sections-config';

export default function LimitsManagement() { 
  const [activeTab, setActiveTab] = useState<Limit['type']>('korxona');
  const [filterStation, setFilterStation] = useState<string>('all');
  const [limits, setLimits] = useState<Limit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLimit, setEditingLimit] = useState<Limit | null>(null);
  const [session, setSession] = useState<any>(null);

  const [formData, setFormData] = useState<Partial<Limit>>({
    type: 'korxona',
    korxonaNomi: "",
    seriya: "",
    lokomotivNumber: "",
    limit: 0,
    stationId: "",
    isActive: true
  });

  useEffect(() => {
    setSession(getSession());
    const unsubscribe = subscribeToAllLimits((data) => {
      setLimits(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredLimits = limits.filter(l => {
    if (l.type !== activeTab) return false;
    if (filterStation !== 'all' && l.stationId !== filterStation) return false;
    return true;
  });

  const handleExport = () => {
    const rows = filteredLimits.map(l => ({
      Tafsilot: l.korxonaNomi || (l.seriya && l.lokomotivNumber ? `${l.seriya}-${l.lokomotivNumber}` : '') || l.stansiyaName || '',
      Zapravka: ZAPRAVKALAR.find(z => z.id === l.stationId)?.name || 'Barcha',
      'Limit (kg/sutka)': l.limit,
      Holat: l.isActive ? 'Faol' : 'Nofaol',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `limit-${activeTab}`);
    XLSX.writeFile(wb, `limitlar-${activeTab}-${Date.now()}.xlsx`);
  };

  const handleSave = async () => {
    if (!formData.limit || !session) return;
    setLoading(true);
    
    const data = {
      ...formData,
      type: activeTab,
      createdBy: session.code,
      isActive: true
    } as Omit<Limit, 'id' | 'createdAt' | 'updatedAt'>;

    if (editingLimit) {
      await updateLimit(editingLimit.id, data, session.code, session.displayName);
    } else {
      await createLimit(data, session.code, session.displayName);
    }

    setShowAddModal(false);
    setEditingLimit(null);
    setFormData({ type: activeTab, korxonaNomi: "", seriya: "", lokomotivNumber: "", limit: 0, stationId: "", isActive: true });
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Ushbu limitni o'chirishni xohlaysizmi?") || !session) return;
    setLoading(true);
    await deleteLimit(id, session.code, session.displayName);
    setLoading(false);
  };

  return ( 
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary tracking-tighter uppercase">LIMITLAR BOSHQARUVI</h1>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest mt-1">4 xil yo'nalish bo'yicha limitlar</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={handleExport} className="px-6 py-4 bg-muted text-foreground rounded-2xl text-[10px] font-black uppercase border-2 border-primary/10 hover:bg-primary/5 transition-all flex items-center gap-2">
              <Download className="w-4 h-4" /> Excel'ga yuklash
            </button>
            <button onClick={() => { setEditingLimit(null); setShowAddModal(true); }} className="px-8 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase shadow-xl shadow-primary/20 hover:scale-105 transition-all flex items-center gap-2">
              <Plus className="w-4 h-4" /> Yangi limit qo'shish
            </button>
          </div>
        </div>

        {/* Tabs + station filter */}
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex p-2 bg-muted/50 rounded-3xl overflow-x-auto gap-1 flex-1">
            {['korxona', 'qurulish', 'lokomotiv', 'stansiya'].map((type) => (
              <button
                key={type}
                onClick={() => setActiveTab(type as Limit['type'])}
                className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeTab === type ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:bg-primary/5'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <select
            value={filterStation}
            onChange={(e) => setFilterStation(e.target.value)}
            className="h-14 px-5 bg-background border-2 border-primary/10 rounded-2xl font-bold text-sm focus:outline-none focus:border-primary"
          >
            <option value="all">Barcha zapravkalar</option>
            {ZAPRAVKALAR.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>

        {/* Limits List */}
        <div className="bg-background rounded-[40px] border-2 border-primary/5 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/50 text-[10px] font-black uppercase tracking-widest opacity-40">
                  <th className="px-8 py-4">Tafsilot</th>
                  <th className="px-8 py-4">Zapravka</th>
                  <th className="px-8 py-4">Limit (kg/sutka)</th>
                  <th className="px-8 py-4">Holat</th>
                  <th className="px-8 py-4 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {loading ? (
                  <tr><td colSpan={5} className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" /></td></tr>
                ) : filteredLimits.length === 0 ? (
                  <tr><td colSpan={5} className="p-20 text-center font-black text-xs opacity-20 uppercase">Hali limitlar o'rnatilmagan</td></tr>
                ) : filteredLimits.map((l) => (
                  <tr key={l.id} className="hover:bg-primary/5 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center text-primary">
                          {l.type === 'lokomotiv' ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-bold text-sm leading-none">
                            {l.korxonaNomi || `${l.seriya}-${l.lokomotivNumber}` || l.stansiyaName || "Umumiy limit"}
                          </p>
                          <p className="text-[10px] font-bold opacity-30 uppercase mt-1">{l.type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-xs font-black uppercase opacity-60">{ZAPRAVKALAR.find(z => z.id === l.stationId)?.name || "Barcha"}</p>
                    </td>
                    <td className="px-8 py-6">
                      <p className="font-black text-lg text-primary">{l.limit.toLocaleString()} <span className="text-[10px] uppercase ml-1">kg</span></p>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${l.isActive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                        {l.isActive ? 'Faol' : 'Nofaol'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingLimit(l); setFormData(l); setShowAddModal(true); }} className="p-3 hover:bg-muted rounded-xl transition-colors text-accent"><Edit3 className="w-5 h-5" /></button>
                        <button onClick={() => handleDelete(l.id)} className="p-3 hover:bg-danger/10 rounded-xl transition-colors text-danger"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-background w-full max-w-md rounded-[40px] shadow-2xl border-2 border-primary/10 overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8 bg-primary text-white flex items-center justify-between">
                <h3 className="text-xl font-black uppercase tracking-tight">{editingLimit ? "Limitni tahrirlash" : "Yangi limit"}</h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase opacity-40">Zapravka</label>
                  <select 
                    value={formData.stationId}
                    onChange={(e) => setFormData(p => ({ ...p, stationId: e.target.value }))}
                    className="w-full h-14 px-6 bg-muted border-2 border-transparent focus:border-primary rounded-2xl font-bold transition-all"
                  >
                    <option value="">Barcha zapravkalar uchun</option>
                    {ZAPRAVKALAR.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                </div>

                {activeTab === 'korxona' || activeTab === 'qurulish' ? (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase opacity-40">Korxona nomi</label>
                    <input 
                      value={formData.korxonaNomi}
                      onChange={(e) => setFormData(p => ({ ...p, korxonaNomi: e.target.value }))}
                      className="w-full h-14 px-6 bg-muted border-2 border-transparent focus:border-primary rounded-2xl font-bold transition-all"
                    />
                  </div>
                ) : activeTab === 'lokomotiv' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase opacity-40">Seriya</label>
                      <select 
                        value={formData.seriya}
                        onChange={(e) => setFormData(p => ({ ...p, seriya: e.target.value }))}
                        className="w-full h-14 px-6 bg-muted border-2 border-transparent focus:border-primary rounded-2xl font-bold transition-all"
                      >
                        <option value="">Tanlang...</option>
                        {SERIYA_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase opacity-40">Raqam</label>
                      <input 
                        value={formData.lokomotivNumber}
                        onChange={(e) => setFormData(p => ({ ...p, lokomotivNumber: e.target.value }))}
                        className="w-full h-14 px-6 bg-muted border-2 border-transparent focus:border-primary rounded-2xl font-bold transition-all"
                      />
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase opacity-40">Limit miqdori (kg/sutka)</label>
                  <input 
                    type="number"
                    value={formData.limit}
                    onChange={(e) => setFormData(p => ({ ...p, limit: Number(e.target.value) }))}
                    className="w-full h-14 px-6 bg-muted border-2 border-transparent focus:border-primary rounded-2xl font-black text-2xl transition-all"
                  />
                </div>

                <button 
                  onClick={handleSave}
                  disabled={loading || !formData.limit}
                  className="w-full py-5 bg-primary text-white rounded-3xl font-black uppercase shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 mt-6"
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
