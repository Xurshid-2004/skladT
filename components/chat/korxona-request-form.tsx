"use client";

import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

interface KorxonaRequestFormProps {
  stationId: string;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export default function KorxonaRequestForm({ stationId, onSubmit, onCancel }: KorxonaRequestFormProps) {
  const [formData, setFormData] = useState({
    korxonaNomi: "",
    qancha: "",
    sutka: "1",
    buyruqNumber: "",
    kimTomonidan: "",
  });

  const [korxonalar, setKorxonalar] = useState<string[]>([]);

  useEffect(() => {
    const fetchLimits = async () => {
      const docSnap = await getDoc(doc(db, 'settings', 'limits'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setKorxonalar(data.korxonaList?.[stationId] || data.korxonaList?.default || []);
      }
    };
    fetchLimits();
  }, [stationId]);

  return (
    <div className="p-6 space-y-4 bg-background border-2 border-primary/20 rounded-3xl shadow-xl animate-in zoom-in-95">
      <h3 className="text-lg font-black text-primary uppercase tracking-tight">🏭 Korxona So'rovi</h3>
      
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase opacity-60">Korxona Nomi</label>
          <input
            type="text"
            list="korxonaList"
            value={formData.korxonaNomi}
            onChange={(e) => setFormData(p => ({ ...p, korxonaNomi: e.target.value }))}
            className="w-full h-12 px-4 bg-muted/50 border-2 border-primary/5 rounded-xl font-bold"
            placeholder="Tanlang yoki yozing"
          />
          <datalist id="korxonaList">
            {korxonalar.map(k => <option key={k} value={k} />)}
          </datalist>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase opacity-60">Qancha (kg)</label>
            <input
              type="number"
              value={formData.qancha}
              onChange={(e) => setFormData(p => ({ ...p, qancha: e.target.value }))}
              className="w-full h-12 px-4 bg-muted/50 border-2 border-primary/5 rounded-xl font-bold"
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase opacity-60">Sutka</label>
            <input
              type="number"
              value={formData.sutka}
              onChange={(e) => setFormData(p => ({ ...p, sutka: e.target.value }))}
              className="w-full h-12 px-4 bg-muted/50 border-2 border-primary/5 rounded-xl font-bold"
              placeholder="1"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase opacity-60">Buyruq №</label>
          <input
            type="text"
            value={formData.buyruqNumber}
            onChange={(e) => setFormData(p => ({ ...p, buyruqNumber: e.target.value }))}
            className="w-full h-12 px-4 bg-muted/50 border-2 border-primary/5 rounded-xl font-bold"
            placeholder="00-N"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase opacity-60">Kim Tomonidan</label>
          <input
            type="text"
            value={formData.kimTomonidan}
            onChange={(e) => setFormData(p => ({ ...p, kimTomonidan: e.target.value }))}
            className="w-full h-12 px-4 bg-muted/50 border-2 border-primary/5 rounded-xl font-bold"
            placeholder="F.I.SH"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} className="flex-1 py-3 bg-muted rounded-xl font-bold text-sm uppercase">Bekor qilish</button>
        <button
          onClick={() => onSubmit({ ...formData, qancha: Number(formData.qancha), sutka: Number(formData.sutka) })}
          disabled={!formData.korxonaNomi || !formData.qancha}
          className="flex-[2] py-3 bg-primary text-white rounded-xl font-black text-sm uppercase disabled:opacity-50"
        >
          So'rov yuborish
        </button>
      </div>
    </div>
  );
}
