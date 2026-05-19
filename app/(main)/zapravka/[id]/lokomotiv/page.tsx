import { ZAPRAVKALAR } from "@/lib/data/uzellar";
import LokomotivClient from "./LokomotivClient";

export async function generateStaticParams() {
  return ZAPRAVKALAR.map((z) => ({
    id: z.id,
  }));
}

export default function LokomotivPage() {
  return <LokomotivClient />;
}
