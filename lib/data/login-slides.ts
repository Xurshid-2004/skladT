/** Kirish sahifasi chap panel slaydlari — rasmlar `public/login/` da */
export interface LoginSlide {
  id: string;
  imageSrc: string;
  title: string;
  caption?: string;
  /** Rasm yuklanmaguncha yoki xato bo'lsa fon */
  gradient: string;
  /** object-position — panoramik rasmlar uchun */
  objectPosition?: string;
}

export const LOGIN_SLIDES: LoginSlide[] = [
  {
    id: "oil",
    imageSrc: "/login/slide-1.png",
    title: "Dizel yoqilg'i",
    caption: "Zapravka va uzel bo'yicha hisob",
    objectPosition: "center 40%",
    gradient:
      "linear-gradient(145deg, rgba(15,23,42,0.85) 0%, rgba(120,53,15,0.5) 100%)",
  },
  {
    id: "green-train",
    imageSrc: "/login/slide-4.png",
    title: "Yashil lokomotiv",
    caption: "Temir yo'l transporti",
    objectPosition: "center center",
    gradient:
      "linear-gradient(140deg, rgba(6,78,59,0.7) 0%, rgba(21,128,61,0.5) 100%)",
  },
];
