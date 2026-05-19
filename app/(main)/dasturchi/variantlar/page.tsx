"use client"; 
 
import AdminLayout from '@/components/admin/admin-layout'; 
import { useState, useEffect } from 'react'; 
import {  
  Search, Plus, X, Loader2, Factory,  
  Layers, Copy, Save, Trash2
} from 'lucide-react'; 
import { subscribeToVariants, addVariant, removeVariant } from '@/lib/firebase/variants-service'; 
import { getSession } from '@/lib/utils/session';
import { ZAPRAVKALAR } from '@/lib/data/uzellar';

const FIELD_KEYS = [
  { key: 'stansiyalar', label: 'Stansiyalar' },
  { key: 'tashkilotlar', label: 'Tashkilotlar' },
  { key: 'ijarachilar', label: 'Ijarachilar' },
  { key: 'korxonalar', label: 'Korxonalar' },
  { key: 'buyruq_egalari', label: 'Buyruq egalari' },
  { key: 'mashina_raqamlari', label: 'Mashina raqamlari' },
];

export default function VariantsManagement() { 
  const [selectedStation, setSelectedStation] = useState(ZAPRAVKALAR[0].id);
  const [selectedField, setSelectedField] = useState(FIELD_KEYS[0].key);
  const [variants, setVariants] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [newValue, setNewName] = useState("");
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    setSession(getSession());
    const unsubscribe = subscribeToVariants(selectedStation, (data) => {
      setVariants(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [selectedStation]);

  const handleAdd = async () => {
    if (!newValue.trim() || !session) return;
    setLoading(true);
    await addVariant(selectedStation, selectedField, newValue.trim(), session.code, session.displayName);
    setNewName("");
    setLoading(false);
  };

  const handleRemove = async (val: string) => {
    if (!session) return;
    setLoading(true);
    await removeVariant(selectedStation, selectedField, val, session.code, session.displayName);
    setLoading(false);
  };

  const currentList = variants[selectedField] || [];

  return ( 
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-black text-primary tracking-tighter uppercase">VARIANTLAR BOSHQARUVI</h1>
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest mt-1">Har bir zapravka uchun dinamik ro'yxatlar</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase opacity-40">Zapravkani tanlang</label>
            <select 
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              className="w-full h-16 px-6 bg-background border-2 border-primary/5 rounded-3xl font-black text-sm uppercase tracking-widest focus:border-primary transition-all"
            >
              {ZAPRAVKALAR.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase opacity-40">Maydonni tanlang</label>
            <select 
              value={selectedField}
              onChange={(e) => setSelectedField(e.target.value)}
              className="w-full h-16 px-6 bg-background border-2 border-primary/5 rounded-3xl font-black text-sm uppercase tracking-widest focus:border-primary transition-all"
            >
              {FIELD_KEYS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-background p-8 rounded-[40px] border-2 border-primary/5 shadow-sm space-y-8">
          <div className="flex gap-4">
            <input 
              value={newValue}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Yangi variant nomi..."
              className="flex-1 h-14 px-6 bg-muted border-2 border-transparent focus:border-primary rounded-2xl font-bold transition-all"
            />
            <button 
              onClick={handleAdd}
              disabled={loading || !newValue.trim()}
              className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase opacity-40 tracking-widest flex items-center gap-2">
              <Layers className="w-4 h-4" /> Mavjud variantlar ({currentList.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {currentList.length === 0 ? (
                <p className="text-muted-foreground text-xs font-bold py-4">Hali variantlar qo'shilmagan</p>
              ) : (
                currentList.map((val: string) => (
                  <div key={val} className="px-4 py-3 bg-muted border border-primary/5 rounded-xl flex items-center gap-3 group hover:border-primary/20 transition-all">
                    <span className="font-bold text-sm">{val}</span>
                    <button onClick={() => handleRemove(val)} className="p-1 hover:text-danger transition-colors opacity-0 group-hover:opacity-100">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button className="p-6 bg-muted rounded-3xl flex items-center gap-4 hover:bg-primary/5 transition-all group">
            <div className="w-10 h-10 bg-background rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <Copy className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="font-black text-[10px] uppercase tracking-widest">Ko'chirish</p>
              <p className="text-xs font-bold opacity-40">Boshqa zapravkadan nusxa olish</p>
            </div>
          </button>
          <button className="p-6 bg-muted rounded-3xl flex items-center gap-4 hover:bg-primary/5 transition-all group">
            <div className="w-10 h-10 bg-background rounded-xl flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
              <Plus className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="font-black text-[10px] uppercase tracking-widest">Ommaviy qo'shish</p>
              <p className="text-xs font-bold opacity-40">Excel yoki matndan nusxalash</p>
            </div>
          </button>
        </div>
      </div>
    </AdminLayout>
  ); 
} 
