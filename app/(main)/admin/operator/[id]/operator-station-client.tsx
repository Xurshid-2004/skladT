"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Fuel, MapPin, Send, X } from "lucide-react";

import AdminLayout from "@/components/admin/admin-layout";
import type { Zapravka } from "@/lib/types";

type OperatorStationClientProps = {
  card: Zapravka;
  erjuName: string;
  cards: Zapravka[];
};

type OperatorVaultProps = {
  open: boolean;
  title: string;
  accentClass: string;
  children: ReactNode;
  onClose: () => void;
};

type OperatorShipment = {
  id: string;
  fromStationId: string;
  fromStationName: string;
  toStationId: string;
  toStationName: string;
  amountKg: number;
  createdAt: number;
  status: "pending" | "accepted";
  acceptedAt?: number;
  acceptedKg?: number;
};

const OPERATOR_SHIPMENTS_KEY = "operator_pending_shipments";
const OPERATOR_BALANCES_KEY = "operator_station_fuel_balances";

function OperatorVault({ open, title, accentClass, children, onClose }: OperatorVaultProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[500] grid place-items-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-[2rem] bg-white p-5 text-slate-950 shadow-2xl shadow-slate-950/25"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className={`h-1.5 w-16 rounded-full ${accentClass}`} />
            <h2 className="mt-4 text-2xl font-black uppercase tracking-wide">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-950"
            aria-label="Yopish"
          >
            <X className="h-6 w-6" strokeWidth={3} />
          </button>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-5">{children}</div>
      </div>
    </div>
  );
}

function parseFuelAmount(value: string) {
  const parsed = Number(value.trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeFuelKg(kg: number) {
  return Math.round(kg * 1000) / 1000;
}

function formatFuelAmount(kg: number) {
  const value = kg >= 1000 ? kg / 1000 : kg;
  const unit = kg >= 1000 ? "T" : "kg";
  const rounded = Number(value.toFixed(3));
  const [whole, fraction = ""] = String(rounded).split(".");
  const cleanFraction = fraction.replace(/0+$/, "");

  return `${cleanFraction ? `${whole},${cleanFraction}` : whole} ${unit}`;
}

function splitFuelDisplay(value: string) {
  const [amount, unit = ""] = value.split(" ");
  return { amount, unit };
}

function getFuelFillPercent(kg: number | null) {
  if (kg === null) return 24;
  if (kg <= 0) return 8;

  return Math.min(88, Math.max(10, (kg / 5000) * 100));
}

function readOperatorShipments() {
  if (typeof window === "undefined") return [];

  try {
    const rawShipments = window.localStorage.getItem(OPERATOR_SHIPMENTS_KEY);
    if (!rawShipments) return [];

    const parsedShipments = JSON.parse(rawShipments);
    if (!Array.isArray(parsedShipments)) return [];

    return parsedShipments.filter((shipment): shipment is OperatorShipment => {
      return (
        shipment &&
        typeof shipment.id === "string" &&
        typeof shipment.fromStationId === "string" &&
        typeof shipment.fromStationName === "string" &&
        typeof shipment.toStationId === "string" &&
        typeof shipment.toStationName === "string" &&
        typeof shipment.amountKg === "number" &&
        typeof shipment.createdAt === "number" &&
        (shipment.status === "pending" || shipment.status === "accepted")
      );
    });
  } catch {
    return [];
  }
}

function writeOperatorShipments(shipments: OperatorShipment[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OPERATOR_SHIPMENTS_KEY, JSON.stringify(shipments));
  window.dispatchEvent(new Event("operatorShipmentsChanged"));
}

function readOperatorBalances() {
  if (typeof window === "undefined") return {};

  try {
    const rawBalances = window.localStorage.getItem(OPERATOR_BALANCES_KEY);
    if (!rawBalances) return {};

    const parsedBalances = JSON.parse(rawBalances);
    if (!parsedBalances || typeof parsedBalances !== "object" || Array.isArray(parsedBalances)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsedBalances)
        .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
        .map(([stationId, value]) => [stationId, normalizeFuelKg(value as number)]),
    ) as Record<string, number>;
  } catch {
    return {};
  }
}

function writeOperatorBalances(balances: Record<string, number>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OPERATOR_BALANCES_KEY, JSON.stringify(balances));
  window.dispatchEvent(new Event("operatorBalancesChanged"));
}

