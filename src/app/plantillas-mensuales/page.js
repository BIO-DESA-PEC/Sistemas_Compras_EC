import { redirect } from "next/navigation";
import { auth } from "@/auth";
import PlantillasMensualesClient from "./PlantillasMensualesClient";

export const dynamic = "force-dynamic";

export default async function PlantillasMensualesPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return <PlantillasMensualesClient session={session} />;
}