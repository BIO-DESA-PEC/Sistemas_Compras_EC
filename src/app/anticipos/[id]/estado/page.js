import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserByEmail } from "@/app/lib/backend";
import EstadoAnticipoForm from "./EstadoAnticipoForm";

export default async function CambiarEstadoAnticipoPage({ params }) {
  const session = await auth();
  if (!session) redirect("/");

  const user = await getUserByEmail(session.user.email);
  if (!user) redirect("/");

  return <EstadoAnticipoForm id={params.id} />;
}