function setStationFuelBalance(stationId: string, amountKg: number) {
  const balances = readOperatorBalances();
  const nextBalances = {
    ...balances,
    [stationId]: Math.max(0, normalizeFuelKg(amountKg)),
  };

  writeOperatorBalances(nextBalances);
  return nextBalances;
}

function changeStationFuelBalance(stationId: string, deltaKg: number) {
  const balances = readOperatorBalances();
  const currentAmount = balances[stationId] ?? 0;
  const nextBalances = {
    ...balances,
    [stationId]: Math.max(0, normalizeFuelKg(currentAmount + deltaKg)),
  };

  writeOperatorBalances(nextBalances);
  return nextBalances;
}

function getPendingShipmentsForStation(stationId: string) {
  return readOperatorShipments()
    .filter((shipment) => shipment.toStationId === stationId && shipment.status === "pending")
    .sort((a, b) => a.createdAt - b.createdAt);
}

function createShipmentId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function OperatorStationClient({ card, erjuName, cards }: OperatorStationClientProps) {
  const stationOptions = cards.filter((station) => station.id !== "all-zapravkalar").slice(0, 20);
  const isAllStationsPage = card.id === "all-zapravkalar";
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveTransferOpen, setReceiveTransferOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [receiveAmount, setReceiveAmount] = useState("");
  const [receiveTransferAmount, setReceiveTransferAmount] = useState("");
  const [distributionAmount, setDistributionAmount] = useState("");
  const [receiveError, setReceiveError] = useState("");
  const [receiveTransferError, setReceiveTransferError] = useState("");
  const [distributionError, setDistributionError] = useState("");
  const [distributionSuccess, setDistributionSuccess] = useState("");
  const [stationBalances, setStationBalances] = useState<Record<string, number>>({});
  const [receiveStation, setReceiveStation] = useState("default");
  const [sendAmount, setSendAmount] = useState("");
  const [sendError, setSendError] = useState("");
  const [sendStation, setSendStation] = useState(stationOptions[0]?.id ?? "");
  const [distributionStation, setDistributionStation] = useState(stationOptions[0]?.id ?? "");
  const [sentStationName, setSentStationName] = useState("Yuborilmalar yo'q");
  const [incomingShipments, setIncomingShipments] = useState<OperatorShipment[]>([]);
  const activeIncomingShipment = incomingShipments[0] ?? null;
  const currentFuelKg = stationBalances[card.id] ?? 0;
  const gaugeValue = formatFuelAmount(currentFuelKg);
  const fuelDisplay = splitFuelDisplay(gaugeValue);
  const gaugeValueSizeClass = fuelDisplay.amount.length > 4 ? "text-[3.2rem]" : "text-[4.8rem]";
  const fuelFillPercent = getFuelFillPercent(currentFuelKg);

  useEffect(() => {
    const refreshBalances = () => {
      setStationBalances(readOperatorBalances());
    };

    refreshBalances();
    window.addEventListener("storage", refreshBalances);
    window.addEventListener("operatorBalancesChanged", refreshBalances);

    return () => {
      window.removeEventListener("storage", refreshBalances);
      window.removeEventListener("operatorBalancesChanged", refreshBalances);
    };
  }, []);

  useEffect(() => {
    const refreshIncomingShipments = () => {
      setIncomingShipments(getPendingShipmentsForStation(card.id));
    };

    refreshIncomingShipments();
    window.addEventListener("storage", refreshIncomingShipments);
    window.addEventListener("operatorShipmentsChanged", refreshIncomingShipments);

    return () => {
      window.removeEventListener("storage", refreshIncomingShipments);
      window.removeEventListener("operatorShipmentsChanged", refreshIncomingShipments);
    };
  }, [card.id]);

  const handleReceiveConfirm = () => {
    const parsedAmount = parseFuelAmount(receiveAmount);

    if (parsedAmount === null) {
      setReceiveError("Yoqilg'i miqdorini to'g'ri kiriting.");
      return;
    }

    setStationBalances(setStationFuelBalance(card.id, parsedAmount));
    setReceiveAmount("");
    setReceiveError("");
    setReceiveOpen(false);
  };

  const handleReceiveTransferConfirm = () => {
    const parsedAmount = parseFuelAmount(receiveTransferAmount);

    if (!activeIncomingShipment) {
      setReceiveTransferError("Sizga jo'natma yo'q.");
      return;
    }

    if (parsedAmount === null) {
      setReceiveTransferError("Qabul qilingan miqdorni to'g'ri kiriting.");
      return;
    }

    setStationBalances(changeStationFuelBalance(card.id, parsedAmount));

    const updatedShipments = readOperatorShipments().map((shipment) =>
      shipment.id === activeIncomingShipment.id
        ? {
            ...shipment,
            status: "accepted" as const,
            acceptedAt: Date.now(),
            acceptedKg: parsedAmount,
          }
        : shipment
    );

    writeOperatorShipments(updatedShipments);
    setIncomingShipments(getPendingShipmentsForStation(card.id));
    setReceiveTransferAmount("");
    setReceiveTransferError("");
    setReceiveTransferOpen(false);
  };

  const handleSendConfirm = () => {
    const parsedAmount = parseFuelAmount(sendAmount);
    const selectedStation = stationOptions.find((station) => station.id === sendStation);
    const currentBalance = stationBalances[card.id] ?? 0;

    if (parsedAmount === null) {
      setSendError("Yuboriladigan miqdorni to'g'ri kiriting.");
      return;
    }

    if (!selectedStation) {
      setSendError("Zapravkani tanlang.");
      return;
    }

    if (selectedStation.id === card.id) {
      setSendError("O'z zapravkangizga yoqilg'i yuborib bo'lmaydi.");
      return;
    }

    if (currentBalance <= 0) {
      setSendError("Bu zapravka hisobida yoqilg'i yo'q.");
      return;
    }

    if (parsedAmount > currentBalance) {
      setSendError("Balansda yetarli yoqilg'i yo'q.");
      return;
    }

    const newShipment: OperatorShipment = {
      id: createShipmentId(),
      fromStationId: card.id,
      fromStationName: card.name,
      toStationId: selectedStation.id,
      toStationName: selectedStation.name,
      amountKg: parsedAmount,
      createdAt: Date.now(),
      status: "pending",
    };

    setStationBalances(changeStationFuelBalance(card.id, -parsedAmount));
    writeOperatorShipments([...readOperatorShipments(), newShipment]);
    setSentStationName(selectedStation.name);
    setSendAmount("");
    setSendError("");
    setSendOpen(false);

    if (selectedStation.id === card.id) {
      setIncomingShipments(getPendingShipmentsForStation(card.id));
    }
  };

  const handleDistributionConfirm = () => {
    const parsedAmount = parseFuelAmount(distributionAmount);
    const selectedStation = stationOptions.find((station) => station.id === distributionStation);

    if (parsedAmount === null) {
      setDistributionError("Tarqatiladigan miqdorni to'g'ri kiriting.");
      setDistributionSuccess("");
      return;
    }

    if (!selectedStation) {
      setDistributionError("Zapravkani tanlang.");
      setDistributionSuccess("");
      return;
    }

    setStationBalances(changeStationFuelBalance(selectedStation.id, parsedAmount));
    setDistributionAmount("");
    setDistributionError("");
    setDistributionSuccess(`${selectedStation.name} zapravkasiga ${formatFuelAmount(parsedAmount)} qo'shildi.`);
  };

  if (isAllStationsPage) {
    return (
      <AdminLayout hideHeader>
        <div className="w-full max-w-[96rem] pb-3">
          <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-2xl shadow-slate-300/35">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 px-5 py-4">
              <div>
                <p className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">
                  Barcha zapravkalar
                </p>
                <h1 className="mt-2 text-3xl font-black uppercase leading-tight text-slate-950">
                  Tarqatish paneli
                </h1>
                <p className="mt-1 text-sm font-bold text-slate-600">
                  Tanlangan zapravkaga kiritilgan yoqilg'i miqdori qo'shiladi.
                </p>
              </div>

              <Link
                href="/admin/operator"
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-slate-950/18 transition hover:brightness-110"
              >
                <ArrowLeft className="h-4 w-4" />
                Orqaga
              </Link>
            </div>

            <div className="grid gap-4 px-5 py-5">
              <div className="grid gap-3 rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-700">Tarqatish</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={distributionAmount}
                    onChange={(event) => {
                      setDistributionAmount(event.target.value);
                      setDistributionError("");
                      setDistributionSuccess("");
                    }}
                    className="mt-2 h-14 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-xl font-black text-slate-950 outline-none transition focus:border-emerald-500"
                    placeholder="Masalan: 1500"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-700">
                    Qaysi zapravkaga
                  </span>
                  <select
                    value={distributionStation}
                    onChange={(event) => {
                      setDistributionStation(event.target.value);
                      setDistributionError("");
                      setDistributionSuccess("");
                    }}
                    className="mt-2 h-14 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-base font-black text-slate-950 outline-none transition focus:border-emerald-500"
                  >
                    {stationOptions.map((station) => (
                      <option key={station.id} value={station.id}>
                        {station.name}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={handleDistributionConfirm}
                  className="h-14 rounded-2xl bg-emerald-500 px-6 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400"
                >
                  Tarqatish
                </button>
              </div>

              {distributionError ? (
                <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-600">
                  {distributionError}
                </p>
              ) : null}
              {distributionSuccess ? (
                <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
                  {distributionSuccess}
                </p>
              ) : null}

              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-5">
                {stationOptions.map((station) => (
                  <div
                    key={station.id}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm"
                  >
                    <p className="line-clamp-1 text-sm font-black uppercase text-slate-950">{station.name}</p>
                    <p className="mt-1 text-xs font-black text-emerald-600">
                      {formatFuelAmount(stationBalances[station.id] ?? 0)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout hideHeader>
      <div className="w-full max-w-[96rem] pb-3">
        <section className="overflow-hidden rounded-[1.5rem] border border-white/40 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-3 text-white shadow-2xl shadow-slate-950/18 dark:border-white/10">
          <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
            <div className="flex min-h-[14rem] flex-col justify-between rounded-[1.2rem] border border-slate-200 bg-white/92 p-4 shadow-inner shadow-white/40 backdrop-blur">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-slate-950 shadow-sm">
                      Zapravka sahifasi
                    </p>
                    <h2 className="mt-3 break-words text-3xl font-black uppercase leading-tight tracking-normal text-slate-950">
                      {card.name}
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm font-black leading-5 text-slate-700">
                      Kunlik nazorat oynasi.
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <Link
                      href="/admin/operator"
                      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-slate-950/18 transition hover:brightness-110"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Orqaga
                    </Link>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={!activeIncomingShipment}
                    onClick={() => activeIncomingShipment && setReceiveTransferOpen(true)}
                    className={[
                      "inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-wide shadow-lg transition",
                      activeIncomingShipment
                        ? "bg-emerald-500 text-white shadow-emerald-900/30 hover:-translate-y-0.5 hover:bg-emerald-400"
                        : "cursor-not-allowed bg-slate-100 text-slate-400 shadow-slate-200/40",
                    ].join(" ")}
                  >
                    <Fuel className="h-5 w-5" strokeWidth={3} />
                    Sizga jo'natma bor
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendOpen(true)}
                    className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-3 text-sm font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-amber-900/30 transition hover:-translate-y-0.5 hover:bg-amber-300"
                  >
                    <Send className="h-5 w-5" strokeWidth={3} />
                    Diz.yuborish
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Zapravka</p>
                  <p className="mt-1 break-words text-lg font-black text-slate-950">{card.name}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Yuborilgan zapravka
                  </p>
                  <p className="mt-1 break-words text-lg font-black text-slate-950">
                    {sentStationName}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid place-items-center rounded-[1.5rem] border border-emerald-200/15 bg-[radial-gradient(circle_at_25%_10%,rgba(34,197,94,0.28),transparent_36%),linear-gradient(145deg,rgba(15,23,42,0.95),rgba(5,46,22,0.9))] p-4 shadow-[inset_0_2px_0_rgba(255,255,255,0.06),0_24px_55px_rgba(0,0,0,0.34)] backdrop-blur-sm">
              <div className="relative w-full max-w-[18rem] overflow-hidden rounded-[2rem] border border-emerald-200/15 bg-[#0c1820] p-4 shadow-[0_30px_70px_rgba(0,0,0,0.42)]">
                <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-400/18 blur-3xl" />
                <div className="absolute -bottom-20 left-8 h-44 w-44 rounded-full bg-cyan-400/14 blur-3xl" />

                <div className="relative z-10 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-200/80">
                      Yoqilg'i tanki
                    </p>
                    <p className="mt-1 text-sm font-black uppercase tracking-wide text-white/70">
                      {currentFuelKg <= 0 ? "Nazorat" : "Qabul qilingan"}
                    </p>
                  </div>
                  <div className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-200/20 bg-emerald-400/14 text-emerald-200">
                    <Fuel className="h-6 w-6" strokeWidth={2.7} />
                  </div>
                </div>

                <div className="relative z-10 mt-4 h-[15rem]">
                  <div className="absolute left-3 top-7 h-[10rem] w-3 rounded-full border border-emerald-100/55 bg-white/5">
                    <span className="absolute left-0 top-4 h-px w-6 bg-emerald-100/55" />
                    <span className="absolute left-0 top-10 h-px w-6 bg-emerald-100/55" />
                    <span className="absolute left-0 top-16 h-px w-6 bg-emerald-100/55" />
                    <span className="absolute left-0 top-[5.5rem] h-px w-6 bg-emerald-100/55" />
                  </div>

                  <div className="absolute inset-x-0 top-2 mx-auto h-12 w-[13.5rem] rounded-[50%] border-[5px] border-emerald-50/90 bg-[#101b25] shadow-[0_10px_24px_rgba(0,0,0,0.28)]" />
                  <div className="absolute inset-x-0 top-8 mx-auto h-[10.8rem] w-[13.5rem] overflow-hidden rounded-b-[2.1rem] border-x-[5px] border-b-[5px] border-emerald-50/90 bg-slate-950/80 shadow-[inset_0_0_30px_rgba(15,23,42,0.95)]">
                    <div
                      className="absolute inset-x-0 bottom-0 rounded-t-[46%] bg-gradient-to-t from-emerald-600 via-emerald-400 to-cyan-300 shadow-[0_-10px_30px_rgba(34,197,94,0.28)] transition-all duration-500"
                      style={{ height: `${fuelFillPercent}%` }}
                    >
                      <div className="absolute -top-3 left-[-8%] h-8 w-[116%] rounded-[50%] bg-cyan-100/55" />
                      <div className="absolute -top-1 right-[-12%] h-7 w-[92%] rounded-[50%] bg-cyan-300/75" />
                    </div>

                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08),transparent_18%,transparent_82%,rgba(255,255,255,0.08))]" />
                    <div className="absolute inset-0 grid place-items-center px-4 text-center">
                      <div className="rounded-[1.75rem] border border-white/12 bg-slate-950/58 px-5 py-4 shadow-[0_18px_34px_rgba(0,0,0,0.28)] backdrop-blur-sm">
                        <div className="flex max-w-[13rem] items-end justify-center gap-2 text-white">
                          <span className={`font-black leading-none tracking-normal ${gaugeValueSizeClass}`}>
                            {fuelDisplay.amount}
                          </span>
                          {fuelDisplay.unit ? (
                            <span className="mb-2 text-3xl font-black uppercase leading-none text-white/80">
                              {fuelDisplay.unit}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-100/80">
                          {currentFuelKg <= 0 ? "Kutilmoqda" : "Qabul qilingan"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 mx-auto flex w-fit items-center gap-2 rounded-full border border-emerald-100/18 bg-white/12 px-4 py-2 text-[12px] font-black uppercase tracking-wide text-white shadow-sm">
                    <MapPin className="h-4 w-4 text-emerald-300" />
                    {card.slug}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <OperatorVault
        open={receiveOpen}
        title="Qabul qilish"
        accentClass="bg-emerald-500"
        onClose={() => setReceiveOpen(false)}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-black uppercase tracking-wide text-slate-700">
              Qancha yoqilg'i keldi?
            </span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={receiveAmount}
              onChange={(event) => {
                setReceiveAmount(event.target.value);
                setReceiveError("");
              }}
              className="mt-2 h-14 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-xl font-black text-slate-950 outline-none transition focus:border-emerald-500 focus:bg-white"
            />
          </label>

          <label className="block">
            <span className="text-sm font-black uppercase tracking-wide text-slate-700">Zapravka</span>
            <select
              value={receiveStation}
              onChange={(event) => setReceiveStation(event.target.value)}
              className="mt-2 h-14 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-base font-black text-slate-950 outline-none transition focus:border-emerald-500 focus:bg-white"
            >
              <option value="default">Default</option>
              {stationOptions.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name}
                </option>
              ))}
            </select>
          </label>

          {receiveError ? (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-600">{receiveError}</p>
          ) : null}

          <button
            type="button"
            onClick={handleReceiveConfirm}
            className="h-14 w-full rounded-2xl bg-emerald-500 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400"
          >
            Qabul qildim
          </button>
        </div>
      </OperatorVault>

      <OperatorVault
        open={sendOpen}
        title="Diz.yuborish"
        accentClass="bg-amber-400"
        onClose={() => setSendOpen(false)}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-black uppercase tracking-wide text-slate-700">
              Qancha yuborasiz?
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              autoComplete="off"
              value={sendAmount}
              onChange={(event) => {
                setSendAmount(event.target.value);
                setSendError("");
              }}
              className="mt-2 h-14 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-xl font-black text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white"
            />
          </label>

          <label className="block">
            <span className="text-sm font-black uppercase tracking-wide text-slate-700">Zapravka</span>
            <select
              value={sendStation}
              onChange={(event) => setSendStation(event.target.value)}
              className="mt-2 h-14 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-base font-black text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white"
            >
              {stationOptions.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name}
                </option>
              ))}
            </select>
          </label>

          {sendError ? (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-600">{sendError}</p>
          ) : null}

          <button
            type="button"
            onClick={handleSendConfirm}
            className="h-14 w-full rounded-2xl bg-amber-400 text-sm font-black uppercase tracking-widest text-slate-950 shadow-lg shadow-amber-400/25 transition hover:bg-amber-300"
          >
            Yubordim
          </button>
        </div>
      </OperatorVault>

      <OperatorVault
        open={receiveTransferOpen}
        title="Qabul qilish2"
        accentClass="bg-cyan-500"
        onClose={() => setReceiveTransferOpen(false)}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-black uppercase tracking-wide text-slate-700">
              {activeIncomingShipment?.fromStationName ?? "Zapravka"} dan qancha qabul qildingiz?
            </span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={receiveTransferAmount}
              onChange={(event) => {
                setReceiveTransferAmount(event.target.value);
                setReceiveTransferError("");
              }}
              className="mt-2 h-14 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-xl font-black text-slate-950 outline-none transition focus:border-cyan-500 focus:bg-white"
            />
          </label>

          {activeIncomingShipment ? (
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-cyan-700">Jo'natma</p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {activeIncomingShipment.fromStationName} dan {formatFuelAmount(activeIncomingShipment.amountKg)}
              </p>
            </div>
          ) : null}

          {receiveTransferError ? (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-600">
              {receiveTransferError}
            </p>
          ) : null}

          <button
            type="button"
            onClick={handleReceiveTransferConfirm}
            className="h-14 w-full rounded-2xl bg-cyan-500 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-400"
          >
            Qabul qildim
          </button>
        </div>
      </OperatorVault>
    </AdminLayout>
  );
}
