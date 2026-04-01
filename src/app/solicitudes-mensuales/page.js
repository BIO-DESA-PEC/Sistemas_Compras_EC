import { redirect } from "next/navigation";
import { auth } from "@/auth";
import SolicitudesMensualesClient from "./SolicitudesMensualesClient";

export const dynamic = "force-dynamic";

export default async function SolicitudesMensualesPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return <SolicitudesMensualesClient session={session} />;
}