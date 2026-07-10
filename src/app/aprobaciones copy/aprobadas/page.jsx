import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  getUserByEmail,
  getApprovedApprovals,
} from "@/app/lib/backend";

import AprobacionesHistorialClient from "../ui/AprobacionesHistorialClient";
import styles from "../aprobaciones.module.css";

export const dynamic = "force-dynamic";

export default async function AprobacionesAprobadasPage() {
  const session = await auth();

  if (!session) {
    redirect("/");
  }

  const user = await getUserByEmail(session.user.email);

  if (!user) {
    return (
      <div className={styles.wrap}>
        Tu correo no está registrado: {session.user.email}
      </div>
    );
  }

  const userId = Number(user.IdUsuario);

  if (!userId) {
    return (
      <div className={styles.wrap}>
        No se pudo obtener el identificador del usuario.
      </div>
    );
  }

  const solicitudes = await getApprovedApprovals(userId);

  return (
    <div className={styles.wrap}>
      <h1>Solicitudes aprobadas por mí</h1>

      <AprobacionesHistorialClient
        initial={solicitudes}
        userId={userId}
      />
    </div>
  );
}