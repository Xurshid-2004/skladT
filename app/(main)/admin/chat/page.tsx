"use client";

import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin/admin-layout";
import RequestCard from "@/components/chat/request-card";
import {
  subscribeAdminMessageFeed,
  deleteMessage,
} from "@/lib/firebase/chat-service";
import { getSession } from "@/lib/utils/session";
import { ChatMessage, ChatType, Session } from "@/lib/types";
import { UZELLAR, ZAPRAVKALAR } from "@/lib/data/uzellar";
import { format } from "date-fns";
import {
  MessageSquare,
  Truck,
  Building2,
  AlignLeft,
  Filter,
  Trash2,
  Radio,
} from "lucide-react";

type InboxFilter =
  | "all"
  | "pending"
  | "text"
  | "lokomotiv_request"
  | "korxona_request";

function zapravkaLabel(stationId?: string): string {
  if (!stationId) return "—";
  const z = ZAPRAVKALAR.find((x) => x.id === stationId);
  return z ? z.name : stationId;
}

function manbaLabel(chatType: ChatType, chatScope: string): string {
  if (chatType === "umumiy") return "Umumiy chat · global";
  if (chatType === "uzel") {
    const u = UZELLAR.find((x) => x.id === chatScope);
    return u ? `Uzel · ${u.name}` : `Uzel · ${chatScope}`;
  }
  if (chatType === "admin") return "To'g'ridan-to'g'ri admin kanal";
  return chatScope;
}

function xabarTuri(m: ChatMessage): string {
  if (m.type === "lokomotiv_request") return "Lokomotiv limit so'rovi";
  if (m.type === "korxona_request") return "Korxona limit so'rovi";
  if (m.type === "system") return "Tizim xabari";
  return "Matn xabari";
}

function isWorker(m: ChatMessage): boolean {
  return m.senderRole === "worker";
}

