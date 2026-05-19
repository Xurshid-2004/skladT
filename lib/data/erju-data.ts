import { UZELLAR, ZAPRAVKALAR } from './uzellar';

/** ERJU (uzel) bo'yicha zapravkalarning tartibli ro'yxati — ZAPRAVKALAR massividagi tartib saqlanadi */
export interface ErjuGroup {
  id: string;
  name: string;
  zapravkalar: readonly string[];
}

export const ERJU_DATA: readonly ErjuGroup[] = Object.freeze(
  UZELLAR.map((u) => ({
    id: u.id,
    name: u.name,
    zapravkalar: ZAPRAVKALAR.filter((z) => z.uzelId === u.id).map((z) => z.id),
  })),
);
