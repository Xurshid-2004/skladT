import { ZAPRAVKALAR } from "@/lib/data/uzellar";
import ZapravkaClient from "./ZapravkaClient";

export async function generateStaticParams() {
  return ZAPRAVKALAR.map((z) => ({
    id: z.id,
  }));
}

export default function ZapravkaPage() {
  return <ZapravkaClient />;
}
