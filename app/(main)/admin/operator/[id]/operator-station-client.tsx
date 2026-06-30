"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Fuel, MapPin, Send, Truck, X } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import AdminLayout from "@/components/admin/admin-layout";
import {
  changeOperatorStationFuelBalance,
  readOperatorBalances,
  readOperatorOverlimits,
  setOperatorStationFuelBalance,
  subscribeOperatorFuelState,
} from "@/lib/operator/operator-balance";
import { PDF_CYRILLIC_FONT, useCyrillicPdfFont } from "@/lib/pdf/cyrillic-font";
import { savePdfDocument } from "@/lib/pdf/save-pdf";
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
const REALIZATION_STATION_ID = "realizatsiya-paneli";
const REALIZATION_STATION_NAME = "Realizatsiya paneli";

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

function parsePositiveFuelAmount(value: string) {
  const parsed = parseFuelAmount(value);
  return parsed !== null && parsed > 0 ? parsed : null;
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

function getPendingShipmentsForStation(stationId: string) {
  return readOperatorShipments()
    .filter((shipment) => shipment.toStationId === stationId && shipment.status === "pending")
    .sort((a, b) => a.createdAt - b.createdAt);
}

function getPendingAmountForStation(shipments: OperatorShipment[], stationId: string) {
  return shipments
    .filter((shipment) => shipment.toStationId === stationId && shipment.status === "pending")
    .reduce((sum, shipment) => sum + shipment.amountKg, 0);
}

function createShipmentId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const STATION_CARD_TONES = [
  "from-emerald-400 via-green-500 to-teal-600",
  "from-amber-300 via-orange-400 to-rose-500",
  "from-sky-400 via-blue-500 to-indigo-600",
  "from-cyan-400 via-sky-500 to-blue-600",
  "from-lime-300 via-emerald-400 to-green-600",
  "from-violet-400 via-purple-500 to-fuchsia-600",
  "from-orange-300 via-amber-400 to-yellow-500",
  "from-teal-300 via-cyan-400 to-sky-500",
  "from-rose-300 via-pink-400 to-red-500",
];

function getStationCardTone(index: number, pendingKg: number, overlimitKg: number) {
  if (overlimitKg > 0) return "from-red-400 via-rose-500 to-red-700";
  if (pendingKg > 0) return "from-amber-300 via-orange-400 to-yellow-600";
  return STATION_CARD_TONES[index % STATION_CARD_TONES.length];
}

function shipmentAcceptedKg(shipment: OperatorShipment) {
  return shipment.status === "accepted" ? shipment.acceptedKg ?? shipment.amountKg : 0;
}

function shipmentPendingKg(shipment: OperatorShipment) {
  return shipment.status === "pending" ? shipment.amountKg : 0;
}

function formatTonsNumber(kg: number) {
  return Number((kg / 1000).toFixed(3)).toLocaleString("uz-UZ", {
    maximumFractionDigits: 3,
  });
}

function formatDateTime(value?: number) {
  if (!value) return "-";
  return new Date(value).toLocaleString("uz-UZ");
}

function getLastAutoTableY(doc: jsPDF, fallback: number) {
  return (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? fallback;
}

function exportOperatorRealizationPdf({
  stationOptions,
  stationBalances,
  stationOverlimits,
  shipments,
}: {
  stationOptions: Zapravka[];
  stationBalances: Record<string, number>;
  stationOverlimits: Record<string, number>;
  shipments: OperatorShipment[];
}) {
  const doc = new jsPDF("landscape", "mm", "a4");
  useCyrillicPdfFont(doc);

  const now = new Date();
  const realizationShipments = shipments.filter((shipment) => shipment.fromStationId === REALIZATION_STATION_ID);
  const oldiBerdiShipments = shipments.filter((shipment) => shipment.fromStationId !== REALIZATION_STATION_ID);
  const sumKg = (items: OperatorShipment[], getValue: (shipment: OperatorShipment) => number) =>
    items.reduce((sum, shipment) => sum + getValue(shipment), 0);

  const realizationSentTotal = sumKg(realizationShipments, (shipment) => shipment.amountKg);
  const realizationAcceptedTotal = sumKg(realizationShipments, shipmentAcceptedKg);
  const realizationPendingTotal = sumKg(realizationShipments, shipmentPendingKg);
  const oldiBerdiSentTotal = sumKg(oldiBerdiShipments, (shipment) => shipment.amountKg);
  const oldiBerdiAcceptedTotal = sumKg(oldiBerdiShipments, shipmentAcceptedKg);
  const oldiBerdiPendingTotal = sumKg(oldiBerdiShipments, shipmentPendingKg);
  const balanceTotal = stationOptions.reduce((sum, station) => sum + (stationBalances[station.id] ?? 0), 0);
  const overlimitTotal = stationOptions.reduce((sum, station) => sum + (stationOverlimits[station.id] ?? 0), 0);

  doc.setFont(PDF_CYRILLIC_FONT, "bold");
  doc.setFontSize(13);
  doc.text("Operator bo'limi: realizatsiya va oldi-berdi hisoboti", 148.5, 12, { align: "center" });
  doc.setFont(PDF_CYRILLIC_FONT, "normal");
  doc.setFontSize(8);
  doc.text(`Sana: ${formatDateTime(now.getTime())}`, 148.5, 18, { align: "center" });
  doc.text(
    "Izoh: yo'ldagi yoqilg'i balansga kirmaydi. Faqat qabul qilingandan keyin haqiqiy qoldiqqa qo'shiladi.",
    148.5,
    23,
    { align: "center" },
  );

  autoTable(doc, {
    startY: 28,
    theme: "grid",
    margin: { left: 8, right: 8 },
    styles: {
      font: PDF_CYRILLIC_FONT,
      fontSize: 7,
      cellPadding: 1.1,
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      valign: "middle",
    },
    headStyles: {
      font: PDF_CYRILLIC_FONT,
      fillColor: [232, 235, 232],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    head: [["Ko'rsatkich", "Miqdor, t", "Izoh"]],
    body: [
      ["Realizatsiyadan yuborilgan", formatTonsNumber(realizationSentTotal), "Qabul + yo'lda"],
      ["Realizatsiyadan qabul qilingan", formatTonsNumber(realizationAcceptedTotal), "Balansga kirgan"],
      ["Realizatsiyadan yo'lda", formatTonsNumber(realizationPendingTotal), "Balansga kirmagan"],
      ["Oldi-berdi yuborilgan", formatTonsNumber(oldiBerdiSentTotal), "Zapravkalar orasida"],
      ["Oldi-berdi qabul qilingan", formatTonsNumber(oldiBerdiAcceptedTotal), "Qabul qilingan qismi"],
      ["Oldi-berdi yo'lda", formatTonsNumber(oldiBerdiPendingTotal), "Hali kelmagan"],
      ["Jami qoldiq", formatTonsNumber(balanceTotal), "Operator balanslari"],
      ["Limitdan oshgan", formatTonsNumber(overlimitTotal), "Minus qoldiq hisobidan"],
    ],
    columnStyles: {
      1: { halign: "right" },
    },
  });

  autoTable(doc, {
    startY: getLastAutoTableY(doc, 28) + 6,
    theme: "grid",
    margin: { left: 8, right: 8 },
    styles: {
      font: PDF_CYRILLIC_FONT,
      fontSize: 6.3,
      cellPadding: 0.85,
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      valign: "middle",
    },
    headStyles: {
      font: PDF_CYRILLIC_FONT,
      fillColor: [232, 235, 232],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    head: [
      [
        "#",
        "Zapravka",
        "Real. yub.",
        "Real. qabul",
        "Real. yo'lda",
        "Oldi qabul",
        "Oldi yo'lda",
        "Berdi",
        "Qoldiq",
        "Oshgan",
      ],
    ],
    body: stationOptions.map((station, index) => {
      const realizationForStation = realizationShipments.filter((shipment) => shipment.toStationId === station.id);
      const oldiIncomingForStation = oldiBerdiShipments.filter((shipment) => shipment.toStationId === station.id);
      const oldiOutgoingForStation = oldiBerdiShipments.filter((shipment) => shipment.fromStationId === station.id);

      return [
        String(index + 1),
        station.name,
        formatTonsNumber(sumKg(realizationForStation, (shipment) => shipment.amountKg)),
        formatTonsNumber(sumKg(realizationForStation, shipmentAcceptedKg)),
        formatTonsNumber(sumKg(realizationForStation, shipmentPendingKg)),
        formatTonsNumber(sumKg(oldiIncomingForStation, shipmentAcceptedKg)),
        formatTonsNumber(sumKg(oldiIncomingForStation, shipmentPendingKg)),
        formatTonsNumber(sumKg(oldiOutgoingForStation, (shipment) => shipment.amountKg)),
        formatTonsNumber(stationBalances[station.id] ?? 0),
        formatTonsNumber(stationOverlimits[station.id] ?? 0),
      ];
    }),
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { cellWidth: 35 },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
    },
  });

  const nextSectionY = getLastAutoTableY(doc, 90) + 8;
  doc.setFont(PDF_CYRILLIC_FONT, "bold");
  doc.setFontSize(9);
  doc.text("Realizatsiyadan yuborilganlar", 8, nextSectionY);

  autoTable(doc, {
    startY: nextSectionY + 3,
    theme: "grid",
    margin: { left: 8, right: 8 },
    styles: {
      font: PDF_CYRILLIC_FONT,
      fontSize: 6.2,
      cellPadding: 0.8,
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      valign: "middle",
    },
    headStyles: {
      font: PDF_CYRILLIC_FONT,
      fillColor: [232, 235, 232],
      textColor: [0, 0, 0],
      fontStyle: "bold",
    },
    head: [["#", "Realizatsiya -> zapravka", "Yuborildi, t", "Qabul, t", "Yo'lda, t", "Holat", "Yuborilgan vaqt", "Qabul vaqti"]],
    body:
      realizationShipments.length > 0
        ? realizationShipments.map((shipment, index) => [
            String(index + 1),
            shipment.toStationName,
            formatTonsNumber(shipment.amountKg),
            formatTonsNumber(shipmentAcceptedKg(shipment)),
            formatTonsNumber(shipmentPendingKg(shipment)),
            shipment.status === "pending" ? "Yo'lda" : "Qabul qilindi",
            formatDateTime(shipment.createdAt),
            formatDateTime(shipment.acceptedAt),
          ])
        : [["-", "Ma'lumot yo'q", "0", "0", "0", "-", "-", "-"]],
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });

  const oldiBerdiStartY = getLastAutoTableY(doc, nextSectionY + 20) + 8;
  doc.setFont(PDF_CYRILLIC_FONT, "bold");
  doc.setFontSize(9);
  doc.text("Oldi-berdi jo'natmalari", 8, oldiBerdiStartY);

  autoTable(doc, {
    startY: oldiBerdiStartY + 3,
    theme: "grid",
    margin: { left: 8, right: 8 },
    styles: {
      font: PDF_CYRILLIC_FONT,
      fontSize: 6.2,
      cellPadding: 0.8,
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      valign: "middle",
    },
    headStyles: {
      font: PDF_CYRILLIC_FONT,
      fillColor: [232, 235, 232],
      textColor: [0, 0, 0],
      fontStyle: "bold",
    },
    head: [["#", "Berdi", "Oldi", "Yuborildi, t", "Qabul, t", "Yo'lda, t", "Holat", "Yuborilgan vaqt", "Qabul vaqti"]],
    body:
      oldiBerdiShipments.length > 0
        ? oldiBerdiShipments.map((shipment, index) => [
            String(index + 1),
            shipment.fromStationName,
            shipment.toStationName,
            formatTonsNumber(shipment.amountKg),
            formatTonsNumber(shipmentAcceptedKg(shipment)),
            formatTonsNumber(shipmentPendingKg(shipment)),
            shipment.status === "pending" ? "Kelmadi / yo'lda" : "Keldi / qabul qilindi",
            formatDateTime(shipment.createdAt),
            formatDateTime(shipment.acceptedAt),
          ])
        : [["-", "Ma'lumot yo'q", "-", "0", "0", "0", "-", "-", "-"]],
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
  });

  savePdfDocument(doc, `operator_realizatsiya_oldi_berdi_${now.toISOString().slice(0, 10)}.pdf`);
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
  const [stationOverlimits, setStationOverlimits] = useState<Record<string, number>>({});
  const [receiveStation, setReceiveStation] = useState("default");
  const [sendAmount, setSendAmount] = useState("");
  const [sendError, setSendError] = useState("");
  const [sendStation, setSendStation] = useState(stationOptions[0]?.id ?? "");
  const [distributionStation, setDistributionStation] = useState(stationOptions[0]?.id ?? "");
  const [sentStationName, setSentStationName] = useState("Yuborilmalar yo'q");
  const [operatorShipments, setOperatorShipments] = useState<OperatorShipment[]>([]);
  const [incomingShipments, setIncomingShipments] = useState<OperatorShipment[]>([]);
  const [selectedIncomingShipmentId, setSelectedIncomingShipmentId] = useState<string | null>(null);
  const stationIncomingShipment = incomingShipments.find((shipment) => shipment.fromStationId !== REALIZATION_STATION_ID) ?? null;
  const realizationIncomingShipment = incomingShipments.find((shipment) => shipment.fromStationId === REALIZATION_STATION_ID) ?? null;
  const activeIncomingShipment = selectedIncomingShipmentId
    ? incomingShipments.find((shipment) => shipment.id === selectedIncomingShipmentId) ?? null
    : null;
  const currentFuelKg = stationBalances[card.id] ?? 0;
  const currentOverlimitKg = stationOverlimits[card.id] ?? 0;
  const realizationShipments = operatorShipments
    .filter((shipment) => shipment.fromStationId === REALIZATION_STATION_ID)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
  const realizationPendingTotal = realizationShipments
    .filter((shipment) => shipment.status === "pending")
    .reduce((sum, shipment) => sum + shipment.amountKg, 0);
  const realizationSentTotal = realizationShipments.reduce((sum, shipment) => sum + shipment.amountKg, 0);
  const realizationAcceptedTotal = realizationShipments
    .filter((shipment) => shipment.status === "accepted")
    .reduce((sum, shipment) => sum + (shipment.acceptedKg ?? shipment.amountKg), 0);
  const gaugeValue = formatFuelAmount(currentFuelKg);
  const fuelDisplay = splitFuelDisplay(gaugeValue);
  const gaugeValueSizeClass = fuelDisplay.amount.length > 4 ? "text-[3.2rem]" : "text-[4.8rem]";
  const fuelFillPercent = getFuelFillPercent(currentFuelKg);
  const canConfirmTransfer = parsePositiveFuelAmount(receiveTransferAmount) !== null;
  const totalStationBalanceKg = stationOptions.reduce(
    (sum, station) => sum + (stationBalances[station.id] ?? 0),
    0,
  );
  const activeStationCount = stationOptions.filter((station) => (stationBalances[station.id] ?? 0) > 0).length;
  const totalBalanceDisplay = splitFuelDisplay(formatFuelAmount(totalStationBalanceKg));
  const totalBalanceValueSizeClass =
    totalBalanceDisplay.amount.length > 6
      ? "text-[2rem]"
      : totalBalanceDisplay.amount.length > 5
        ? "text-[2.35rem]"
        : "text-[3.2rem]";
  const realizationChartTotalKg = realizationPendingTotal + totalStationBalanceKg;
  const pendingRingDegrees =
    realizationChartTotalKg > 0 ? (realizationPendingTotal / realizationChartTotalKg) * 360 : 0;
  const realizationRingBackground =
    realizationChartTotalKg > 0
      ? `conic-gradient(from 180deg, #ef4444 0deg ${pendingRingDegrees}deg, #22c55e ${pendingRingDegrees}deg 360deg)`
      : "conic-gradient(#e5e7eb 0deg 360deg)";

  const openIncomingShipment = (shipment: OperatorShipment) => {
    setSelectedIncomingShipmentId(shipment.id);
    setReceiveTransferAmount("");
    setReceiveTransferError("");
    setReceiveTransferOpen(true);
  };

  const closeReceiveTransfer = () => {
    setReceiveTransferOpen(false);
    setSelectedIncomingShipmentId(null);
    setReceiveTransferAmount("");
    setReceiveTransferError("");
  };

  useEffect(() => {
    const refreshBalances = () => {
      setStationBalances(readOperatorBalances());
      setStationOverlimits(readOperatorOverlimits());
    };

    refreshBalances();
    window.addEventListener("storage", refreshBalances);
    window.addEventListener("operatorBalancesChanged", refreshBalances);
    window.addEventListener("operatorOverlimitsChanged", refreshBalances);

    return () => {
      window.removeEventListener("storage", refreshBalances);
      window.removeEventListener("operatorBalancesChanged", refreshBalances);
      window.removeEventListener("operatorOverlimitsChanged", refreshBalances);
    };
  }, []);

  useEffect(() => {
    return subscribeOperatorFuelState(({ balances, overlimits }) => {
      setStationBalances(balances);
      setStationOverlimits(overlimits);
    });
  }, []);

  useEffect(() => {
    const refreshIncomingShipments = () => {
      setOperatorShipments(readOperatorShipments());
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

    const result = setOperatorStationFuelBalance(card.id, parsedAmount);
    setStationBalances(result.balances);
    setStationOverlimits(result.overlimits);
    setReceiveAmount("");
    setReceiveError("");
    setReceiveOpen(false);
  };

  const handleReceiveTransferConfirm = () => {
    const parsedAmount = parsePositiveFuelAmount(receiveTransferAmount);

    if (!activeIncomingShipment) {
      setReceiveTransferError("Sizga jo'natma yo'q.");
      return;
    }

    if (parsedAmount === null) {
      setReceiveTransferError("Qabul qilingan miqdorni kiriting. Miqdor 0 dan katta bo'lishi kerak.");
      return;
    }

    const result = changeOperatorStationFuelBalance(card.id, parsedAmount);
    setStationBalances(result.balances);
    setStationOverlimits(result.overlimits);

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
    setSelectedIncomingShipmentId(null);
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

    const result = changeOperatorStationFuelBalance(card.id, -parsedAmount);
    setStationBalances(result.balances);
    setStationOverlimits(result.overlimits);
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

    const newShipment: OperatorShipment = {
      id: createShipmentId(),
      fromStationId: REALIZATION_STATION_ID,
      fromStationName: REALIZATION_STATION_NAME,
      toStationId: selectedStation.id,
      toStationName: selectedStation.name,
      amountKg: parsedAmount,
      createdAt: Date.now(),
      status: "pending",
    };
    const nextShipments = [...readOperatorShipments(), newShipment];

    writeOperatorShipments(nextShipments);
    setOperatorShipments(nextShipments);
    setDistributionAmount("");
    setDistributionError("");
    setDistributionSuccess(`${selectedStation.name} zapravkasiga ${formatFuelAmount(parsedAmount)} yo'lga chiqarildi.`);
  };

  if (isAllStationsPage) {
    return (
      <AdminLayout hideHeader>
        <div className="w-full max-w-[84rem] pb-2">
          <section className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-xl shadow-slate-300/30">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 px-4 py-3">
              <div>
                <p className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">
                  Realizatsiya bo'limi
                </p>
                <h1 className="mt-1.5 text-2xl font-black uppercase leading-tight text-slate-950 sm:text-3xl">
                  Реализация панели
                </h1>
                <p className="mt-0.5 text-sm font-bold text-slate-600">
                  Yuborilgan yoqilg'i avval yo'lda turadi, qabul qilingandan keyin balansga qo'shiladi.
                </p>
              </div>

              <Link
                href="/admin/operator"
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-slate-950/18 transition hover:brightness-110"
              >
                <ArrowLeft className="h-4 w-4" />
                Orqaga
              </Link>
            </div>

            <div className="grid gap-3 px-4 py-4">
              <div className="overflow-hidden rounded-[1.2rem] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-5 md:grid-cols-[15rem_1fr] md:items-center">
                  <div className="grid place-items-center">
                    <p className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">
                      Barcha zapravkalar balansi
                    </p>
                    <div
                      className="relative grid h-52 w-52 place-items-center rounded-full p-3 shadow-2xl shadow-slate-300/70"
                      style={{ background: realizationRingBackground }}
                    >
                      <div className="grid h-36 w-36 place-items-center rounded-full bg-white text-center shadow-inner shadow-slate-300/70">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                            Остаток всё
                          </p>
                          <p
                            className={[
                              "mt-1 font-black leading-none tracking-normal text-slate-950 tabular-nums",
                              totalBalanceValueSizeClass,
                            ].join(" ")}
                          >
                            {totalBalanceDisplay.amount}
                            <span className="ml-1 text-xl uppercase text-emerald-700">
                              {totalBalanceDisplay.unit}
                            </span>
                          </p>
                          <p className="mt-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                            {activeStationCount}/{stationOptions.length} zapravka
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                          Realizatsiya statistikasi
                        </p>
                        <h2 className="mt-1 text-xl font-black uppercase text-slate-950">
                          Yuborilgan yoqilg'i holati
                        </h2>
                      </div>
                      <div className="flex flex-wrap gap-3 text-[11px] font-black uppercase tracking-wide text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-3 w-3 rounded-full bg-red-500" />
                          Yo'lda / kutilmoqda
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-3 w-3 rounded-full bg-emerald-500" />
                          Qabul / balansda
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Jami yuborilgan
                        </p>
                        <p className="mt-1 text-xl font-black tabular-nums text-slate-950">
                          {formatFuelAmount(realizationSentTotal)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/60">
                          Qabul qilingan
                        </p>
                        <p className="mt-1 text-xl font-black tabular-nums text-emerald-700">
                          {formatFuelAmount(realizationAcceptedTotal)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-red-100 bg-red-50 px-3 py-2.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-red-700/60">
                          Yo'lda
                        </p>
                        <p className="mt-1 text-xl font-black tabular-nums text-red-600">
                          {formatFuelAmount(realizationPendingTotal)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 rounded-[1.1rem] border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-wide text-slate-700">Realizatsiya</span>
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
                    className="mt-1.5 h-12 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-lg font-black text-slate-950 outline-none transition focus:border-emerald-500"
                    placeholder="Masalan: 1500"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-wide text-slate-700">
                    Qaysi zapravkaga
                  </span>
                  <select
                    value={distributionStation}
                    onChange={(event) => {
                      setDistributionStation(event.target.value);
                      setDistributionError("");
                      setDistributionSuccess("");
                    }}
                    className="mt-1.5 h-12 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-base font-black text-slate-950 outline-none transition focus:border-emerald-500"
                  >
                    {stationOptions.map((station) => (
                      <option key={station.id} value={station.id}>
                        {station.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleDistributionConfirm}
                    className="h-12 rounded-xl bg-emerald-500 px-6 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                  >
                    Yuborish
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      exportOperatorRealizationPdf({
                        stationOptions,
                        stationBalances,
                        stationOverlimits,
                        shipments: operatorShipments,
                      })
                    }
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-slate-950/18 transition hover:brightness-110"
                  >
                    <Download className="h-4 w-4" strokeWidth={3} />
                    PDF
                  </button>
                </div>
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

              <div className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                      Jo'natmalar
                    </p>
                    <h2 className="text-lg font-black uppercase text-slate-950">
                      Realizatsiyadan yuborilganlar
                    </h2>
                  </div>
                  <div className="rounded-2xl bg-amber-50 px-4 py-2 text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700/70">
                      Yo'lda jami
                    </p>
                    <p className="text-lg font-black tabular-nums text-amber-700">
                      {formatFuelAmount(realizationPendingTotal)}
                    </p>
                  </div>
                </div>

                {realizationShipments.length === 0 ? (
                  <div className="px-4 py-6 text-sm font-bold text-slate-500">
                    Hozircha realizatsiyadan jo'natilgan yoqilg'i yo'q.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-white text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <tr>
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Zapravka</th>
                          <th className="px-4 py-3 text-right">Miqdor</th>
                          <th className="px-4 py-3">Holat</th>
                          <th className="px-4 py-3">Vaqt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {realizationShipments.map((shipment, index) => (
                          <tr key={shipment.id} className="text-slate-800">
                            <td className="px-4 py-3 font-black text-slate-400">{index + 1}</td>
                            <td className="px-4 py-3 font-black text-slate-950">
                              {shipment.toStationName}
                            </td>
                            <td className="px-4 py-3 text-right font-black tabular-nums text-slate-950">
                              {formatFuelAmount(shipment.amountKg)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={[
                                  "inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide",
                                  shipment.status === "pending"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-emerald-100 text-emerald-700",
                                ].join(" ")}
                              >
                                {shipment.status === "pending" ? "Yo'lda" : "Qabul qilindi"}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-500">
                              {new Date(shipment.createdAt).toLocaleString("uz-UZ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {stationOptions.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                  <p className="text-sm font-black uppercase tracking-wide text-slate-500">
                    Zapravkalar topilmadi
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {stationOptions.map((station, index) => {
                  const overlimitKg = stationOverlimits[station.id] ?? 0;
                  const balanceKg = stationBalances[station.id] ?? 0;
                  const pendingKg = getPendingAmountForStation(operatorShipments, station.id);
                  const cardTone = getStationCardTone(index, pendingKg, overlimitKg);

                  return (
                    <div
                      key={station.id}
                      className={[
                        "group relative min-h-[13rem] overflow-hidden rounded-[1.7rem] border border-white/45 bg-gradient-to-br p-4 text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl",
                        cardTone,
                      ].join(" ")}
                    >
                      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/22 blur-2xl" />
                      <div className="pointer-events-none absolute -bottom-10 left-8 h-28 w-28 rounded-full bg-black/12 blur-2xl" />

                      <div className="relative z-10 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-2xl font-black uppercase leading-tight tracking-normal text-white drop-shadow-sm">
                            {station.name}
                          </p>
                          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-white/75">
                            {station.slug}
                          </p>
                        </div>
                        <span
                          className={[
                            "shrink-0 rounded-full border border-white/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide backdrop-blur-md",
                            pendingKg > 0
                              ? "bg-white/25 text-white"
                              : "bg-black/14 text-white",
                          ].join(" ")}
                        >
                          {pendingKg > 0 ? "Yo'lda" : "Tayyor"}
                        </span>
                      </div>

                      <div className="relative z-10 mt-5 grid gap-3">
                        <div className="rounded-2xl border border-white/60 bg-white/92 px-3 py-3 shadow-lg shadow-black/10 backdrop-blur-md">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Balans
                          </p>
                          <p className="mt-1 text-3xl font-black leading-none tabular-nums text-slate-950">
                            {formatFuelAmount(balanceKg)}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-2xl border border-white/55 bg-white/88 px-3 py-2.5 shadow-md shadow-black/10 backdrop-blur-md">
                            <div className="flex items-center gap-1.5 text-amber-600">
                              <Truck className="h-3.5 w-3.5" strokeWidth={3} />
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Yo'lda
                              </p>
                            </div>
                            <p className="mt-1 text-lg font-black tabular-nums text-slate-950">
                              {formatFuelAmount(pendingKg)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-white/55 bg-white/88 px-3 py-2.5 shadow-md shadow-black/10 backdrop-blur-md">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                              Holat
                            </p>
                            <p className="mt-1 text-lg font-black text-slate-950">
                              {pendingKg > 0 ? "Kutilmoqda" : "Tayyor"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {overlimitKg > 0 ? (
                        <p className="relative z-10 mt-3 rounded-2xl border border-white/18 bg-black/18 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-white backdrop-blur-md">
                          Oshgan: {formatFuelAmount(overlimitKg)}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
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
                    disabled={!stationIncomingShipment}
                    onClick={() => stationIncomingShipment && openIncomingShipment(stationIncomingShipment)}
                    className={[
                      "inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-wide shadow-lg transition",
                      stationIncomingShipment
                        ? "bg-emerald-500 text-white shadow-emerald-900/30 hover:-translate-y-0.5 hover:bg-emerald-400"
                        : "cursor-not-allowed bg-slate-100 text-slate-400 shadow-slate-200/40",
                    ].join(" ")}
                  >
                    <Fuel className="h-5 w-5" strokeWidth={3} />
                    {stationIncomingShipment ? "Sizga jo'natma bor" : "Sizga jo'natma yo'q"}
                  </button>
                  <button
                    type="button"
                    disabled={!realizationIncomingShipment}
                    onClick={() => realizationIncomingShipment && openIncomingShipment(realizationIncomingShipment)}
                    className={[
                      "inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-wide shadow-lg transition",
                      realizationIncomingShipment
                        ? "bg-cyan-500 text-white shadow-cyan-900/30 hover:-translate-y-0.5 hover:bg-cyan-400"
                        : "cursor-not-allowed bg-slate-100 text-slate-400 shadow-slate-200/40",
                    ].join(" ")}
                  >
                    <Truck className="h-5 w-5" strokeWidth={3} />
                    {realizationIncomingShipment ? "Yo'lda kelmoqda" : "Realizatsiya yo'q"}
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

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                <div
                  className={[
                    "rounded-2xl border px-4 py-3",
                    currentOverlimitKg > 0
                      ? "border-red-200 bg-red-50"
                      : "border-slate-200 bg-slate-50",
                  ].join(" ")}
                >
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Limitdan oshgan
                  </p>
                  <p
                    className={[
                      "mt-1 break-words text-lg font-black",
                      currentOverlimitKg > 0 ? "text-red-600" : "text-slate-950",
                    ].join(" ")}
                  >
                    {formatFuelAmount(currentOverlimitKg)}
                  </p>
                </div>
                {stationIncomingShipment ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                      Jo'natma
                    </p>
                    <p className="mt-1 break-words text-lg font-black text-emerald-700">
                      {formatFuelAmount(stationIncomingShipment.amountKg)}
                    </p>
                  </div>
                ) : null}
                {realizationIncomingShipment ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                      Realizatsiya yo'lda
                    </p>
                    <p className="mt-1 break-words text-lg font-black text-amber-700">
                      {formatFuelAmount(realizationIncomingShipment.amountKg)}
                    </p>
                  </div>
                ) : null}
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
                        {currentOverlimitKg > 0 ? (
                          <p className="mt-2 rounded-lg bg-red-500/20 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-red-100">
                            Oshgan: {formatFuelAmount(currentOverlimitKg)}
                          </p>
                        ) : null}
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
        title="Qabul qilish"
        accentClass="bg-cyan-500"
        onClose={closeReceiveTransfer}
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
              required
              value={receiveTransferAmount}
              onChange={(event) => {
                setReceiveTransferAmount(event.target.value);
                setReceiveTransferError("");
              }}
              className="mt-2 h-14 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-xl font-black text-slate-950 outline-none transition focus:border-cyan-500 focus:bg-white"
            />
            <p className="mt-2 text-xs font-bold text-slate-500">
              Majburiy: qabul qilingan miqdor 0 dan katta bo'lishi kerak.
            </p>
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
            disabled={!activeIncomingShipment || !canConfirmTransfer}
            onClick={handleReceiveTransferConfirm}
            className={[
              "h-14 w-full rounded-2xl text-sm font-black uppercase tracking-widest text-white shadow-lg transition",
              activeIncomingShipment && canConfirmTransfer
                ? "bg-cyan-500 shadow-cyan-500/25 hover:bg-cyan-400"
                : "cursor-not-allowed bg-slate-300 shadow-slate-200/30",
            ].join(" ")}
          >
            Qabul qildim
          </button>
        </div>
      </OperatorVault>
    </AdminLayout>
  );
}
