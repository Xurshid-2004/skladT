"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

export type RentCalendarProps = {
  isOpen: boolean;
  onClose: () => void;
  onExportPdf: (start: Date | null, end: Date | null) => void | Promise<void>;
  onExportErjuPdf: (start: Date | null, end: Date | null) => void | Promise<void>;
};

type CalendarDayMeta = {
  date: Date;
  iso: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isClosed: boolean;
  isFuture: boolean;
  isSelected: boolean;
  isInRange: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
};

type SkeletonDay = Pick<CalendarDayMeta, "date" | "iso" | "isCurrentMonth">;

const WEEK_DAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const MONTH_NAMES_UZ = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfMonth(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(1);
  return x;
}

function addMonths(d: Date, delta: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + delta);
  return x;
}

function getRangeBounds(
  rangeStart: Date | null,
  rangeEnd: Date | null,
  hoverDate: Date | null,
): { low: Date | null; high: Date | null } {
  if (!rangeStart) return { low: null, high: null };
  const effectiveEnd = rangeEnd ?? hoverDate;
  if (!effectiveEnd) return { low: rangeStart, high: null };
  if (rangeStart.getTime() <= effectiveEnd.getTime()) {
    return { low: rangeStart, high: effectiveEnd };
  }
  return { low: effectiveEnd, high: rangeStart };
}

function buildCalendarGrid(
  year: number,
  month: number,
  rangeStart: Date | null,
  rangeEnd: Date | null,
  hoverDate: Date | null,
  closedDates: readonly string[],
  today: Date,
): CalendarDayMeta[] {
  const firstDay = new Date(year, month, 1);
  firstDay.setHours(0, 0, 0, 0);
  const lastDay = new Date(year, month + 1, 0);
  lastDay.setHours(0, 0, 0, 0);

  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const skeleton: SkeletonDay[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    d.setHours(0, 0, 0, 0);
    skeleton.push({ date: new Date(d), iso: toIso(d), isCurrentMonth: false });
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i);
    d.setHours(0, 0, 0, 0);
    skeleton.push({ date: new Date(d), iso: toIso(d), isCurrentMonth: true });
  }
  const remaining = 42 - skeleton.length;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    d.setHours(0, 0, 0, 0);
    skeleton.push({ date: new Date(d), iso: toIso(d), isCurrentMonth: false });
  }

  const { low, high } = getRangeBounds(rangeStart, rangeEnd, hoverDate);

  return skeleton.map((row) => {
    const d = row.date;
    const isFuture = d.getTime() > today.getTime();
    const isRangeStart = !!low && isSameDay(d, low);
    const isRangeEnd = !!high && isSameDay(d, high);
    const hasSpan = !!low && !!high && !isSameDay(low, high);
    const isInRange = hasSpan && d.getTime() > low.getTime() && d.getTime() < high.getTime();
    return {
      ...row,
      isToday: isSameDay(d, today),
      isClosed: closedDates.includes(toIso(d)),
      isFuture,
      isSelected: isRangeStart || isRangeEnd,
      isInRange,
      isRangeStart,
      isRangeEnd,
    };
  });
}

