import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserByEmail, getOverview } from "@/app/lib/backend";
import styles from "./dashboard.module.css";

function Badge({ estado }) {
  const cls =
    estado === "APROBADA" ? `${styles.badge} ${styles.ok}` :
    estado === "RECHAZADA" ? `${styles.badge} ${styles.warn}` :
    `${styles.badge} ${styles.wait}`;
  return <span className={cls}>{estado}</span>;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/");

  const user = await getUserByEmail(session.user.email);
  if (!user) {
    return (
      <div className={styles.card}>
        <div className={styles.title}>Tu cuenta no está registrada</div>
        <div className={styles.sub}>Correo: {session.user.email}</div>
      </div>
    );
  }

  const stats = await getOverview(user.IdUsuario);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Bienvenido, {user.Nombre}</div>
          <div className={styles.sub}>
            Rol: <b>{user.RolNombre ?? `#${user.RolId}`}</b> • Depto: <b>{user.DeptoNombre ?? `#${user.DepartamentoId}`}</b>
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <div>Total solicitudes</div>
          <div className={styles.k}>{stats.totalSolicitudes}</div>
        </div>
        <div className={styles.metric}>
          <div>Pendientes</div>
          <div className={styles.k}>{stats.pendientes}</div>
        </div>
        <div className={styles.metric}>
          <div>Aprobadas</div>
          <div className={styles.k}>{stats.aprobadas}</div>
        </div>
        <div className={styles.metric}>
          <div>Rechazadas</div>
          <div className={styles.k}>{stats.rechazadas}</div>
        </div>
      </div>

      {/* Recientes */}
      <h3 style={{marginTop:16, fontWeight:700}}>Últimas solicitudes</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th><th>Estado</th><th>Creación</th><th>Aprobación</th>
          </tr>
        </thead>
        <tbody>
          {stats.recientes.map(r => (
            <tr key={r.IdSolicitud}>
              <td>#{r.IdSolicitud}</td>
              <td><Badge estado={r.Estado}/></td>
              <td>{r.FechaCreacionSoli}</td>
              <td>{r.FechaAprobacionSoli ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

     

    </div>
  );
}
