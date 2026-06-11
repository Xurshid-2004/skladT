import { notFound } from "next/navigation";

import { ERJU_LABEL, getOperatorCardById, getOperatorCards } from "../operator-data";
import OperatorStationClient from "./operator-station-client";

type OperatorStationPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  return getOperatorCards().map((card) => ({
    id: card.id,
  }));
}

export default async function OperatorStationPage({ params }: OperatorStationPageProps) {
  const { id } = await params;
  const card = getOperatorCardById(id);

  if (!card) {
    notFound();
  }

  const erjuName = ERJU_LABEL[card.uzelId] ?? card.uzelId;

  return <OperatorStationClient card={card} erjuName={erjuName} cards={getOperatorCards()} />;
}
