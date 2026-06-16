"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  HARAKAT_TURI_LIST,
  LOKOMOTIV_JADVAL_OPTIONS,
  RUSUMI_LIST,
  RUSUMI_FILTER,
  FIELDS_VISIBILITY
} from "@/lib/data/lokomotiv-config";
import { addLokomotivSubmission } from "@/lib/firebase/lokomotiv-service";
import {
  subscribeLokomotivRusumSettings,
  type LokomotivRusumSettings,
} from "@/lib/firebase/lokomotiv-rusum-service";
import { getSession } from "@/lib/utils/session";
import { parsePdfNumber } from "@/lib/utils/pdf-number";
import { savePendingSubmission } from "@/lib/offline/offline-storage";
import { HarakatTuri, Rusumi, LokomotivSubmission } from "@/lib/types";
import { CheckCircle2, AlertCircle, Loader2, ChevronDown } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { doc, getDoc } from "firebase/firestore";

interface LokomotivFormProps {
  stationId: string;
  onSaved?: () => void;
}

const HARAKAT_TURI_CYRILLIC: Record<string, string> = {
  yuk: "\u0413\u0420\u0423\u0417\u041e\u0412\u041e\u0419",
  manyovr: "\u041c\u0410\u041d\u0415\u0412\u0420",
  yolovchi: "\u041f\u0410\u0421\u0421\u0410\u0416\u0418\u0420\u0421\u041a\u0418\u0419",
  xojalik: "\u0425\u041e\u0417\u042f\u0419\u0421\u0422\u0412\u0415\u041d\u041d\u042b\u0419",
  ijara: "\u0410\u0420\u0415\u041d\u0414\u0410",
};

const HARAKAT_TURI_CARD_COLOR: Record<string, string> = {
  yuk: "bg-blue-700 border-blue-800 shadow-blue-900/25",
  manyovr: "bg-orange-600 border-orange-700 shadow-orange-900/25",
  yolovchi: "bg-red-500 border-red-700 shadow-red-900/25",
  xojalik: "bg-emerald-600 border-emerald-700 shadow-emerald-900/25",
  ijara: "bg-violet-700 border-violet-800 shadow-violet-900/25",
};

const OPTIONAL_LOKOMOTIV_FIELDS = new Set(["poyezdNumber", "jadval", "zagranitsa"]);
const DECIMAL_LOKOMOTIV_FIELDS = new Set(["zagranitsa", "poyezdVazni", "qoldiq", "qanchaBerildi", "dizMasla"]);

function isLokomotivFieldOptional(field: string, harakatTuri: HarakatTuri | "") {
  return OPTIONAL_LOKOMOTIV_FIELDS.has(field) || (harakatTuri === "yuk" && field === "dizMasla");
}

type RusumiOption = {
  value: Rusumi;
  label: string;
  number: number;
  code?: string;
  custom?: boolean;
};

function rusumiOptionCode(item: RusumiOption): string {
  return String(item.code ?? item.number);
}

function formatRusumiComboValue(item: RusumiOption): string {
  return `${rusumiOptionCode(item)} - ${item.label}`;
}

