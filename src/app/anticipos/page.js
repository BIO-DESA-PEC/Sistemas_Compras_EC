import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserByEmail } from "@/app/lib/backend";
import { Eye, RefreshCw, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import AnticipoFacturarButton from "./AnticipoFacturarButton";
import styles from "./anticipos.module.css";

function puedeVerTodosAnticipos(user) {
  const r = (user?.RolNombre || "").trim().toUpperCase();

  return (
    r === "ADMINISTRADOR" ||
    r === "COMPRAS" ||
    r === "CONTABILIDAD"
  );
}
async function fetchAnticipos({ userId, scope }) {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL;
  const url = new URL(`${base}/api/anticipos`);
  url.searchParams.set("userId", userId);
  url.searchParams.set("scope", scope);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toISOString().slice(0, 10);
}

function badge(estadoRaw) {
  const estado = (estadoRaw || "PENDIENTE").toUpperCase();

  const cls =
    estado === "PAGADO"
      ? styles.badgePagado
      : estado === "APROBADA"
      ? styles.badgeAprobada
      : estado === "ANULADA" || estado === "RECHAZADA"
      ? styles.badgeRechazada
      : styles.badgePendiente;

  return <span className={`${styles.badge} ${cls}`}>{estado}</span>;
}

function ActionButton({ href, title, children, variant = "blue" }) {
  return (
    <a
      href={href}
      title={title}
      className={`${styles.actionBtn} ${styles[`action${variant}`]}`}
    >
      {children}
    </a>
  );
}

export default async function AnticiposPage({ searchParams }) {
  const session = await auth();
  if (!session) redirect("/");

  const user = await getUserByEmail(session.user.email);
  if (!user) redirect("/");

  const puedeVerTodos = puedeVerTodosAnticipos(user);
  const scope = puedeVerTodos ? "all" : "mine";

  const data = await fetchAnticipos({
    userId: user.IdUsuario,
    scope,
  });

  const items = data.items || [];

  const currentPage = Number(searchParams?.page || 1);
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  const paginatedItems = items.slice(start, start + pageSize);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {puedeVerTodos ? "Anticipos" : "Mis anticipos"}
          </h1>
          <p className={styles.subtitle}>
            Gestión y seguimiento de solicitudes de anticipo.
          </p>
        </div>

        <div className={styles.filters}>
          <a className={`${styles.chip} ${styles.active}`} href="/anticipos">
            Todos
          </a>
          <a className={styles.primaryChip} href="/anticipos/new">
            Nueva solicitud de anticipo
          </a>
        </div>
      </div>

      <div className={styles.card}>
        {items.length === 0 ? (
          <div className={styles.empty}>
            No hay solicitudes de anticipo registradas.
          </div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Código</th>
                    {puedeVerTodos && <th>Solicitante</th>}
                    <th>Fecha</th>
                    <th>Monto</th>
                    <th>Beneficiario</th>
                    <th>Motivo</th>
                    <th>Liquidación</th>
                    <th>Estado</th>
                    <th className={styles.center}>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedItems.map((a) => {
                    const estado = (a.Estado || "").toUpperCase();

                    return (
                      <tr key={a.IdAnticipo}>
                        <td>
                          <span className={styles.code}>
                            {a.Codigo || `ANT-${a.IdAnticipo}`}
                          </span>
                        </td>

                        {puedeVerTodos && (
                          <td>
                            <div className={styles.userName}>
                              {a.SolicitanteNombre || "—"}
                            </div>
                            <div className={styles.userEmail}>
                              {a.SolicitanteCorreo || ""}
                            </div>
                          </td>
                        )}

                        <td>{fmtDate(a.Fecha)}</td>

                        <td>
                          <span className={styles.amount}>
                            {a.Monto} {a.Moneda}
                          </span>
                        </td>

                        <td>{a.BeneficiarioCheque || "—"}</td>

                        <td className={styles.reason}>
                          {a.Motivo1 || "—"}
                        </td>

                        <td>{fmtDate(a.FechaMaximaLiquidacion)}</td>

                        <td>{badge(a.Estado)}</td>

                        <td>
                          <div className={styles.actions}>
                            <ActionButton
                              href={`/anticipos/${a.IdAnticipo}`}
                              title="Ver detalle"
                              variant="blue"
                            >
                              <Eye size={17} />
                            </ActionButton>

                            {a.AdjuntoPdfUrl && (
                              <ActionButton
                                href={a.AdjuntoPdfUrl}
                                title="Ver / descargar PDF"
                                variant="green"
                              >
                                <FileText size={17} />
                              </ActionButton>
                            )}

                            {puedeVerTodos && estado !== "ANULADA" && (
                              <ActionButton
                                href={`/anticipos/${a.IdAnticipo}/estado`}
                                title="Cambiar estado"
                                variant="purple"
                              >
                                <RefreshCw size={17} />
                              </ActionButton>
                            )}

                            {puedeVerTodos && estado === "PAGADO" && (
                            <AnticipoFacturarButton
                                idAnticipo={a.IdAnticipo}
                                idOC={a.IdOC}
                                userId={user.IdUsuario}
                            />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className={styles.pagination}>
              <div className={styles.pageInfo}>
                Mostrando {start + 1} - {Math.min(start + pageSize, items.length)} de{" "}
                {items.length}
              </div>

              <div className={styles.pageControls}>
                <a
                  className={`${styles.pageBtn} ${
                    safePage === 1 ? styles.disabled : ""
                  }`}
                  href={safePage === 1 ? "#" : `/anticipos?page=${safePage - 1}`}
                >
                  <ChevronLeft size={16} />
                  Anterior
                </a>

                <span className={styles.pageNumber}>
                  Página {safePage} de {totalPages}
                </span>

                <a
                  className={`${styles.pageBtn} ${
                    safePage === totalPages ? styles.disabled : ""
                  }`}
                  href={
                    safePage === totalPages
                      ? "#"
                      : `/anticipos?page=${safePage + 1}`
                  }
                >
                  Siguiente
                  <ChevronRight size={16} />
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}