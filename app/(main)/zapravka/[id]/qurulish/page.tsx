import { ZAPRAVKALAR } from "@/lib/data/uzellar";
import QurulishClient from "./QurulishClient";

export async function generateStaticParams() {
  return ZAPRAVKALAR.map((z) => ({ id: z.id }));
}

export default function QurulishPage() {
  return <QurulishClient />;
}
