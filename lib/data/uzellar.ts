import { Uzel, Zapravka } from "../types";

export const UZELLAR: Uzel[] = [
  {
    id: "rju-toshkent",
    name: "РЖУ-Тошкент",
    slug: "rju-toshkent",
    description: "Markaziy uzel",
    icon: "LayoutGrid"
  },
  {
    id: "rju-qoqon",
    name: "РЖУ-Қўқон",
    slug: "rju-qoqon",
    description: "Vodiy tarmog'i",
    icon: "Network"
  },
  {
    id: "rju-buxoro",
    name: "РЖУ-Бухоро",
    slug: "rju-buxoro",
    description: "Tarixiy yo'nalish",
    icon: "History"
  },
  {
    id: "rju-qongirot",
    name: "РЖУ-Кунғирот",
    slug: "rju-qongirot",
    description: "Shimoliy ufq",
    icon: "Compass"
  },
  {
    id: "rju-qarshi",
    name: "РЖУ-Қарши",
    slug: "rju-qarshi",
    description: "Janubiy hudud",
    icon: "MapPin"
  },
  {
    id: "rju-termiz",
    name: "РЖУ-Термиз",
    slug: "rju-termiz",
    description: "Chegara stansiyasi",
    icon: "Flag"
  }
];

export const ZAPRAVKALAR: Zapravka[] = [
  // РЖУ-Тошкент
  { id: "toshkent", uzelId: "rju-toshkent", name: "Toshkent", slug: "toshkent" },
  { id: "angren", uzelId: "rju-toshkent", name: "Angren", slug: "angren" },
  { id: "sirdaryo", uzelId: "rju-toshkent", name: "Sirdaryo", slug: "sirdaryo" },
  { id: "hovos", uzelId: "rju-toshkent", name: "Hovos", slug: "hovos" },
  { id: "jizzax", uzelId: "rju-toshkent", name: "Jizzax", slug: "jizzax" },
  
  // РЖУ-Қўқон
  { id: "andijon", uzelId: "rju-qoqon", name: "Andijon", slug: "andijon" },
  { id: "qoqon", uzelId: "rju-qoqon", name: "Qoqon", slug: "qoqon" },
  { id: "marglon", uzelId: "rju-qoqon", name: "Marg'lon", slug: "marglon" },
  
  // РЖУ-Бухоро
  { id: "samarqand", uzelId: "rju-buxoro", name: "Samarqand", slug: "samarqand" },
  { id: "ziyovuddin", uzelId: "rju-buxoro", name: "Ziyovuddin", slug: "ziyovuddin" },
  { id: "buxoro", uzelId: "rju-buxoro", name: "Buxoro", slug: "buxoro" },
  { id: "tinchlik", uzelId: "rju-buxoro", name: "Tinchlik", slug: "tinchlik" },
  { id: "uchquduq", uzelId: "rju-buxoro", name: "Uchquduq", slug: "uchquduq" },
  
  // РЖУ-Кунғирот
  { id: "qongirot", uzelId: "rju-qongirot", name: "Qo'ng'irot", slug: "qongirot" },
  { id: "urganch", uzelId: "rju-qongirot", name: "Urganch", slug: "urganch" },
  { id: "miskin", uzelId: "rju-qongirot", name: "Miskin", slug: "miskin" },
  
  // РЖУ-Қарши
  { id: "qarshi", uzelId: "rju-qarshi", name: "Qarshi", slug: "qarshi" },
  
  // РЖУ-Термиз
  { id: "termez", uzelId: "rju-termiz", name: "Termez", slug: "termez" },
  { id: "darband", uzelId: "rju-termiz", name: "Darband", slug: "darband" },
  { id: "qumqurgon", uzelId: "rju-termiz", name: "Qumqurg'on", slug: "qumqurgon" }
];
