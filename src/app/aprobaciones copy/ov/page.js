// src/app/aprobaciones/ov/page.jsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserByEmail, getOVPending } from "@/app/lib/backend";
import OCPrefacturasClient from "../ui/OCPrefacturasClient";
import styles from "../aprobaciones.module.css";

export const dynamic = "force-dynamic";

export default async function OCPrefacturasPage() {
  const session = await auth();
  if (!session) redirect("/");

  const user = await getUserByEmail(session.user.email);
  if (!user) {
    return <div className={styles.wrap}>Tu correo no está registrado: {session.user.email}</div>;
  }

  const userId = user.IdUsuario;
  const prefacturasOC = await getOVPending(userId);

  return (
    <div className={styles.wrap}>
      <h1>Prefacturas OC pendientes</h1>
      <OCPrefacturasClient initial={prefacturasOC} userId={userId} />
    </div>
  );
}
