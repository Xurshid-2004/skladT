import { ZAPRAVKALAR } from "@/lib/data/uzellar";
import type { Zapravka } from "@/lib/types";

export const SUMMARY_OPERATOR_CARD: Zapravka = {
  id: "all-zapravkalar",
  uzelId: "all",
  name: "Barcha zapravkalar",
  slug: "all-zapravkalar",
};

export const ERJU_LABEL: Record<string, string> = {
  "rju-toshkent": "Toshkent ERJU",
  "rju-qoqon": "Qo'qon ERJU",
  "rju-buxoro": "Buxoro ERJU",
  "rju-qongirot": "Qo'ng'irot ERJU",
  "rju-qarshi": "Qarshi ERJU",
  "rju-termiz": "Termiz ERJU",
  all: "Umumiy",
};

export function getOperatorCards() {
  if (ZAPRAVKALAR.length >= 21) return ZAPRAVKALAR.slice(0, 21);
  return [SUMMARY_OPERATOR_CARD, ...ZAPRAVKALAR];
}

export function getOperatorCardById(id: string) {
  return getOperatorCards().find((card) => card.id === id);
}
