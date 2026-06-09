// src/app/solicitudes/page.js
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserByEmail } from "@/app/lib/backend";
import styles from "./list.module.css";

const PAGE_SIZE = 15;

function isAdminCompras(user) {
  const r = (user?.RolNombre || "").trim().toUpperCase();
  return r === "ADMINISTRADOR" || r === "COMPRAS";
}

async function fetchList({ userId, estado, scope, historico }) {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL;
  const u = new URL(`${base}/api/solicitudes`);

  u.searchParams.set("userId", userId);
  u.searchParams.set("scope", scope);
  u.searchParams.set("page", "1");
  u.searchParams.set("pageSize", "5000");

  if (estado) u.searchParams.set("estado", estado);
  if (historico === "Y") u.searchParams.set("historico", "Y");

  const res = await fetch(u, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default async function SolicitudesListPage({ searchParams }) {
  const session = await auth();
  if (!session) redirect("/");

  const user = await getUserByEmail(session.user.email);
  if (!user) redirect("/");

  const adminCompras = isAdminCompras(user);

  const estado = searchParams?.estado || "";
  const historico = searchParams?.historico === "Y" ? "Y" : "N";

  const pageParam = parseInt(searchParams?.page || "1", 10);
  const currentPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  const scope = adminCompras ? "all" : "mine";

  const data = await fetchList({
    userId: user.IdUsuario,
    estado,
    scope,
    historico,
  });

  const items = data.items || [];
  const total = items.length;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const paginated = items.slice(start, start + PAGE_SIZE);

  const badge = (s) => {
    const estadoUpper = String(s || "").toUpperCase();

    return (
      <span
        className={`${styles.badge} ${
          estadoUpper === "APROBADA"
            ? styles.ok
            : estadoUpper === "RECHAZADA"
            ? styles.warn
            : estadoUpper === "PREORDEN" || estadoUpper === "EN_PREORDEN"
            ? styles.info
            : styles.wait
        }`}
      >
        {s || "—"}
      </span>
    );
  };

  const buildLink = ({ newEstado = estado, newHistorico = historico, page = 1 }) => {
    const qs = new URLSearchParams();

    if (newEstado) qs.set("estado", newEstado);
    if (newHistorico === "Y") qs.set("historico", "Y");
    if (page > 1) qs.set("page", String(page));

    const q = qs.toString();
    return `/solicitudes${q ? `?${q}` : ""}`;
  };

  const pageNumbers = () => {
    const max = totalPages;
    const curr = safePage;
    const out = [];
    const add = (n, label) =>
      out.push({ n, label: label || String(n), active: n === curr });

    if (max <= 7) {
      for (let n = 1; n <= max; n++) add(n);
    } else {
      add(1);
      if (curr > 3) out.push({ label: "…" });
      const s = Math.max(2, curr - 1);
      const e = Math.min(max - 1, curr + 1);
      for (let n = s; n <= e; n++) add(n);
      if (curr < max - 2) out.push({ label: "…" });
      add(max);
    }

    return out;
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Compras</p>
          <h1 className={styles.title}>
            {adminCompras ? "Solicitudes" : "Mis solicitudes"}
          </h1>
          <p className={styles.subtitle}>
            {historico === "Y"
              ? "Mostrando solicitudes históricas anteriores al 10/06/2026."
              : "Mostrando solicitudes actuales desde el 10/06/2026."}
          </p>
        </div>

        <div className={styles.resumeBox}>
          <span className={styles.resumeNumber}>{total}</span>
          <span className={styles.resumeText}>registros</span>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Estado</span>

          <div className={styles.filters}>
            <a
              className={`${styles.chip} ${!estado ? styles.active : ""}`}
              href={buildLink({ newEstado: "", page: 1 })}
            >
              Todas
            </a>

            <a
              className={`${styles.chip} ${
                estado === "PENDIENTE" ? styles.active : ""
              }`}
              href={buildLink({ newEstado: "PENDIENTE", page: 1 })}
            >
              Pendientes
            </a>

            <a
              className={`${styles.chip} ${
                estado === "APROBADA" ? styles.active : ""
              }`}
              href={buildLink({ newEstado: "APROBADA", page: 1 })}
            >
              Aprobadas
            </a>

            <a
              className={`${styles.chip} ${
                estado === "RECHAZADA" ? styles.active : ""
              }`}
              href={buildLink({ newEstado: "RECHAZADA", page: 1 })}
            >
              Rechazadas
            </a>

            <a
              className={`${styles.chip} ${
                estado === "PREORDEN" ? styles.active : ""
              }`}
              href={buildLink({ newEstado: "PREORDEN", page: 1 })}
            >
              Preorden
            </a>
          </div>
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Vista</span>

          <div className={styles.segmented}>
            <a
              className={`${styles.segment} ${
                historico !== "Y" ? styles.segmentActive : ""
              }`}
              href={buildLink({ newHistorico: "N", page: 1 })}
            >
              Actuales
            </a>

            <a
              className={`${styles.segment} ${
                historico === "Y" ? styles.segmentActive : ""
              }`}
              href={buildLink({ newHistorico: "Y", page: 1 })}
            >
              Históricas
            </a>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        {total === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📄</div>
            <strong>No hay solicitudes para esta vista.</strong>
            <span>Cambia los filtros para consultar otros registros.</span>
          </div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Código</th>
                    {adminCompras && <th>Solicitante</th>}
                    <th>Estado</th>
                    <th>Creación</th>
                    <th>Aprobación</th>
                    <th>Renglones</th>
                    <th className={styles.actionsTh}>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {paginated.map((r) => {
                    const hasPend =
                      r.Estado === "PENDIENTE" &&
                      (r.AprobadorPendiente || r.NivelPendiente);

                    const tip = hasPend
                      ? `En aprobación — ${r.AprobadorPendiente || ""}${
                          r.NivelPendiente ? ` (Nivel ${r.NivelPendiente})` : ""
                        }`
                      : undefined;

                    return (
                      <tr key={r.IdSolicitud}>
                        <td data-label="Código">
                          <strong className={styles.code}>
                            {r.Codigo || `#${r.IdSolicitud}`}
                          </strong>
                        </td>

                        {adminCompras && (
                          <td data-label="Solicitante">
                            <div className={styles.userBox}>
                              <span className={styles.userName}>
                                {r.SolicitanteNombre || "—"}
                              </span>
                              <span className={styles.userMail}>
                                {r.SolicitanteCorreo || ""}
                              </span>
                            </div>
                          </td>
                        )}

                        <td
                          data-label="Estado"
                          className={styles.stateCell}
                          title={tip}
                        >
                          {badge(r.Estado)}
                          <div className={styles.subnote}>
                            {hasPend ? (
                              <>
                                En aprobación —{" "}
                                <b>{r.AprobadorPendiente || "—"}</b>
                              </>
                            ) : null}
                          </div>
                        </td>

                        <td data-label="Creación">{fmtDate(r.FechaCreacionSoli)}</td>
                        <td data-label="Aprobación">
                          {fmtDate(r.FechaAprobacionSoli)}
                        </td>
                        <td data-label="Renglones">{r.Renglones}</td>

                        <td data-label="Acciones">
                          <div className={styles.actions}>
                            {r.Estado === "PENDIENTE" && (
                              <a
                                className={styles.btn}
                                href={`/solicitudes/${r.IdSolicitud}/edit`}
                              >
                                Editar
                              </a>
                            )}

                            <a
                              className={styles.btnGhost}
                              href={`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/solicitudes/${r.IdSolicitud}/pdf`}
                              target="_blank"
                            >
                              PDF
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className={styles.pager}>
              <span className={styles.pagerInfo}>
                Mostrando {total === 0 ? 0 : start + 1}–
                {Math.min(total, start + paginated.length)} de {total}
              </span>

              <div className={styles.pagerNav}>
                <a
                  className={`${styles.pageBtn} ${
                    safePage === 1 ? styles.disabled : ""
                  }`}
                  href={
                    safePage === 1
                      ? undefined
                      : buildLink({ page: safePage - 1 })
                  }
                  aria-disabled={safePage === 1}
                >
                  «
                </a>

                {pageNumbers().map((p, i) =>
                  p.n ? (
                    <a
                      key={i}
                      href={buildLink({ page: p.n })}
                      className={`${styles.pageBtn} ${
                        p.active ? styles.pageActive : ""
                      }`}
                    >
                      {p.label}
                    </a>
                  ) : (
                    <span key={i} className={styles.ellipsis}>
                      …
                    </span>
                  )
                )}

                <a
                  className={`${styles.pageBtn} ${
                    safePage === totalPages ? styles.disabled : ""
                  }`}
                  href={
                    safePage === totalPages
                      ? undefined
                      : buildLink({ page: safePage + 1 })
                  }
                  aria-disabled={safePage === totalPages}
                >
                  »
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}