function normalizeRusumiSearch(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

const INPUT_TONE_BY_FIELD: Record<string, { idle: string; filled: string; active: string; badge: string; activeBadge: string }> = {
  lokomotivNumber: {
    idle: "border-blue-300/80 bg-blue-50/70 text-blue-950 hover:border-blue-500 dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-50",
    filled: "border-blue-500/80 bg-blue-100/80 text-blue-950 shadow-sm shadow-blue-500/10 dark:border-blue-300/60 dark:bg-blue-500/15 dark:text-blue-50",
    active: "border-blue-600 bg-blue-100 text-blue-950 ring-4 ring-blue-500/20 shadow-md shadow-blue-500/15 dark:border-blue-300 dark:bg-blue-500/20 dark:text-blue-50",
    badge: "bg-blue-600 shadow-blue-500/20",
    activeBadge: "bg-blue-500 ring-2 ring-blue-200 shadow-blue-500/40",
  },
  rusumi: {
    idle: "border-indigo-300/80 bg-indigo-50/70 text-indigo-950 hover:border-indigo-500 dark:border-indigo-400/40 dark:bg-indigo-500/10 dark:text-indigo-50",
    filled: "border-indigo-500/80 bg-indigo-100/80 text-indigo-950 shadow-sm shadow-indigo-500/10 dark:border-indigo-300/60 dark:bg-indigo-500/15 dark:text-indigo-50",
    active: "border-indigo-600 bg-indigo-100 text-indigo-950 ring-4 ring-indigo-500/20 shadow-md shadow-indigo-500/15 dark:border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-50",
    badge: "bg-indigo-600 shadow-indigo-500/20",
    activeBadge: "bg-indigo-500 ring-2 ring-indigo-200 shadow-indigo-500/40",
  },
  jadval: {
    idle: "border-violet-300/80 bg-violet-50/70 text-violet-950 hover:border-violet-500 dark:border-violet-400/40 dark:bg-violet-500/10 dark:text-violet-50",
    filled: "border-violet-500/80 bg-violet-100/80 text-violet-950 shadow-sm shadow-violet-500/10 dark:border-violet-300/60 dark:bg-violet-500/15 dark:text-violet-50",
    active: "border-violet-600 bg-violet-100 text-violet-950 ring-4 ring-violet-500/20 shadow-md shadow-violet-500/15 dark:border-violet-300 dark:bg-violet-500/20 dark:text-violet-50",
    badge: "bg-violet-600 shadow-violet-500/20",
    activeBadge: "bg-violet-500 ring-2 ring-violet-200 shadow-violet-500/40",
  },
  zagranitsa: {
    idle: "border-sky-300/80 bg-sky-50/70 text-sky-950 hover:border-sky-500 dark:border-sky-400/40 dark:bg-sky-500/10 dark:text-sky-50",
    filled: "border-sky-500/80 bg-sky-100/80 text-sky-950 shadow-sm shadow-sky-500/10 dark:border-sky-300/60 dark:bg-sky-500/15 dark:text-sky-50",
    active: "border-sky-600 bg-sky-100 text-sky-950 ring-4 ring-sky-500/20 shadow-md shadow-sky-500/15 dark:border-sky-300 dark:bg-sky-500/20 dark:text-sky-50",
    badge: "bg-sky-600 shadow-sky-500/20",
    activeBadge: "bg-sky-500 ring-2 ring-sky-200 shadow-sky-500/40",
  },
  poyezdNumber: {
    idle: "border-fuchsia-300/80 bg-fuchsia-50/70 text-fuchsia-950 hover:border-fuchsia-500 dark:border-fuchsia-400/40 dark:bg-fuchsia-500/10 dark:text-fuchsia-50",
    filled: "border-fuchsia-500/80 bg-fuchsia-100/80 text-fuchsia-950 shadow-sm shadow-fuchsia-500/10 dark:border-fuchsia-300/60 dark:bg-fuchsia-500/15 dark:text-fuchsia-50",
    active: "border-fuchsia-600 bg-fuchsia-100 text-fuchsia-950 ring-4 ring-fuchsia-500/20 shadow-md shadow-fuchsia-500/15 dark:border-fuchsia-300 dark:bg-fuchsia-500/20 dark:text-fuchsia-50",
    badge: "bg-fuchsia-600 shadow-fuchsia-500/20",
    activeBadge: "bg-fuchsia-500 ring-2 ring-fuchsia-200 shadow-fuchsia-500/40",
  },
  ruxsatIndeksi: {
    idle: "border-indigo-300/80 bg-indigo-50/70 text-indigo-950 hover:border-indigo-500 dark:border-indigo-400/40 dark:bg-indigo-500/10 dark:text-indigo-50",
    filled: "border-indigo-500/80 bg-indigo-100/80 text-indigo-950 shadow-sm shadow-indigo-500/10 dark:border-indigo-300/60 dark:bg-indigo-500/15 dark:text-indigo-50",
    active: "border-indigo-600 bg-indigo-100 text-indigo-950 ring-4 ring-indigo-500/20 shadow-md shadow-indigo-500/15 dark:border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-50",
    badge: "bg-indigo-600 shadow-indigo-500/20",
    activeBadge: "bg-indigo-500 ring-2 ring-indigo-200 shadow-indigo-500/40",
  },
  poyezdVazni: {
    idle: "border-cyan-300/80 bg-cyan-50/70 text-cyan-950 hover:border-cyan-500 dark:border-cyan-400/40 dark:bg-cyan-500/10 dark:text-cyan-50",
    filled: "border-cyan-500/80 bg-cyan-100/80 text-cyan-950 shadow-sm shadow-cyan-500/10 dark:border-cyan-300/60 dark:bg-cyan-500/15 dark:text-cyan-50",
    active: "border-cyan-600 bg-cyan-100 text-cyan-950 ring-4 ring-cyan-500/20 shadow-md shadow-cyan-500/15 dark:border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-50",
    badge: "bg-cyan-600 shadow-cyan-500/20",
    activeBadge: "bg-cyan-500 ring-2 ring-cyan-200 shadow-cyan-500/40",
  },
  qoldiq: {
    idle: "border-amber-300/90 bg-amber-50/80 text-amber-950 hover:border-amber-500 dark:border-amber-400/50 dark:bg-amber-500/10 dark:text-amber-100",
    filled: "border-amber-500/90 bg-amber-100/90 text-amber-950 shadow-sm shadow-amber-500/10 dark:border-amber-300/60 dark:bg-amber-500/15 dark:text-amber-100",
    active: "border-amber-600 bg-amber-100 text-amber-950 ring-4 ring-amber-500/25 shadow-md shadow-amber-500/15 dark:border-amber-300 dark:bg-amber-500/20 dark:text-amber-100",
    badge: "bg-amber-500 shadow-amber-500/20",
    activeBadge: "bg-amber-500 ring-2 ring-amber-200 shadow-amber-500/40",
  },
  qanchaBerildi: {
    idle: "border-teal-300/90 bg-teal-50/80 text-teal-950 hover:border-teal-500 dark:border-teal-400/50 dark:bg-teal-500/10 dark:text-teal-100",
    filled: "border-teal-500/90 bg-teal-100/90 text-teal-950 shadow-sm shadow-teal-500/10 dark:border-teal-300/60 dark:bg-teal-500/15 dark:text-teal-100",
    active: "border-teal-600 bg-teal-100 text-teal-950 ring-4 ring-teal-500/25 shadow-md shadow-teal-500/15 dark:border-teal-300 dark:bg-teal-500/20 dark:text-teal-100",
    badge: "bg-teal-600 shadow-teal-500/20",
    activeBadge: "bg-teal-500 ring-2 ring-teal-200 shadow-teal-500/40",
  },
  dizMasla: {
    idle: "border-orange-300/80 bg-orange-50/70 text-orange-950 hover:border-orange-500 dark:border-orange-400/40 dark:bg-orange-500/10 dark:text-orange-50",
    filled: "border-orange-500/80 bg-orange-100/80 text-orange-950 shadow-sm shadow-orange-500/10 dark:border-orange-300/60 dark:bg-orange-500/15 dark:text-orange-50",
    active: "border-orange-600 bg-orange-100 text-orange-950 ring-4 ring-orange-500/20 shadow-md shadow-orange-500/15 dark:border-orange-300 dark:bg-orange-500/20 dark:text-orange-50",
    badge: "bg-orange-600 shadow-orange-500/20",
    activeBadge: "bg-orange-500 ring-2 ring-orange-200 shadow-orange-500/40",
  },
  stansiya: {
    idle: "border-emerald-300/80 bg-emerald-50/70 text-emerald-950 hover:border-emerald-500 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-50",
    filled: "border-emerald-500/80 bg-emerald-100/80 text-emerald-950 shadow-sm shadow-emerald-500/10 dark:border-emerald-300/60 dark:bg-emerald-500/15 dark:text-emerald-50",
    active: "border-emerald-600 bg-emerald-100 text-emerald-950 ring-4 ring-emerald-500/20 shadow-md shadow-emerald-500/15 dark:border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-50",
    badge: "bg-emerald-600 shadow-emerald-500/20",
    activeBadge: "bg-emerald-500 ring-2 ring-emerald-200 shadow-emerald-500/40",
  },
  tashkilot: {
    idle: "border-lime-300/80 bg-lime-50/70 text-lime-950 hover:border-lime-500 dark:border-lime-400/40 dark:bg-lime-500/10 dark:text-lime-50",
    filled: "border-lime-500/80 bg-lime-100/80 text-lime-950 shadow-sm shadow-lime-500/10 dark:border-lime-300/60 dark:bg-lime-500/15 dark:text-lime-50",
    active: "border-lime-600 bg-lime-100 text-lime-950 ring-4 ring-lime-500/20 shadow-md shadow-lime-500/15 dark:border-lime-300 dark:bg-lime-500/20 dark:text-lime-50",
    badge: "bg-lime-600 shadow-lime-500/20",
    activeBadge: "bg-lime-500 ring-2 ring-lime-200 shadow-lime-500/40",
  },
  ijarachi: {
    idle: "border-rose-300/80 bg-rose-50/70 text-rose-950 hover:border-rose-500 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-50",
    filled: "border-rose-500/80 bg-rose-100/80 text-rose-950 shadow-sm shadow-rose-500/10 dark:border-rose-300/60 dark:bg-rose-500/15 dark:text-rose-50",
    active: "border-rose-600 bg-rose-100 text-rose-950 ring-4 ring-rose-500/20 shadow-md shadow-rose-500/15 dark:border-rose-300 dark:bg-rose-500/20 dark:text-rose-50",
    badge: "bg-rose-600 shadow-rose-500/20",
    activeBadge: "bg-rose-500 ring-2 ring-rose-200 shadow-rose-500/40",
  },
  mashinaRaqami: {
    idle: "border-slate-300/80 bg-slate-50 text-slate-800 hover:border-indigo-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100",
    filled: "border-indigo-500/70 bg-indigo-50 text-indigo-950 shadow-sm shadow-indigo-500/10 dark:border-indigo-300/50 dark:bg-indigo-500/15 dark:text-indigo-50",
    active: "border-indigo-600 bg-indigo-100 text-indigo-950 ring-4 ring-indigo-500/20 shadow-md shadow-indigo-500/15 dark:border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-50",
    badge: "bg-indigo-600 shadow-indigo-500/20",
    activeBadge: "bg-indigo-500 ring-2 ring-indigo-200 shadow-indigo-500/40",
  },
  default: {
    idle: "border-slate-300/80 bg-slate-50 text-slate-900 hover:border-indigo-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100",
    filled: "border-emerald-500/70 bg-emerald-50 text-emerald-950 shadow-sm shadow-emerald-500/10 dark:border-emerald-300/50 dark:bg-emerald-500/15 dark:text-emerald-50",
    active: "border-indigo-600 bg-indigo-100 text-indigo-950 ring-4 ring-indigo-500/20 shadow-md shadow-indigo-500/15 dark:border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-50",
    badge: "bg-indigo-600 shadow-indigo-500/20",
    activeBadge: "bg-indigo-500 ring-2 ring-indigo-200 shadow-indigo-500/40",
  },
};

export default function LokomotivForm({ stationId, onSaved }: LokomotivFormProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [rusumSettings, setRusumSettings] = useState<LokomotivRusumSettings>({
    items: [],
    hiddenStaticValues: [],
  });
  
  const [formData, setFormData] = useState({
    harakatTuri: "" as HarakatTuri | "",
    rusumi: "" as Rusumi | "",
    lokomotivNumber: "",
    jadval: "",
    zagranitsa: "",
    poyezdNumber: "",
    ruxsatIndeksi: "",
    poyezdVazni: "",
    qoldiq: "",
    qanchaBerildi: "",
    dizMasla: "",
    stansiya: "",
    tashkilot: "",
    ijarachi: "",
    mashinadaYetkazildi: false,
    mashinaRaqami: "",
  });
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [rusumiQuery, setRusumiQuery] = useState("");
  const [rusumiLookupError, setRusumiLookupError] = useState("");
  const rusumiLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailsSectionRef = useRef<HTMLDivElement | null>(null);
  const rusumiInputRef = useRef<HTMLInputElement | null>(null);

  const [options, setOptions] = useState<{
    stansiyalar: string[];
    tashkilotlar: string[];
    ijarachilar: string[];
  }>({
    stansiyalar: [],
    tashkilotlar: [],
    ijarachilar: [],
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const docRef = doc(db, "settings", "global");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setOptions({
          stansiyalar: data.stansiyalar?.[stationId] || data.stansiyalar?.default || [],
          tashkilotlar: data.tashkilotlar?.[stationId] || data.tashkilotlar?.default || [],
          ijarachilar: data.ijarachilar?.[stationId] || data.ijarachilar?.default || [],
        });
      }
    };
    fetchSettings();

    const unsubscribeRusumlar = subscribeLokomotivRusumSettings(setRusumSettings);
    return () => {
      unsubscribeRusumlar();
    };
  }, [stationId]);

  const visibleFields = useMemo(() => {
    if (!formData.harakatTuri) return [];
    return FIELDS_VISIBILITY[formData.harakatTuri as HarakatTuri];
  }, [formData.harakatTuri]);

  const filteredRusumlar = useMemo(() => {
    if (!formData.harakatTuri) return [];
    const allowed = RUSUMI_FILTER[formData.harakatTuri as HarakatTuri];
    const hiddenStatic = new Set(rusumSettings.hiddenStaticValues.map((value) => value.toLowerCase()));
    const items: RusumiOption[] = RUSUMI_LIST.filter(
      (r) => allowed.includes(r.value) && !hiddenStatic.has(String(r.value).toLowerCase()),
    ).map((r) => ({
      value: r.value,
      label: r.label,
      number: r.number,
      custom: r.custom,
    }));
    const seen = new Set(items.map((r) => String(r.value).toLowerCase()));
    rusumSettings.items
      .filter((r) => r.harakatTurlari.includes(formData.harakatTuri as HarakatTuri))
      .forEach((r) => {
        const key = r.value.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        items.push({
          value: r.value as Rusumi,
          label: r.label,
          code: r.code,
          number: items.length + 1,
          custom: true,
        });
      });
    return items.map((item, index) => ({
      ...item,
      number: item.custom && item.code ? item.number : index + 1,
    }));
  }, [formData.harakatTuri, rusumSettings]);

  const getRusumiMatches = (raw: string) => {
    const q = normalizeRusumiSearch(raw);
    if (!q) return filteredRusumlar;

    return filteredRusumlar.filter((item) => {
      const code = rusumiOptionCode(item);
      const label = normalizeRusumiSearch(item.label);
      const value = normalizeRusumiSearch(item.value);
      const combo = normalizeRusumiSearch(formatRusumiComboValue(item));
      return code.includes(q) || label.includes(q) || value.includes(q) || combo.includes(q);
    });
  };

  const visibleRusumiOptions = useMemo(
    () => getRusumiMatches(rusumiQuery),
    [filteredRusumlar, rusumiQuery],
  );

  const findRusumiByComboText = (raw: string) => {
    const q = normalizeRusumiSearch(raw);
    if (!q) return undefined;

    return filteredRusumlar.find((item) => {
      const code = rusumiOptionCode(item);
      return (
        q === code ||
        q === normalizeRusumiSearch(item.label) ||
        q === normalizeRusumiSearch(item.value) ||
        q === normalizeRusumiSearch(formatRusumiComboValue(item))
      );
    });
  };

  const jadvalOptions = useMemo(() => {
    if (!formData.harakatTuri) return [];
    return LOKOMOTIV_JADVAL_OPTIONS[formData.harakatTuri as HarakatTuri] ?? [];
  }, [formData.harakatTuri]);

  const clearRusumiLookupTimer = () => {
    if (rusumiLookupTimer.current) {
      clearTimeout(rusumiLookupTimer.current);
      rusumiLookupTimer.current = null;
    }
  };

  useEffect(() => {
    return () => clearRusumiLookupTimer();
  }, []);

  const handleInputChange = (field: string, value: any) => {
    if (field === "harakatTuri") {
      clearRusumiLookupTimer();
      setRusumiQuery("");
      setRusumiLookupError("");
      setFormData(prev => ({ ...prev, harakatTuri: value, rusumi: "", jadval: "", zagranitsa: "" }));
      window.setTimeout(() => {
        detailsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      return;
    }

    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const selectRusumiOption = (item: RusumiOption) => {
    clearRusumiLookupTimer();
    setRusumiQuery(formatRusumiComboValue(item));
    setRusumiLookupError("");
    handleInputChange("rusumi", item.value);
  };

  const handleRusumiComboChange = (value: string) => {
    clearRusumiLookupTimer();
    setRusumiQuery(value);
    setRusumiLookupError("");

    const raw = value.trim();
    setFormData((prev) => ({ ...prev, rusumi: "" }));
    if (!raw) return;

    rusumiLookupTimer.current = setTimeout(() => {
      const exact = findRusumiByComboText(raw);
      if (exact) {
        selectRusumiOption(exact);
        return;
      }

      const matches = getRusumiMatches(raw);
      if (matches.length === 1) {
        selectRusumiOption(matches[0]);
        return;
      }

      setRusumiLookupError("Bunday rusum topilmadi");
    }, 1000);
  };

  const handleRusumiComboBlur = () => {
    clearRusumiLookupTimer();
    handleFieldBlur("rusumi");
    const raw = rusumiQuery.trim();
    if (!raw) {
      setRusumiLookupError("");
      setFormData((prev) => ({ ...prev, rusumi: "" }));
      return;
    }

    const exact = findRusumiByComboText(raw);
    if (exact) {
      selectRusumiOption(exact);
      return;
    }

    if (visibleRusumiOptions.length === 1) {
      selectRusumiOption(visibleRusumiOptions[0]);
      return;
    }

    setRusumiLookupError("Bunday rusum topilmadi");
    setFormData((prev) => ({ ...prev, rusumi: "" }));
  };

  const handleRusumiComboKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      clearRusumiLookupTimer();
      const exact = findRusumiByComboText(rusumiQuery);
      if (exact) {
        e.preventDefault();
        selectRusumiOption(exact);
        return;
      }
      if (visibleRusumiOptions.length === 1) {
        e.preventDefault();
        selectRusumiOption(visibleRusumiOptions[0]);
        return;
      }
    }

    handleKeyDown(e);
  };

  const validate = () => {
    if (!formData.harakatTuri) return "Harakat turini tanlang";
    if (!formData.rusumi) return rusumiQuery.trim() ? "Bunday rusum topilmadi" : "Rusumni tanlang";
    
    for (const field of visibleFields) {
      if (!formData[field as keyof typeof formData] && !isLokomotivFieldOptional(field, formData.harakatTuri)) {
        return "Barcha maydonlarni to'ldiring";
      }
    }
    
    if (formData.mashinadaYetkazildi && !formData.mashinaRaqami) {
      return "Mashina raqamini kiriting";
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("[Lokomotiv] Saqlash bosildi, formData:", formData);

    const errorMsg = validate();
    if (errorMsg) {
      console.warn("[Lokomotiv] Validatsiya xatosi:", errorMsg);
      setError(errorMsg);
      // Foydalanuvchi xatoni ko'rishi uchun shu sahifaning yuqorisiga skroll qilamiz
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setError("");
    setLoading(true);

    const session = getSession();
    if (!session) {
      setError("Sessiya muddati tugagan. Qayta kiring.");
      setLoading(false);
      return;
    }

    const submissionData: Omit<LokomotivSubmission, 'id' | 'timestamp' | 'createdAt'> = {
      staffCode: session.code,
      staffName: session.displayName,
      nodeId: session.nodeId!,
      stationId: stationId,
      category: 'lokomotiv',
      harakatTuri: formData.harakatTuri as HarakatTuri,
      rusumi: formData.rusumi as Rusumi,
      lokomotivNumber: formData.lokomotivNumber,
      jadval: formData.jadval || undefined,
      zagranitsa: formData.zagranitsa ? parsePdfNumber(formData.zagranitsa) : undefined,
      poyezdNumber: formData.poyezdNumber || undefined,
      ruxsatIndeksi: formData.ruxsatIndeksi || undefined,
      poyezdVazni: formData.poyezdVazni ? parsePdfNumber(formData.poyezdVazni) : undefined,
      qoldiq: parsePdfNumber(formData.qoldiq),
      qanchaBerildi: parsePdfNumber(formData.qanchaBerildi),
      dizMasla: parsePdfNumber(formData.dizMasla),
      stansiya: formData.stansiya || undefined,
      tashkilot: formData.tashkilot || undefined,
      ijarachi: formData.ijarachi || undefined,
      mashinadaYetkazildi: formData.mashinadaYetkazildi,
      mashinaRaqami: formData.mashinaRaqami || undefined,
    };

    try {
      if (navigator.onLine) {
        console.log("[Lokomotiv] Firestore'ga yuborilmoqda...", submissionData);
        const submissionId = await addLokomotivSubmission(submissionData);
        console.log("[Lokomotiv] Saqlandi, ID:", submissionId);

      } else {
        console.log("[Lokomotiv] Offline rejim, IndexedDB'ga yozilmoqda");
        await savePendingSubmission(submissionData);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      handleReset();
      onSaved?.();
    } catch (err: any) {
      console.error("[Lokomotiv] Saqlash xatosi:", err);
      // Firestore rules permission-denied bo'lsa — offline'ga fallback
      const isPermissionError =
        err?.code === "permission-denied" ||
        err?.message?.includes("permissions") ||
        err?.message?.includes("PERMISSION_DENIED");

      if (isPermissionError) {
        try {
          await savePendingSubmission(submissionData);
          setError(
            "Firestore ruxsat bermadi (Anonymous Auth yoqilmagan bo'lishi mumkin). " +
              "Yozuv qurilmaga vaqtincha saqlandi va internet/auth tiklangach yuklab yuboriladi."
          );
        } catch (offlineErr) {
          setError("Saqlab bo'lmadi: " + (err.message || "Noma'lum xato"));
        }
      } else {
        setError("Xato yuz berdi: " + (err.message || err.code || "Noma'lum"));
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const form = e.currentTarget.closest("form");
    if (!form) return;
    const inputs = Array.from(form.querySelectorAll<HTMLElement>("input:not([type=hidden]), select"));
    const idx = inputs.indexOf(e.currentTarget);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (idx !== -1 && idx < inputs.length - 1) inputs[idx + 1].focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (idx > 0) inputs[idx - 1].focus();
    }
  };

  const handleReset = () => {
    setFormData({
      harakatTuri: "",
      rusumi: "",
      lokomotivNumber: "",
      jadval: "",
      zagranitsa: "",
      poyezdNumber: "",
      ruxsatIndeksi: "",
      poyezdVazni: "",
      qoldiq: "",
      qanchaBerildi: "",
      dizMasla: "",
      stansiya: "",
      tashkilot: "",
      ijarachi: "",
      mashinadaYetkazildi: false,
      mashinaRaqami: "",
    });
    setError("");
    setFocusedField(null);
    setRusumiQuery("");
    setRusumiLookupError("");
  };

  const handleFieldBlur = (field: string) => {
    setFocusedField((current) => (current === field ? null : current));
  };

  const machineInputTone = INPUT_TONE_BY_FIELD.mashinaRaqami;
  const machineInputColorClass = focusedField === "mashinaRaqami"
    ? machineInputTone.active
    : formData.mashinaRaqami
      ? machineInputTone.filled
      : machineInputTone.idle;
  const isYukHarakat = formData.harakatTuri === "yuk";
  return (
    <form onSubmit={handleSubmit} className="space-y-3 animate-in fade-in duration-500">
      {/* Top Sticky Error Banner — har doim ko'rinadi */}
      {error && (
        <div className="sticky top-4 z-30 bg-gradient-to-r from-red-600 to-rose-600 text-white p-4 sm:p-5 rounded-2xl shadow-2xl shadow-red-500/30 flex items-start gap-3 font-bold animate-in slide-in-from-top-4 duration-300 ring-1 ring-white/25">
          <span className="grid place-items-center w-9 h-9 shrink-0 rounded-xl bg-white/15">
            <AlertCircle className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-black uppercase tracking-wide text-xs mb-0.5">Xato</p>
            <p className="text-sm font-semibold leading-relaxed">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Yopish"
            className="shrink-0 hover:bg-white/15 rounded-lg p-1.5 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Harakat Turi */}
      <div className="harakat-panel overflow-hidden rounded-2xl border border-white/10 bg-black shadow-lg shadow-black/20">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-1.5 sm:px-4">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-white text-[11px] font-black text-black shadow-md">
            1
          </span>
          <h3 className="text-[11px] font-black uppercase tracking-wide text-white sm:text-xs">
            ҲАРАКАТ ТУРИ
          </h3>
        </div>
        <div className="p-2 sm:p-2.5">
          <div className="grid w-full grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 lg:grid-cols-5">
            {HARAKAT_TURI_LIST.map((item) => {
              const active = formData.harakatTuri === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleInputChange("harakatTuri", item.value)}
                  className={`harakat-type-card relative flex min-h-[44px] items-center justify-center gap-2 overflow-hidden rounded-xl border px-2 py-1 text-white shadow-md transition-none sm:min-h-[48px] xl:min-h-[50px] ${HARAKAT_TURI_CARD_COLOR[item.value] ?? "bg-slate-700 border-slate-800"} ${
                    active ? "brightness-105 ring-2 ring-white/90 ring-offset-1 ring-offset-black" : "opacity-95"
                  }`}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-sm font-black text-white ring-1 ring-white/25 sm:h-8 sm:w-8 sm:text-base"
                  >
                    {item.number}
                  </span>
                  <span className="min-w-0 truncate text-center text-[12px] font-black uppercase leading-tight tracking-wide text-white sm:text-[13px] xl:text-sm">
                    {HARAKAT_TURI_CYRILLIC[item.value] ?? item.label}
                  </span>
                  {active && (
                    <>
                      <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-white text-black shadow-sm">
                        <CheckCircle2 className="h-3 w-3 stroke-[3]" />
                      </span>
                      <span className="absolute bottom-1 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-white/85" />
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {formData.harakatTuri && (
        <>
          {/* Dynamic Fields — yagona bo'lim ichida guruhlangan */}
          <div
            ref={detailsSectionRef}
            className="w-full scroll-mt-4 bg-white/90 dark:bg-white/[0.06] backdrop-blur-md rounded-3xl border border-black/5 dark:border-white/10 shadow-xl overflow-visible animate-in slide-in-from-top-8 duration-500"
          >
            <div className="flex items-center gap-2.5 px-4 sm:px-5 py-2.5 border-b border-black/5 dark:border-white/10 bg-gradient-to-r from-emerald-500/10 to-transparent">
              <span className="grid place-items-center h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white text-xs font-black shadow-md shadow-emerald-500/30">
                3
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-wide uppercase">
                Ma&apos;lumotlar
              </h3>
            </div>
            <div className={`grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3 ${
              isYukHarakat ? "xl:grid-cols-[repeat(20,minmax(0,1fr))]" : "xl:grid-cols-4 2xl:grid-cols-5"
            }`}>
              <div className={`flex min-w-0 flex-col ${isYukHarakat ? "xl:col-span-5" : ""}`}>
                <label
                  className={`mb-1 flex items-center gap-1.5 text-[11px] font-black tracking-wide uppercase transition-colors ${
                    focusedField === "rusumi" ? "text-slate-950 dark:text-white" : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-lg text-[10px] text-white shadow-sm transition-all ${
                      focusedField === "rusumi"
                        ? INPUT_TONE_BY_FIELD.rusumi.activeBadge
                        : INPUT_TONE_BY_FIELD.rusumi.badge
                    }`}
                  >
                    2
                  </span>
                  <span className="truncate">Rusumi</span>
                </label>
                <div className="relative z-50">
                  <input
                    ref={rusumiInputRef}
                    type="text"
                    inputMode="search"
                    value={rusumiQuery}
                    onChange={(e) => handleRusumiComboChange(e.target.value)}
                    onKeyDown={handleRusumiComboKeyDown}
                    onFocus={() => setFocusedField("rusumi")}
                    onBlur={handleRusumiComboBlur}
                    placeholder="Raqam yoki rusum nomi"
                    className={`h-14 w-full rounded-2xl border-2 px-4 py-3 pr-14 text-lg font-black shadow-sm transition-all placeholder:text-slate-400 placeholder:font-black focus:outline-none ${
                      focusedField === "rusumi"
                        ? INPUT_TONE_BY_FIELD.rusumi.active
                        : formData.rusumi
                          ? INPUT_TONE_BY_FIELD.rusumi.filled
                          : INPUT_TONE_BY_FIELD.rusumi.idle
                    }`}
                  />
                  <button
                    type="button"
                    aria-label="Rusumlarni ochish"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setFocusedField("rusumi");
                      rusumiInputRef.current?.focus();
                    }}
                    className={`absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl border shadow-sm transition-colors ${
                      focusedField === "rusumi"
                        ? "border-indigo-300 bg-indigo-600 text-white"
                        : "border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 dark:border-indigo-400/30 dark:bg-slate-900 dark:text-indigo-200"
                    }`}
                  >
                    <ChevronDown className="h-5 w-5 stroke-[3]" />
                  </button>
                  {focusedField === "rusumi" && (
                    <div className="absolute left-0 top-[calc(100%+8px)] z-50 max-h-64 w-[min(82vw,32rem)] overflow-y-auto rounded-2xl border-2 border-indigo-200 bg-white p-1.5 shadow-2xl shadow-indigo-950/20 dark:border-indigo-400/30 dark:bg-slate-950">
                      {visibleRusumiOptions.length > 0 ? (
                        visibleRusumiOptions.slice(0, 10).map((item) => {
                          const active = formData.rusumi === item.value;
                          return (
                            <button
                              key={`${rusumiOptionCode(item)}-${item.value}`}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                selectRusumiOption(item);
                              }}
                              className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left text-base font-black transition-colors ${
                                active
                                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                                  : "text-slate-800 hover:bg-indigo-50 dark:text-slate-100 dark:hover:bg-indigo-500/15"
                              }`}
                            >
                              <span className="truncate">{item.label}</span>
                              <span className={`shrink-0 rounded-lg px-2.5 py-1 text-sm ${active ? "bg-white/20" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200"}`}>
                                {rusumiOptionCode(item)}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-3 py-2 text-sm font-black text-rose-600 dark:text-rose-300">
                          Bunday rusum topilmadi
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {rusumiLookupError && (
                  <p className="mt-1 text-[11px] font-black text-rose-600 dark:text-rose-300">
                    {rusumiLookupError}
                  </p>
                )}
              </div>
              {visibleFields.map((field, idx) => {
                const n = idx + 3;
                let label = "";
                let placeholder = "";
                let type = "text";
                let listId = "";

                switch (field) {
                  case "lokomotivNumber": label = "Lokomotiv raqami"; placeholder = "6553"; break;
                  case "jadval": label = "Депони танланг"; placeholder = "Депони танланг"; break;
                  case "zagranitsa": label = "Zagranitsa"; placeholder = "0"; type = "number"; break;
                  case "poyezdNumber": label = "Poyezd raqami"; placeholder = "chuqursoy"; break;
                  case "ruxsatIndeksi": label = "Ruxsat indeksi"; placeholder = "3001-T"; break;
                  case "poyezdVazni": label = "Poyezd vazni, tonna"; placeholder = "5000"; type = "number"; break;
                  case "qoldiq": label = "Qoldiq, kg"; placeholder = "0"; type = "number"; break;
                  case "qanchaBerildi": label = "Qancha berildi, kg"; placeholder = "0"; type = "number"; break;
                  case "dizMasla": label = "Dizel masla, kg"; placeholder = "0"; type = "number"; break;
                  case "stansiya": label = "Stansiya"; placeholder = "Tanlang yoki yozing"; listId = "stansiyalar"; break;
                  case "tashkilot": label = "Tashkilot"; placeholder = "Tanlang yoki yozing"; listId = "tashkilotlar"; break;
                  case "ijarachi": label = "Ijarachi"; placeholder = "Tanlang yoki yozing"; listId = "ijarachilar"; break;
                }

                const filled = !!formData[field as keyof typeof formData];
                const isFocused = focusedField === field;
                const isJadvalSelect = field === "jadval";
                const isNumberField = type === "number";
                const isQoldiqField = field === "qoldiq";
                const isQanchaBerildiField = field === "qanchaBerildi";
                const tone = INPUT_TONE_BY_FIELD[field] ?? INPUT_TONE_BY_FIELD.default;
                const inputColorClass = isFocused ? tone.active : filled ? tone.filled : tone.idle;
                const badgeColorClass = isFocused ? tone.activeBadge : tone.badge;
                const isYukCompactRow = isYukHarakat && (
                  field === "poyezdVazni" ||
                  field === "qoldiq" ||
                  field === "qanchaBerildi" ||
                  field === "dizMasla" ||
                  field === "zagranitsa"
                );
                const fieldInputSizeClass = isYukCompactRow
                  ? "h-11 px-3 py-2.5 text-sm xl:text-[15px]"
                  : "h-12 px-3.5 py-3 text-base";
                const yukGridClass = isYukHarakat
                  ? isYukCompactRow
                    ? field === "poyezdVazni"
                      ? "xl:col-span-4 xl:col-start-1"
                      : "xl:col-span-4"
                    : "xl:col-span-5"
                  : "";

                return (
                  <div
                    key={field}
                    className={`flex min-w-0 flex-col ${yukGridClass}`}
                  >
                    <label
                      className={`mb-1 flex items-center gap-1.5 text-[11px] font-black tracking-wide uppercase transition-colors ${
                        isFocused ? "text-slate-950 dark:text-white" : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-lg text-[10px] text-white shadow-sm transition-all ${badgeColorClass}`}
                      >
                        {n}
                      </span>
                      <span className="truncate">{label}</span>
                    </label>
                    {isJadvalSelect ? (
                      <select
                        value={formData.jadval}
                        onChange={(e) => handleInputChange("jadval", e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setFocusedField(field)}
                        onBlur={() => handleFieldBlur(field)}
                        className={`${fieldInputSizeClass} w-full rounded-xl border font-black transition-all focus:outline-none disabled:cursor-not-allowed disabled:text-slate-400 ${inputColorClass}`}
                        disabled={jadvalOptions.length === 0}
                      >
                        <option value="">
                          {jadvalOptions.length === 0 ? "Jadval keyin qo'shiladi" : placeholder}
                        </option>
                        {jadvalOptions.map((option, index) => (
                          <option key={`${option}-${index}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={isNumberField ? "text" : type}
                        inputMode={isNumberField ? "decimal" : undefined}
                        step={isNumberField ? "any" : undefined}
                        value={formData[field as keyof typeof formData] as string}
                        onChange={(e) => {
                          const value = DECIMAL_LOKOMOTIV_FIELDS.has(field)
                            ? e.target.value.replace(/[^0-9.,]/g, "")
                            : e.target.value;
                          handleInputChange(field, value);
                        }}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setFocusedField(field)}
                        onBlur={() => handleFieldBlur(field)}
                        placeholder={placeholder}
                        list={listId}
                        className={`${fieldInputSizeClass} w-full rounded-xl border font-black transition-all placeholder:text-slate-400 placeholder:font-bold focus:outline-none ${inputColorClass} ${
                          isQoldiqField || isQanchaBerildiField ? "text-right tabular-nums" : ""
                        }`}
                      />
                    )}
                    {listId && (
                      <datalist id={listId}>
                        {options[listId as keyof typeof options].map((opt) => (
                          <option key={opt} value={opt} />
                        ))}
                      </datalist>
                    )}

                  </div>
                );
              })}

              {/* Mashinada yetkazildimi */}
              <div className={`rounded-2xl border border-black/5 bg-slate-50/80 p-2 dark:border-white/10 dark:bg-white/[0.03] sm:col-span-2 lg:col-span-3 ${
                isYukHarakat ? "xl:col-span-20" : "xl:col-span-4 2xl:col-span-5"
              }`}>
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                  <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-300 lg:w-[220px]">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-lg bg-indigo-600 text-[10px] text-white">
                      {visibleFields.length + 3}
                    </span>
                    <span className="truncate">Mashinada yetkazildimi?</span>
                  </label>
                  <div className="grid w-full grid-cols-2 gap-2 sm:max-w-[260px]">
                    <button
                      type="button"
                      aria-pressed={formData.mashinadaYetkazildi}
                      onClick={() => handleInputChange("mashinadaYetkazildi", true)}
                      className={`h-10 rounded-xl border text-sm font-black tracking-wider transition-all ${
                        formData.mashinadaYetkazildi
                          ? "bg-gradient-to-br from-indigo-500 to-blue-600 border-white/20 text-white shadow-md shadow-indigo-500/25"
                          : "bg-white dark:bg-white/[0.04] border-black/10 dark:border-white/10 hover:border-indigo-400/50 text-slate-600 dark:text-slate-300 hover:bg-indigo-500/5"
                      }`}
                    >
                      HA
                    </button>
                    <button
                      type="button"
                      aria-pressed={!formData.mashinadaYetkazildi}
                      onClick={() => handleInputChange("mashinadaYetkazildi", false)}
                      className={`h-10 rounded-xl border text-sm font-black tracking-wider transition-all ${
                        !formData.mashinadaYetkazildi
                          ? "bg-gradient-to-br from-rose-500 to-red-600 border-white/20 text-white shadow-md shadow-red-500/25"
                          : "bg-white dark:bg-white/[0.04] border-black/10 dark:border-white/10 hover:border-red-400/50 text-slate-600 dark:text-slate-300 hover:bg-red-500/5"
                      }`}
                    >
                      YO&apos;Q
                    </button>
                  </div>

                  {formData.mashinadaYetkazildi && (
                    <input
                      type="text"
                      value={formData.mashinaRaqami}
                      onChange={(e) => handleInputChange("mashinaRaqami", e.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={() => setFocusedField("mashinaRaqami")}
                      onBlur={() => handleFieldBlur("mashinaRaqami")}
                      placeholder="MASHINA RAQAMI"
                      className={`h-10 w-full max-w-[340px] rounded-xl border px-3 py-2 text-sm font-black transition-all placeholder:text-slate-400 focus:outline-none ${machineInputColorClass}`}
                    />
                  )}

                  <div className="grid w-full grid-cols-2 gap-2 sm:max-w-[360px] lg:ml-auto">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="h-10 rounded-xl border border-black bg-black px-4 text-sm font-black uppercase tracking-wider text-white transition-none"
                    >
                      Tozalash
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 via-green-500 to-teal-600 px-4 text-sm font-black uppercase tracking-wider text-white shadow-md shadow-emerald-500/25 transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Saqlash"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Success Toast */}
          {success && (
            <div className="fixed bottom-24 sm:bottom-10 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-green-600 text-white px-8 py-4 rounded-2xl font-black shadow-2xl shadow-emerald-500/40 flex items-center gap-3 z-[60] animate-in slide-in-from-bottom-10 duration-500">
              <CheckCircle2 className="w-6 h-6" />
              SAQLANDI ✓
            </div>
          )}

          {/* Form Actions — sticky pastki panel */}
        </>
      )}
    </form>
  );
}
