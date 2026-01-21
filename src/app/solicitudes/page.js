// src/app/solicitudes/page.js
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserByEmail } from "@/app/lib/backend";
import styles from "./list.module.css";
import AnticipoCheck from "./AnticipoCheck";

const PAGE_SIZE = 15;

function isAdminCompras(user) {
  const r = (user?.RolNombre || "").trim().toUpperCase();
  return r === "ADMINISTRADOR" || r === "COMPRAS";
}

async function fetchList({ userId, estado, scope }) {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL;
  const u = new URL(`${base}/api/solicitudes`);
  u.searchParams.set("userId", userId);
  u.searchParams.set("scope", scope);
  u.searchParams.set("page", "1");
  u.searchParams.set("pageSize", "5000");
  if (estado) u.searchParams.set("estado", estado);

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
  const pageParam = parseInt(searchParams?.page || "1", 10);
  const currentPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  const scope = adminCompras ? "all" : "mine";

  const data = await fetchList({ userId: user.IdUsuario, estado, scope });
  const items = data.items || [];

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const paginated = items.slice(start, start + PAGE_SIZE);

  const badge = (s) => (
    <span
      className={`${styles.badge} ${
        s === "APROBADA"
          ? styles.ok
          : s === "RECHAZADA"
          ? styles.warn
          : styles.wait
      }`}
    >
      {s}
    </span>
  );

  const linkFor = (p) => {
    const qs = new URLSearchParams();
    if (estado) qs.set("estado", estado);
    if (p > 1) qs.set("page", String(p));
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

  // ✅ Regla: SOLO si está en estado PREORDEN (ajústalo a tu valor real)
  const isPreorden = (estadoSolicitud) =>
    (estadoSolicitud || "").toUpperCase() === "EN_PREORDEN";

  // ✅ arma el link a anticipos con el idSolicitud
  const anticiposHref = (idSolicitud) =>
    `/anticipos?from=preorden&idSolicitud=${encodeURIComponent(idSolicitud)}`;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          {adminCompras ? "Solicitudes" : "Mis solicitudes"}
        </h1>

        <div className={styles.filters}>
          <a
            className={`${styles.chip} ${!estado ? styles.active : ""}`}
            href="/solicitudes"
          >
            Todas
          </a>
          <a
            className={`${styles.chip} ${
              estado === "PENDIENTE" ? styles.active : ""
            }`}
            href="/solicitudes?estado=PENDIENTE"
          >
            Pendientes
          </a>
          <a
            className={`${styles.chip} ${
              estado === "APROBADA" ? styles.active : ""
            }`}
            href="/solicitudes?estado=APROBADA"
          >
            Aprobadas
          </a>
          <a
            className={`${styles.chip} ${
              estado === "RECHAZADA" ? styles.active : ""
            }`}
            href="/solicitudes?estado=RECHAZADA"
          >
            Rechazadas
          </a>

          {/* opcional: filtro PREORDEN */}
          <a
            className={`${styles.chip} ${
              estado === "PREORDEN" ? styles.active : ""
            }`}
            href="/solicitudes?estado=PREORDEN"
          >
            Preorden
          </a>
        </div>
      </div>

      <div className={styles.card}>
        {total === 0 ? (
          <div className={styles.empty}>No hay solicitudes para esta vista.</div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Código</th>

                  {adminCompras && <th>Solicitante</th>}

                  <th>Estado</th>
                  <th>Creación</th>
                  <th>Aprobación</th>
                  <th>Renglones</th>

                  {adminCompras && <th>Anticipo</th>}


                  <th></th>
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

                  const showAnticipo = isPreorden(r.Estado);

                  return (
                    <tr key={r.IdSolicitud}>
                      <td>{r.Codigo || `#${r.IdSolicitud}`}</td>

                      {adminCompras && (
                        <td>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>
                              {r.SolicitanteNombre || "—"}
                            </span>
                            <span style={{ fontSize: 12, opacity: 0.7 }}>
                              {r.SolicitanteCorreo || ""}
                            </span>
                          </div>
                        </td>
                      )}

                      <td className={styles.stateCell} title={tip}>
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

                      <td>{fmtDate(r.FechaCreacionSoli)}</td>
                      <td>{fmtDate(r.FechaAprobacionSoli)}</td>
                      <td>{r.Renglones}</td>
                      {adminCompras && (
                      <td>
                        {String(r.Estado || "").toUpperCase() === "EN_PREORDEN" ? (
                          r.TieneAnticipo === "Y" ? (
                            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <input type="checkbox" checked readOnly disabled />
                              <span style={{ fontSize: 12, opacity: 0.8 }}>
                                Anticipo creado ({r.NumeroAnticipo || "—"})
                              </span>
                            </label>
                          ) : (
                            <AnticipoCheck
                            idSolicitud={r.IdSolicitud}
                            tieneAnticipo={(r.TieneAnticipo || "N").toUpperCase() === "Y"}
                            numeroAnticipo={r.NumeroAnticipo}
                          />
                          )
                        ) : (
                          <span style={{ opacity: 0.5 }}>—</span>
                        )}
                      </td>
                    )}
                      <td style={{ display: "flex", gap: 8 }}>
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

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
                  href={safePage === 1 ? undefined : linkFor(safePage - 1)}
                  aria-disabled={safePage === 1}
                >
                  «
                </a>

                {pageNumbers().map((p, i) =>
                  p.n ? (
                    <a
                      key={i}
                      href={linkFor(p.n)}
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
                    safePage === totalPages ? undefined : linkFor(safePage + 1)
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
