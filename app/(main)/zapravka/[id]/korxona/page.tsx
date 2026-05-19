import { ZAPRAVKALAR } from "@/lib/data/uzellar";
import KorxonaClient from "./KorxonaClient";

export async function generateStaticParams() {
  return ZAPRAVKALAR.map((z) => ({ id: z.id }));
}

export default function KorxonaPage() {
  return <KorxonaClient />;
}
