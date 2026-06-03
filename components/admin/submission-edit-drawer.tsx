'use client';

import { useMemo, useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import type { HarakatTuri, Submission } from '@/lib/types';
import { RUSUMI_LIST as STATIC_RUSUMI_LIST } from '@/lib/data/lokomotiv-config';
import {
  subscribeLokomotivRusumSettings,
  type LokomotivRusumSettings,
} from '@/lib/firebase/lokomotiv-rusum-service';
import { Loader2, X, Save, FileEdit } from 'lucide-react';
import { updateSubmissionWithSummary } from '@/lib/firebase/submission-mutations';
import { parsePdfNumber } from '@/lib/utils/pdf-number';

const HARAKAT_LIST = ['yuk', 'yolovchi', 'manyovr', 'xojalik', 'ijara'];
const HARAKAT_LABEL: Record<string, string> = {
  yuk: 'Yuk',
  yolovchi: "Yo'lovchi",
  manyovr: 'Manyovr',
  xojalik: "Xo'jalik",
  ijara: 'Ijara',
};
const TAMIRLASH_TURI_LIST = ['katta', 'kichik', 'profilaktika'];

const CAT_LABEL: Record<string, string> = {
  lokomotiv: 'Lokomotiv',
  korxona: 'Korxona',
  qurulish: 'Qurulish',
  tamirlash: "Ta'mirlash",
};

interface Props {
  open: boolean;
  onClose: () => void;
  submission: Submission | null;
  onSaved: (updated: Submission) => void;
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full bg-[#0d160d] border border-[#2a3a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors';
const selectCls =
  'w-full bg-[#0d160d] border border-[#2a3a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors';

export function SubmissionEditDrawer({ open, onClose, submission, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [rusumSettings, setRusumSettings] = useState<LokomotivRusumSettings>({
    items: [],
    hiddenStaticValues: [],
  });

  useEffect(() => {
    if (submission) setForm({ ...(submission as any) });
  }, [submission?.id]);

  useEffect(() => {
    if (!open) return;
    return subscribeLokomotivRusumSettings(setRusumSettings);
  }, [open]);

  function set(key: string, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!submission) return;
    setSaving(true);
    try {
      const {
        id: _id, category: _cat, staffCode: _sc, staffName: _sn,
        stationId: _sid, nodeId: _nid, timestamp: _ts, createdAt: _ca,
        ...editable
      } = form as any;
      const editableData = { ...editable };
      if (submission.category === 'lokomotiv') {
        editableData.poyezdVazni = editableData.poyezdVazni === '' || editableData.poyezdVazni == null ? undefined : parsePdfNumber(editableData.poyezdVazni);
        editableData.qoldiq = parsePdfNumber(editableData.qoldiq);
        editableData.qanchaBerildi = parsePdfNumber(editableData.qanchaBerildi);
        editableData.dizMasla = parsePdfNumber(editableData.dizMasla);
      }
      if (submission.category === 'korxona') {
        editableData.qancha = parsePdfNumber(editableData.qancha);
        editableData.limit = editableData.limit === '' || editableData.limit == null ? editableData.limit : parsePdfNumber(editableData.limit);
      }
      if (submission.category === 'qurulish') {
        editableData.qoldiq = parsePdfNumber(editableData.qoldiq);
        editableData.poyezdVazni = editableData.poyezdVazni === '' || editableData.poyezdVazni == null ? undefined : parsePdfNumber(editableData.poyezdVazni);
        editableData.qanchaBerildi = parsePdfNumber(editableData.qanchaBerildi ?? editableData.qanchaOlindi ?? 0);
        editableData.qanchaOlindi = editableData.qanchaBerildi;
      }
      if (submission.category === 'tamirlash') {
        editableData.qanchaBerildi = parsePdfNumber(editableData.qanchaBerildi);
        editableData.dizMasla = editableData.dizMasla === '' || editableData.dizMasla == null ? undefined : parsePdfNumber(editableData.dizMasla);
      }
      const changes = { ...editableData, isEdited: true, editedAt: Date.now() };
      const updated = await updateSubmissionWithSummary(submission, changes);
      onSaved(updated);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const cat = submission?.category;
  const f = form as any;
  const rusumiOptions = useMemo(() => {
    const hiddenStatic = new Set(rusumSettings.hiddenStaticValues.map((value) => value.toLowerCase()));
    const items = STATIC_RUSUMI_LIST
      .filter((item) => !hiddenStatic.has(String(item.value).toLowerCase()))
      .map((item) => ({
        value: String(item.value),
        label: item.label,
      }));
    const seen = new Set(items.map((item) => item.value.toLowerCase()));
    const harakat = f.harakatTuri as HarakatTuri | undefined;
    rusumSettings.items
      .filter((item) => !harakat || item.harakatTurlari.includes(harakat))
      .forEach((item) => {
        const key = item.value.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        items.push({ value: item.value, label: item.label });
      });
    return items;
  }, [rusumSettings, f.harakatTuri]);

  function renderCategoryFields() {
    if (!submission) return null;

    if (cat === 'lokomotiv') return (
      <>
        <FieldRow label="Harakat turi">
          <select className={selectCls} value={f.harakatTuri ?? ''} onChange={(e) => set('harakatTuri', e.target.value)}>
            {HARAKAT_LIST.map((h) => (
              <option key={h} value={h}>{HARAKAT_LABEL[h] ?? h.charAt(0).toUpperCase() + h.slice(1)}</option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Rusumi">
          <select className={selectCls} value={f.rusumi ?? ''} onChange={(e) => set('rusumi', e.target.value)}>
            {rusumiOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Lokomotiv raqami">
          <input className={inputCls} value={f.lokomotivNumber ?? ''} onChange={(e) => set('lokomotivNumber', e.target.value)} />
        </FieldRow>
        <FieldRow label="Poyezd raqami">
          <input className={inputCls} value={f.poyezdNumber ?? ''} onChange={(e) => set('poyezdNumber', e.target.value)} />
        </FieldRow>
        <FieldRow label="Ruxsat indeksi">
          <input className={inputCls} value={f.ruxsatIndeksi ?? ''} onChange={(e) => set('ruxsatIndeksi', e.target.value)} />
        </FieldRow>
        <FieldRow label="Poyezd vazni">
          <input className={inputCls} type="text" inputMode="decimal" value={f.poyezdVazni ?? ''} onChange={(e) => set('poyezdVazni', e.target.value.replace(/[^0-9.,]/g, ''))} />
        </FieldRow>
        {f.harakatTuri === 'manyovr' && (
          <FieldRow label="Stansiya">
            <input className={inputCls} value={f.stansiya ?? ''} onChange={(e) => set('stansiya', e.target.value)} />
          </FieldRow>
        )}
        {f.harakatTuri === 'xojalik' && (
          <FieldRow label="Tashkilot">
            <input className={inputCls} value={f.tashkilot ?? ''} onChange={(e) => set('tashkilot', e.target.value)} />
          </FieldRow>
        )}
        {f.harakatTuri === 'ijara' && (
          <FieldRow label="Ijarachi">
            <input className={inputCls} value={f.ijarachi ?? ''} onChange={(e) => set('ijarachi', e.target.value)} />
          </FieldRow>
        )}
        <FieldRow label="Qoldiq (kg)">
          <input className={inputCls} type="text" inputMode="decimal" value={f.qoldiq ?? ''} onChange={(e) => set('qoldiq', e.target.value.replace(/[^0-9.,]/g, ''))} />
        </FieldRow>
        <FieldRow label="Berilgan yoqilg'i (kg)">
          <input className={inputCls} type="text" inputMode="decimal" value={f.qanchaBerildi ?? ''} onChange={(e) => set('qanchaBerildi', e.target.value.replace(/[^0-9.,]/g, ''))} />
        </FieldRow>
        <FieldRow label="Diz. masla (kg)">
          <input className={inputCls} type="text" inputMode="decimal" value={f.dizMasla ?? ''} onChange={(e) => set('dizMasla', e.target.value.replace(/[^0-9.,]/g, ''))} />
        </FieldRow>
      </>
    );

    if (cat === 'korxona') return (
      <>
        <FieldRow label="Korxona nomi">
          <input className={inputCls} value={f.korxonaNomi ?? ''} onChange={(e) => set('korxonaNomi', e.target.value)} />
        </FieldRow>
        <FieldRow label="Poyezd raqami">
          <input className={inputCls} value={f.poyezdNumber ?? ''} onChange={(e) => set('poyezdNumber', e.target.value)} />
        </FieldRow>
        <FieldRow label="Index">
          <input className={inputCls} value={f.ruxsatIndeksi ?? ''} onChange={(e) => set('ruxsatIndeksi', e.target.value)} />
        </FieldRow>
        <FieldRow label="Berilgan yoqilg'i (kg)">
          <input className={inputCls} type="text" inputMode="decimal" value={f.qancha ?? ''} onChange={(e) => set('qancha', e.target.value.replace(/[^0-9.,]/g, ''))} />
        </FieldRow>
        <FieldRow label="Necha sutkalik">
          <input className={inputCls} type="number" value={f.nechaSutkalik ?? ''} onChange={(e) => set('nechaSutkalik', Number(e.target.value))} />
        </FieldRow>
      </>
    );

    if (cat === 'qurulish') return (
      <>
        <FieldRow label="Seriya">
          <input className={inputCls} value={f.seriya ?? ''} onChange={(e) => set('seriya', e.target.value)} />
        </FieldRow>
        <FieldRow label="Raqami">
          <input className={inputCls} value={f.raqami ?? ''} onChange={(e) => set('raqami', e.target.value)} />
        </FieldRow>
        <FieldRow label="Poyezd raqami">
          <input className={inputCls} value={f.poyezdNumber ?? ''} onChange={(e) => set('poyezdNumber', e.target.value)} />
        </FieldRow>
        <FieldRow label="Index">
          <input className={inputCls} value={f.ruxsatIndeksi ?? ''} onChange={(e) => set('ruxsatIndeksi', e.target.value)} />
        </FieldRow>
        <FieldRow label="Bak qoldig'i (kg)">
          <input className={inputCls} type="text" inputMode="decimal" value={f.qoldiq ?? ''} onChange={(e) => set('qoldiq', e.target.value.replace(/[^0-9.,]/g, ''))} />
        </FieldRow>
        <FieldRow label="Poyezd vazni">
          <input className={inputCls} type="text" inputMode="decimal" value={f.poyezdVazni ?? ''} onChange={(e) => set('poyezdVazni', e.target.value.replace(/[^0-9.,]/g, ''))} />
        </FieldRow>
        <FieldRow label="Berilgan yoqilg'i (kg)">
          <input
            className={inputCls}
            type="text"
            inputMode="decimal"
            value={f.qanchaBerildi ?? f.qanchaOlindi ?? ''}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9.,]/g, '');
              setForm((prev) => ({ ...prev, qanchaBerildi: value, qanchaOlindi: value }));
            }}
          />
        </FieldRow>
      </>
    );

    if (cat === 'tamirlash') return (
      <>
        <FieldRow label="Seriya">
          <input className={inputCls} value={f.seriya ?? ''} onChange={(e) => set('seriya', e.target.value)} />
        </FieldRow>
        <FieldRow label="Raqami">
          <input className={inputCls} value={f.raqami ?? ''} onChange={(e) => set('raqami', e.target.value)} />
        </FieldRow>
        <FieldRow label="Ta'mirlash turi">
          <select className={selectCls} value={f.tamirlashTuri ?? ''} onChange={(e) => set('tamirlashTuri', e.target.value)}>
            {TAMIRLASH_TURI_LIST.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Berilgan yoqilg'i (kg)">
          <input className={inputCls} type="text" inputMode="decimal" value={f.qanchaBerildi ?? ''} onChange={(e) => set('qanchaBerildi', e.target.value.replace(/[^0-9.,]/g, ''))} />
        </FieldRow>
        <FieldRow label="Diz. masla (kg)">
          <input className={inputCls} type="text" inputMode="decimal" value={f.dizMasla ?? ''} onChange={(e) => set('dizMasla', e.target.value.replace(/[^0-9.,]/g, ''))} />
        </FieldRow>
        <FieldRow label="Mas'ul shaxs">
          <input className={inputCls} value={f.masulShaxs ?? ''} onChange={(e) => set('masulShaxs', e.target.value)} />
        </FieldRow>
      </>
    );

    return null;
  }

  return (
    <Drawer.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }} direction="right">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Drawer.Content
          className="right-2 top-2 bottom-2 fixed z-50 outline-none w-[340px] flex"
          style={{ '--initial-transform': 'calc(100% + 8px)' } as React.CSSProperties}
        >
          <div
            className="flex flex-col h-full w-full rounded-[16px] overflow-hidden"
            style={{ background: '#111c11', border: '1.5px solid #2a3a2a' }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ background: '#0d160d', borderBottom: '1px solid #2a3a2a' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/20 rounded-xl flex items-center justify-center">
                  <FileEdit className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <Drawer.Title className="text-white font-black text-sm leading-tight">
                    {CAT_LABEL[cat ?? ''] ?? 'Tahrirlash'}
                  </Drawer.Title>
                  <Drawer.Description className="text-gray-500 text-[10px]">
                    ID: ...{submission?.id.slice(-6)}
                  </Drawer.Description>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {renderCategoryFields()}

              {/* Common: olib borish */}
              {cat !== 'qurulish' && (
              <div className="pt-3 border-t border-[#2a3a2a] space-y-4">
                <FieldRow label="Olib borish usuli">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => set('mashinadaYetkazildi', true)}
                      className={`px-4 py-3 rounded-2xl font-black uppercase text-sm transition-all ${
                        f.mashinadaYetkazildi === true
                          ? 'bg-primary text-white shadow-lg shadow-primary/30'
                          : 'bg-white/10 text-gray-300 border border-white/10 hover:bg-white/15'
                      }`}
                    >
                      HA
                    </button>
                    <button
                      type="button"
                      onClick={() => set('mashinadaYetkazildi', false)}
                      className={`px-4 py-3 rounded-2xl font-black uppercase text-sm transition-all ${
                        f.mashinadaYetkazildi === false
                          ? 'bg-primary text-white shadow-lg shadow-primary/30'
                          : 'bg-white/10 text-gray-300 border border-white/10 hover:bg-white/15'
                      }`}
                    >
                      YO'Q
                    </button>
                  </div>
                </FieldRow>
                {f.mashinadaYetkazildi && (
                  <FieldRow label="Mashina raqami">
                    <input
                      className={inputCls}
                      value={f.mashinaRaqami ?? ''}
                      onChange={(e) => set('mashinaRaqami', e.target.value)}
                    />
                  </FieldRow>
                )}
              </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="px-5 py-4 shrink-0"
              style={{ background: '#0d160d', borderTop: '1px solid #2a3a2a' }}
            >
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary/90 active:scale-95 text-white rounded-xl font-black uppercase text-sm transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
