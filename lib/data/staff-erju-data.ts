/** Xodimlar vault — ERJU nomlari va zapravkalar (bloklanganlar / staff modali uchun). */
export type ErjuStaffGroup = {
  name: string;
  short: string;
  zapravkalar: readonly string[];
};

export const ERJU_STAFF_GROUPS: readonly ErjuStaffGroup[] = Object.freeze([
  {
    name: "Toshkent ERJU",
    short: "Тошкент",
    zapravkalar: [
      "Toshkent zapravka",
      "Angren zapravka",
      "Sirdaryo zapravka",
      "Hovos zapravka",
      "Jizzax zapravka",
    ],
  },
  {
    name: "Buxoro ERJU",
    short: "Бухара",
    zapravkalar: [
      "Samarqand zapravka",
      "Ziyovuddin zapravka",
      "Tinchlik zapravka",
      "Buxoro zapravka",
      "Uchquduq zapravka",
    ],
  },
  {
    name: "Qarshi ERJU",
    short: "Қарши",
    zapravkalar: ["Qarshi zapravka"],
  },
  {
    name: "Qo'qon ERJU",
    short: "Қоқон",
    zapravkalar: [
      "Andijon zapravka",
      "Qo'qon zapravka",
      "Marg'ilon zapravka",
    ],
  },
  {
    name: "Termiz ERJU",
    short: "Термиз",
    zapravkalar: [
      "Termiz zapravka",
      "Darband zapravka",
      "Qumqo'rg'on zapravka",
    ],
  },
  {
    name: "Qo'ng'irot ERJU",
    short: "Қунгирот",
    zapravkalar: [
      "Qo'ng'irot zapravka",
      "Urganch zapravka",
      "Miskin zapravka",
    ],
  },
]);
