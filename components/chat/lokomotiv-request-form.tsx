"use client";

import { useState } from "react";
import { SERIYA_LIST } from "@/lib/data/sections-config";

interface LokomotivRequestFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export default function LokomotivRequestForm({ onSubmit, onCancel }: LokomotivRequestFormProps) {
  const [formData, setFormData] = useState({
    seriya: "",
    lokomotivNumber: "",
    requestKind: "tashqari" as "tashqari" | "oldinroq",
  });

  return (
    <div className="p-6 space-y-4 bg-background border-2 border-primary/20 rounded-3xl shadow-xl animate-in zoom-in-95">
      <h3 className="text-lg font-black text-primary uppercase tracking-tight">🚂 Lokomotiv So'rovi</h3>
      
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase opacity-60">Seriya</label>
          <select
            value={formData.seriya}
            onChange={(e) => setFormData(p => ({ ...p, seriya: e.target.value }))}
            className="w-full h-12 px-4 rounded-xl font-bold bg-white text-gray-900 border-2 border-gray-300 focus:border-primary focus:outline-none"
          >
            <option value="" className="bg-white text-gray-900">Tanlang</option>
            {SERIYA_LIST.map(s => (
              <option key={s} value={s} className="bg-white text-gray-900">{s}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase opacity-60">LOKOMOTIV №</label>
          <input
            type="text"
            value={formData.lokomotivNumber}
            onChange={(e) => setFormData(p => ({ ...p, lokomotivNumber: e.target.value }))}
            className="w-full h-12 px-4 bg-muted/50 border-2 border-primary/5 rounded-xl font-bold"
            placeholder="0000"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setFormData(p => ({ ...p, requestKind: 'tashqari' }))}
            className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${formData.requestKind === 'tashqari' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}
          >
            TASHQARI
          </button>
          <button
            onClick={() => setFormData(p => ({ ...p, requestKind: 'oldinroq' }))}
            className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${formData.requestKind === 'oldinroq' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}
          >
            OLDINROQ
          </button>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} className="flex-1 py-3 bg-muted rounded-xl font-bold text-sm uppercase">Bekor qilish</button>
        <button
          onClick={() => onSubmit(formData)}
          disabled={!formData.seriya || !formData.lokomotivNumber}
          className="flex-[2] py-3 bg-primary text-white rounded-xl font-black text-sm uppercase disabled:opacity-50"
        >
          So'rov yuborish
        </button>
      </div>
    </div>
  );
}
