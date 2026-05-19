import { ZAPRAVKALAR } from "@/lib/data/uzellar";
import TamirlashClient from "./TamirlashClient";

export async function generateStaticParams() {
  return ZAPRAVKALAR.map((z) => ({ id: z.id }));
}

export default function TamirlashPage() {
  return <TamirlashClient />;
}