export default function AdminChatPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<ChatMessage[]>([]);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [onlyWorkers, setOnlyWorkers] = useState(true);

  useEffect(() => {
    setSession(getSession());
  }, []);

  useEffect(() => {
    if (!session) return;
    return subscribeAdminMessageFeed(setItems, 280);
  }, [session]);

  const stats = useMemo(() => {
    const pool = onlyWorkers ? items.filter(isWorker) : items;
    const pending = pool.filter(
      (m) =>
        (m.type === "lokomotiv_request" || m.type === "korxona_request") &&
        m.request?.status === "pending",
    ).length;
    const text = pool.filter((m) => m.type === "text").length;
    const lok = pool.filter((m) => m.type === "lokomotiv_request").length;
    const kor = pool.filter((m) => m.type === "korxona_request").length;
    return { pending, text, lok, kor, total: pool.length };
  }, [items, onlyWorkers]);

  const filtered = useMemo(() => {
    let rows = onlyWorkers ? items.filter(isWorker) : items;
    if (filter === "pending") {
      rows = rows.filter(
        (m) =>
          (m.type === "lokomotiv_request" || m.type === "korxona_request") &&
          m.request?.status === "pending",
      );
    } else if (filter === "text") {
      rows = rows.filter((m) => m.type === "text");
    } else if (filter !== "all") {
      rows = rows.filter((m) => m.type === filter);
    }
    return rows;
  }, [items, filter, onlyWorkers]);

  const isAdminUser =
    session?.role === "admin" || session?.role === "developer";

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-8 pb-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.35em] text-primary/70 mb-1">
              <Radio className="w-3.5 h-3.5" />
              Admin oqimi
            </div>
            <h1 className="text-3xl font-black text-primary tracking-tighter uppercase flex items-center gap-3">
              <MessageSquare className="w-8 h-8" />
              Chat va so&apos;rovlar
            </h1>
            <p className="text-muted-foreground font-bold text-sm mt-2 max-w-xl">
              Zapravka xodimlari umumiy va uzel chatlaridan yuborgan matn va
              limit so&apos;rovlari shu yerda; manba, zapravka va xabar turi
              ajratib ko&apos;rsatiladi. Kutilayotgan tasdiqlar yuqorida
              ajralib turadi.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider cursor-pointer select-none bg-muted/80 px-4 py-3 rounded-2xl border border-primary/10">
            <input
              type="checkbox"
              checked={onlyWorkers}
              onChange={(e) => setOnlyWorkers(e.target.checked)}
              className="rounded border-primary/30"
            />
            Faqat xodimlar
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Jami (oxirgi oqim)"
            value={stats.total}
            accent="default"
          />
          <StatCard
            label="Kutilmoqda"
            value={stats.pending}
            accent="warning"
          />
          <StatCard label="Matn" value={stats.text} accent="muted" />
          <StatCard
            label="So'rovlar (L / K)"
            value={`${stats.lok} / ${stats.kor}`}
            accent="primary"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center flex-wrap">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground">
            <Filter className="w-4 h-4" />
            Filtr
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "Hammasi"],
                ["pending", "Tasdiq kutilmoqda"],
                ["text", "Matn xabarlar"],
                ["lokomotiv_request", "Lokomotiv"],
                ["korxona_request", "Korxona"],
              ] as const
            ).map(([k, lab]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all ${
                  filter === k
                    ? "bg-primary text-white shadow-lg shadow-primary/25"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {lab}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border-2 border-primary/10 bg-background/90 shadow-sm overflow-hidden">
          {!session && (
            <p className="p-10 text-center font-bold text-muted-foreground">
              Sessiya yuklanmoqda…
            </p>
          )}
          {session && !filtered.length && (
            <p className="p-12 text-center text-muted-foreground font-bold text-sm">
              Tanlangan filtr bo&apos;yicha xabar yo&apos;q
            </p>
          )}
          {session && (
            <ul className="divide-y divide-primary/5">
              {filtered.map((m) => (
                <li
                  key={m.id}
                  className="p-5 sm:p-6 hover:bg-primary/[0.03] transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                          {xabarTuri(m)}
                        </span>
                        {m.type === "lokomotiv_request" && (
                          <Truck className="w-3.5 h-3.5 text-primary" />
                        )}
                        {m.type === "korxona_request" && (
                          <Building2 className="w-3.5 h-3.5 text-accent" />
                        )}
                        {m.type === "text" && (
                          <AlignLeft className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <p className="font-black text-sm">{m.senderName}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">
                        Kod: {m.senderCode} · Rol: {m.senderRole}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-primary">
                        {format(m.createdAt, "dd.MM.yyyy HH:mm")}
                      </p>
                      <p className="text-[10px] font-bold text-muted-foreground mt-1 max-w-[220px] sm:max-w-none sm:text-right">
                        {manbaLabel(m.chatType, m.chatScope)}
                      </p>
                      <p className="text-[10px] font-bold text-accent mt-0.5">
                        Zapravka: {zapravkaLabel(m.senderStation)}
                      </p>
                    </div>
                  </div>

                  {m.type === "text" && m.text && (
                    <div className="rounded-2xl bg-muted/50 border border-primary/10 px-4 py-3 text-sm font-medium leading-relaxed">
                      {m.text}
                    </div>
                  )}

                  {(m.type === "lokomotiv_request" ||
                    m.type === "korxona_request") && (
                    <div className="mt-2">
                      <RequestCard
                        message={m}
                        currentUserCode={session.code}
                        currentUserName={session.displayName}
                        isAdmin={isAdminUser}
                      />
                    </div>
                  )}

                  {session && isAdminUser && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(
                            "Xabar yashirilsinmi? (tiklanmaydi, faqat o'chirilgan deb belgilanadi)",
                          )
                        )
                          void deleteMessage(m.id);
                      }}
                      className="mt-4 inline-flex items-center gap-2 text-[10px] font-black uppercase text-danger hover:opacity-80"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Olib tashlash
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: "default" | "warning" | "muted" | "primary";
}) {
  const ring =
    accent === "warning"
      ? "border-amber-500/40 bg-amber-500/8"
      : accent === "primary"
        ? "border-primary/30 bg-primary/8"
        : accent === "muted"
          ? "border-muted-foreground/20 bg-muted/50"
          : "border-primary/10 bg-background";
  return (
    <div className={`rounded-2xl border-2 px-4 py-3 ${ring}`}>
      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      <p className="text-xl font-black tabular-nums text-primary">{value}</p>
    </div>
  );
}
