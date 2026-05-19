"use client";

// Misol komponent: input + select + dynamic ma'lumotlarni to'g'ridan-to'g'ri
// Firestore ga yozadi/o'qiydi/yangilaydi/o'chiradi.
//
// MUHIM:
//  - localStorage / sessionStorage YO'Q.
//  - Barcha ma'lumotlar firestore-service.ts orqali Firebase ga ketadi.
//  - addDoc auto-id ishlatiladi (id ni biz qo'lda generatsiya qilmaymiz).

import { useEffect, useState, type FormEvent } from "react";
import {
  createCollectionService,
  type WithId,
} from "@/lib/firebase/firestore-service";

type Item = {
  title: string;
  category: string; // select dan keladi
  note?: string;
};

const items = createCollectionService<Item>("items");

export default function FirestoreFormExample() {
  const [list, setList] = useState<WithId<Item>[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Item>({ title: "", category: "", note: "" });
  const [loading, setLoading] = useState(false);

  // Firestore — yagona manba: har safar shu yerdan o'qiymiz.
  async function refresh() {
    const data = await items.list();
    setList(data);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;

    setLoading(true);
    try {
      if (editingId) {
        // Partial update: tegmagan field-lar saqlanadi.
        await items.update(editingId, form);
      } else {
        // Auto-id bilan yangi hujjat.
        await items.create(form);
      }
      setForm({ title: "", category: "", note: "" });
      setEditingId(null);
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(item: WithId<Item>) {
    setEditingId(item.id);
    setForm({
      title: item.title ?? "",
      category: item.category ?? "",
      note: item.note ?? "",
    });
  }

  async function handleDelete(id: string) {
    await items.remove(id);
    if (editingId === id) {
      setEditingId(null);
      setForm({ title: "", category: "", note: "" });
    }
    await refresh();
  }

  return (
    <div className="space-y-4 p-4">
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="Sarlavha"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />

        <select
          className="w-full rounded border px-3 py-2"
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
        >
          <option value="">Kategoriya tanlang…</option>
          <option value="ish">Ish</option>
          <option value="shaxsiy">Shaxsiy</option>
          <option value="boshqa">Boshqa</option>
        </select>

        <textarea
          className="w-full rounded border px-3 py-2"
          placeholder="Izoh (ixtiyoriy)"
          value={form.note ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
        />

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {editingId ? "Yangilash" : "Qo'shish"}
        </button>
      </form>

      <ul className="space-y-2">
        {list.map((item) => (
          <li key={item.id} className="flex items-center justify-between rounded border p-2">
            <div>
              <div className="font-medium">{item.title}</div>
              <div className="text-sm text-gray-500">
                {item.category} {item.note ? `· ${item.note}` : ""}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(item)}
                className="rounded border px-3 py-1 text-sm"
              >
                Tahrirlash
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                className="rounded border border-red-500 px-3 py-1 text-sm text-red-600"
              >
                O'chirish
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
