import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserByEmail } from "@/app/lib/backend";
import AnticipoForm from "./AnticipoForm";

export default async function NuevoAnticipoPage() {
  const session = await auth();

  if (!session) redirect("/");

  const user = await getUserByEmail(session.user.email);

  if (!user) redirect("/");

  return <AnticipoForm user={user} />;
}