export default function RentCalendar({
  isOpen,
  onClose,
  onExportPdf,
  onExportErjuPdf,
}: RentCalendarProps) {
  // today va now — calendar ochilganda qayta hisoblanadi (real-time)
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const now = useMemo(() => new Date(), [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const [currentMonthAnchor, setCurrentMonthAnchor] = useState(() => startOfMonth(new Date()));
  const [rangeStart, setRangeStart]   = useState<Date | null>(null);
  const [rangeEnd,   setRangeEnd]     = useState<Date | null>(null);
  const [hoverDate,  setHoverDate]    = useState<Date | null>(null);
  const [closedDates, setClosedDates] = useState<string[]>([]);
  const [busy, setBusy]               = useState<"" | "pdf" | "erju">("");

  const leftMonthDate  = currentMonthAnchor;
  const rightMonthDate = useMemo(() => addMonths(currentMonthAnchor, 1), [currentMonthAnchor]);

  // body scroll bloklash
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  // Klaviatura: ← chap oy, → o'ng oy, Escape yopish
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  { e.preventDefault(); setCurrentMonthAnchor((m) => addMonths(m, -1)); }
      if (e.key === "ArrowRight") { e.preventDefault(); setCurrentMonthAnchor((m) => addMonths(m, 1)); }
      if (e.key === "Escape")     { onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // calendar ochilganda holatni reset + oyni bugunga qaytarish
  useEffect(() => {
    if (!isOpen) return;
    setRangeStart(null);
    setRangeEnd(null);
    setHoverDate(null);
    setCurrentMonthAnchor(startOfMonth(now));
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // closedDays real-time snapshot
  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(query(collection(db, "closedDays")), (snap) => {
      const dates = snap.docs.map((d) => {
        const payload = d.data() as { date?: string };
        return typeof payload.date === "string" && payload.date.trim()
          ? payload.date.trim()
          : d.id;
      });
      setClosedDates(dates);
    });
    return () => unsub();
  }, [isOpen]);

  const gridLeft = useMemo(
    () => buildCalendarGrid(
      leftMonthDate.getFullYear(), leftMonthDate.getMonth(),
      rangeStart, rangeEnd, hoverDate, closedDates, today,
    ),
    [leftMonthDate, rangeStart, rangeEnd, hoverDate, closedDates, today],
  );

  const gridRight = useMemo(
    () => buildCalendarGrid(
      rightMonthDate.getFullYear(), rightMonthDate.getMonth(),
      rangeStart, rangeEnd, hoverDate, closedDates, today,
    ),
    [rightMonthDate, rangeStart, rangeEnd, hoverDate, closedDates, today],
  );

  const handleDayClick = useCallback(
    (d: Date) => {
      const day = new Date(d);
      day.setHours(0, 0, 0, 0);
      // Kelajak kunlarni tanlash mumkin emas
      if (day.getTime() > today.getTime()) return;

      if (!rangeStart || (rangeStart && rangeEnd)) {
        setRangeStart(day);
        setRangeEnd(null);
        setHoverDate(null);
      } else {
        if (isSameDay(day, rangeStart)) {
          setRangeEnd(day);
        } else if (day.getTime() < rangeStart.getTime()) {
          setRangeEnd(rangeStart);
          setRangeStart(day);
        } else {
          setRangeEnd(day);
        }
        setHoverDate(null);
      }
    },
    [rangeStart, rangeEnd, today],
  );

  const reset = () => { setRangeStart(null); setRangeEnd(null); setHoverDate(null); };
  const prevMonths = () => setCurrentMonthAnchor((m) => addMonths(m, -1));
  const nextMonths = () => {
    // Kelajak oyga o'tishni bloklash shart emas — navigatsiya ruxsat etiladi,
    // lekin kelajak sanalarni bosish bloklanadi
    setCurrentMonthAnchor((m) => addMonths(m, 1));
  };
  const goBugun = () => setCurrentMonthAnchor(startOfMonth(new Date()));

  const fmtLbl = useCallback(
    (d: Date) => `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`,
    [],
  );

  const selectionLabel = (): string => {
    if (!rangeStart) return "Kun tanlanmagan";
    if (!rangeEnd || isSameDay(rangeStart, rangeEnd)) return fmtLbl(rangeStart);
    return `${fmtLbl(rangeStart)} — ${fmtLbl(rangeEnd)}`;
  };

  const daySpanCount = (): number | null => {
    if (!rangeStart) return null;
    const s = rangeStart.getTime();
    const e = (rangeEnd ?? rangeStart).getTime();
    return Math.round((e - s) / 86400000) + 1;
  };

  const runExport = async (kind: "pdf" | "erju") => {
    if (!rangeStart) return;
    setBusy(kind);
    try {
      const s = new Date(rangeStart);
      s.setHours(0, 0, 0, 0);
      const lastDay = rangeEnd ?? rangeStart;
      const endNorm = new Date(lastDay);
      endNorm.setHours(0, 0, 0, 0);
      if (kind === "pdf") await Promise.resolve(onExportPdf(s, endNorm));
      else await Promise.resolve(onExportErjuPdf(s, endNorm));
      onClose();
    } finally {
      setBusy("");
    }
  };

  const renderGrid = (
    monthLabel: string,
    yearN: number,
    days: CalendarDayMeta[],
    monthIndex: number,
    renderedMonth: number,
    renderedYear: number,
  ) => {
    // Trailing kunlar: current month tugagandan keyingi kalit kunlar
    const lastOfMonth = new Date(renderedYear, renderedMonth + 1, 0);
    lastOfMonth.setHours(0, 0, 0, 0);

    return (
    <div className="flex-1 min-w-[260px] px-3 py-2">
      <h3 className="text-center font-bold text-base mb-3 text-black">
        {monthLabel} {yearN}
      </h3>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEK_DAYS.map((wd) => (
          <div key={wd + monthIndex} className="font-bold text-gray-500 text-xs py-1">
            {wd}
          </div>
        ))}
        {days.map((day, i) => {
          // Trailing kunlarni bo'sh katak sifatida ko'rsat
          const isTrailing = !day.isCurrentMonth && day.date.getTime() > lastOfMonth.getTime();
          if (isTrailing) {
            return <div key={`${monthIndex}-${i}-empty`} className="h-9 w-9 sm:h-10 sm:w-10 mx-auto" />;
          }

          const isDisabled = day.isFuture;

          const wrapperCls = [
            "relative flex items-center justify-center",
            day.isInRange && !isDisabled ? "bg-purple-100" : "",
          ].join(" ");

          let cellCls =
            "h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-full text-sm font-bold transition-colors z-10 select-none ";

          if (isDisabled) {
            cellCls += "text-gray-300 cursor-not-allowed ";
          } else if (!day.isCurrentMonth) {
            cellCls += "text-gray-400 opacity-60 cursor-pointer hover:bg-purple-50 ";
          } else if (day.isClosed) {
            cellCls += "bg-rose-100 text-rose-700 border border-rose-300 cursor-pointer hover:bg-rose-200 ";
          } else {
            cellCls += "text-gray-900 cursor-pointer hover:bg-purple-50 ";
          }

          if (!isDisabled && day.isSelected) {
            cellCls += "!bg-purple-600 !text-white shadow ";
          } else if (!isDisabled && day.isToday) {
            cellCls += "border-2 border-red-500 ";
          }

          return (
            <div key={`${monthIndex}-${i}-${day.iso}`} className={wrapperCls}>
              <button
                type="button"
                disabled={isDisabled}
                className={cellCls}
                onClick={() => handleDayClick(day.date)}
                onMouseEnter={() => {
                  if (!isDisabled && rangeStart && !rangeEnd) setHoverDate(day.date);
                }}
                onMouseLeave={() => {
                  if (rangeStart && !rangeEnd) setHoverDate(null);
                }}
              >
                {day.date.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10060] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
      role="presentation"
    >
      {/* Modal: flex-col, balandligi viewport ga moslashadi, scroll yo'q */}
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden"
        style={{ maxHeight: "min(96vh, 780px)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* ── Sarlavha ── */}
        <div className="flex justify-between items-center gap-3 px-4 py-3 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="font-black text-base text-slate-900">Taqvim</h2>
            <p className="text-[10px] text-slate-500 font-semibold">
              Kun yoki davr tanlang · PDF va Y.PDF
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goBugun}
              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-amber-100 text-amber-900 hover:bg-amber-200"
            >
              Bugun
            </button>
            <button
              type="button"
              aria-label="Yopish"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-red-600 text-white hover:bg-red-700 text-sm font-bold flex items-center justify-center"
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Oy navigatsiyasi ── */}
        <div className="flex justify-between items-center px-4 py-2 shrink-0">
          <button
            type="button"
            onClick={prevMonths}
            className="p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-black text-slate-700 uppercase tracking-wide">
            {MONTH_NAMES_UZ[leftMonthDate.getMonth()]} —{" "}
            {MONTH_NAMES_UZ[rightMonthDate.getMonth()]} {leftMonthDate.getFullYear()}
            {leftMonthDate.getFullYear() !== rightMonthDate.getFullYear()
              ? ` / ${rightMonthDate.getFullYear()}`
              : ""}
          </span>
          <button
            type="button"
            onClick={nextMonths}
            className="p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* ── Taqvim panjarasi — bu qism flex-1 bilan qolgan joyni egallaydi ── */}
        <div className="flex flex-col lg:flex-row px-2 flex-1 min-h-0 overflow-y-auto">
          {renderGrid(MONTH_NAMES_UZ[leftMonthDate.getMonth()], leftMonthDate.getFullYear(), gridLeft, 0, leftMonthDate.getMonth(), leftMonthDate.getFullYear())}
          <div className="hidden lg:block w-px bg-slate-200 shrink-0 my-2" />
          {renderGrid(MONTH_NAMES_UZ[rightMonthDate.getMonth()], rightMonthDate.getFullYear(), gridRight, 1, rightMonthDate.getMonth(), rightMonthDate.getFullYear())}
        </div>

        {/* ── Legend + Tanlov + Tugmalar — har doim pastda ko'rinadi ── */}
        <div className="shrink-0 border-t border-slate-100 px-4 pt-2 pb-3 space-y-2">
          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-[9px] font-bold text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-200 border border-rose-400" />
              Yopilgan kun
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full border-2 border-red-500 bg-white" />
              Bugun
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-600" />
              Tanlangan
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-200" />
              Kelmagan kun
            </span>
          </div>

          {/* Tanlov ma'lumoti */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <span className="text-[9px] font-black uppercase text-slate-400">Tanlangan: </span>
            <span className="text-xs font-bold text-slate-900">{selectionLabel()}</span>
            {rangeStart && !rangeEnd && (
              <span className="text-[9px] text-slate-400 ml-2">· tugash uchun ikkinchi kunni tanlang</span>
            )}
            {rangeStart && rangeEnd && daySpanCount() !== null && (
              <span className="text-[9px] text-slate-400 ml-2">· {daySpanCount()} kun</span>
            )}
          </div>

          {/* Tugmalar */}
          <div className="flex justify-between items-center gap-2 flex-wrap">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-xl text-[10px] font-black uppercase bg-blue-600 text-white hover:bg-blue-700"
              >
                Bekor
              </button>
              <button
                type="button"
                onClick={reset}
                className="px-3 py-2 rounded-xl text-[10px] font-black uppercase bg-red-500 text-white hover:bg-red-600"
              >
                Reset
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!rangeStart || !!busy}
                onClick={() => void runExport("pdf")}
                className="px-5 py-2 rounded-xl text-[10px] font-black uppercase bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 min-w-[80px]"
              >
                {busy === "pdf" ? "..." : "PDF"}
              </button>
              <button
                type="button"
                disabled={!rangeStart || !!busy}
                onClick={() => void runExport("erju")}
                className="px-5 py-2 rounded-xl text-[10px] font-black uppercase bg-fuchsia-600 text-white hover:bg-fuchsia-500 disabled:opacity-40 min-w-[80px]"
              >
                {busy === "erju" ? "..." : "Y.PDF"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
