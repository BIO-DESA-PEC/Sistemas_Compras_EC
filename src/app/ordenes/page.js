import Link from "next/link";
import { getOCList } from "@/app/lib/backend";
import styles from "./ordenes.module.css";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 15;

export default async function OCListPage({ searchParams }) {
  const estado = (searchParams?.estado ?? "Todos").toString();
  const q = (searchParams?.q ?? "").toString().trim();
  const pageParam = parseInt((searchParams?.page ?? "1").toString(), 10);
  const currentPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  let items = [];
  let error = null;

  try {
    const res = await getOCList({ estado, q });
    if (Array.isArray(res)) items = res;
    else if (Array.isArray(res?.data)) items = res.data;
    else items = [];
  } catch (e) {
    error = e?.message ?? "Error cargando órdenes";
    items = [];
  }

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const paginated = items.slice(start, start + PAGE_SIZE);

  const estadoOpts = [
    "Todos",
    "GENERADA",
    "PENDIENTE FACTURAR",
    "PROCESADA",
    "ANULADA",
    "RECHAZADA",
  ];

  const linkFor = (p) => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (estado && estado !== "Todos") qs.set("estado", estado);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return `/ordenes${s ? `?${s}` : ""}`;
  };

  const linkForEstado = (est) => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (est && est !== "Todos") qs.set("estado", est);
    const s = qs.toString();
    return `/ordenes${s ? `?${s}` : ""}`;
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
  <div className={styles.headerTop}>
    <h1 className={styles.title}>Órdenes de compra</h1>

    <Link href="/ordenes/nueva" className={styles.newBtn}>
      + Nueva orden
    </Link>
  </div>

  <div className={styles.filters}>
          {estadoOpts.map((est) => (
            <Link
              key={est}
              href={linkForEstado(est)}
              className={`${styles.chip} ${estado === est ? styles.active : ""}`}
            >
              {est}
            </Link>
          ))}

          <form className={styles.search} action="/ordenes" method="get">
            {estado && estado !== "Todos" && (
              <input type="hidden" name="estado" value={estado} />
            )}
            <input
              name="q"
              placeholder="Buscar por #OC, #Solicitud o #PreOC"
              defaultValue={q}
            />
            <button type="submit">Filtrar</button>
          </form>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.card}>
        <div className={styles.table}>
          <div className={`${styles.row} ${styles.headerRow}`}>
            <div>#OC</div>
            <div>#Solicitud</div>
            <div>#Pre-OC</div>
            <div>Solicitó</div>
            <div>Fecha</div>
            <div>Estado</div>
            <div className={styles.num}>Total</div>
            <div className={styles.actionsH}>Acciones</div>
          </div>

          {paginated.length === 0 ? (
            <div className={styles.empty}>No hay órdenes para mostrar.</div>
          ) : (
            paginated.map((r) => (
              <div key={r.IdOC} className={styles.row}>
                <Link className={styles.link} href={`/ordenes/${r.IdOC}`}>
                  #{r.IdOC}
                </Link>

                <span className={styles.linkMuted}>
                  {r.IdSolicitud ? `#${r.IdSolicitud}` : "—"}
                </span>

                <span className={styles.linkMuted}>
                  {r.IdPreOC ? `#${r.IdPreOC}` : "—"}
                </span>

                <div>{r.SolicitanteNombre || "—"}</div>

                <div>{r.Fecha ?? "—"}</div>

                <div className={styles.stateCell}>
                  {(() => {
                    const visual = r.EstadoVisual || r.Estado || "—";
                    const key = visual.toLowerCase().replaceAll(" ", "_");
                    const badgeClass =
                      styles[`state_${key}`] || styles.state_generada;

                    return (
                      <>
                        <div className={`${styles.badge} ${badgeClass}`}>
                          {visual}
                        </div>
                        {r.EnAprobacion ? (
                          <div className={styles.subnote}>
                            En aprobación —{" "}
                            <b>{r.AprobadorPendiente || r.NivelPendiente || "pendiente"}</b>
                          </div>
                        ) : null}
                      </>
                    );
                  })()}
                </div>

                <div className={styles.num}>
                  {Number(r.Total || 0).toLocaleString()}
                </div>

                <div className={styles.actions}>
                  {r.PendienteFacturar ? (
                    <Link
                      href={`/ordenes/${r.IdOC}?facturar=1`}
                      className={styles.facturarBtn}
                      aria-label={`Facturar OC #${r.IdOC}`}
                      title="Facturar"
                    >
                      <svg
                        className={styles.icon}
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <path
                          d="M8.5 8H15.5M8.5 12H15.5M8.5 16H13"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </Link>
                  ) : r.Estado === "GENERADA" ? (
                    <Link
                      href={`/ordenes/${r.IdOC}`}
                      className={styles.iconBtn}
                      aria-label={`Editar OC #${r.IdOC}`}
                      title="Editar OC"
                    >
                      <svg
                        className={styles.icon}
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M3 17.25V21h3.75l11.06-11.06-3.75-3.75L3 17.25z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          fill="currentColor"
                        />
                        <path
                          d="M14.06 6.94l3.75 3.75 1.06-1.06a1.5 1.5 0 0 0 0-2.12l-1.63-1.63a1.5 1.5 0 0 0-2.12 0l-1.06 1.06z"
                          fill="currentColor"
                        />
                      </svg>
                    </Link>
                  ) : (
                    <Link
                      href={`/ordenes/${r.IdOC}`}
                      className={`${styles.iconBtn} ${styles.ghost}`}
                      aria-label={`Ver OC #${r.IdOC}`}
                      title="Ver OC"
                    >
                      <svg
                        className={styles.icon}
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M1.5 12S5.5 5.5 12 5.5 22.5 12 22.5 12 18.5 18.5 12 18.5 1.5 12 1.5 12Z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="3.25"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      </svg>
                    </Link>
                  )}

                  <a
                    href={`https://back-compras-ec.onrender.com/api/oc/${r.IdOC}/pdf`}
                    target="_blank"
                    rel="noopener"
                    className={`${styles.iconBtn} ${styles.ghost}`}
                    aria-label={`Descargar PDF OC #${r.IdOC}`}
                    title="PDF"
                  >
                    <svg
                      className={styles.icon}
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M12 3v10m0 0l-4-4m4 4l4-4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path d="M4 17h16v3H4z" fill="currentColor" />
                    </svg>
                  </a>
                </div>
              </div>
            ))
          )}
        </div>

        {total > 0 && (
          <div className={styles.pager}>
            <span className={styles.pagerInfo}>
              Mostrando {start + 1}–{Math.min(total, start + paginated.length)} de {total}
            </span>
            <div className={styles.pagerNav}>
              <Link
                className={`${styles.pageBtn} ${safePage === 1 ? styles.disabled : ""}`}
                href={safePage === 1 ? "#" : linkFor(safePage - 1)}
                aria-disabled={safePage === 1}
              >
                «
              </Link>

              {pageNumbers().map((p, i) =>
                p.n ? (
                  <Link
                    key={i}
                    href={linkFor(p.n)}
                    className={`${styles.pageBtn} ${p.active ? styles.pageActive : ""}`}
                  >
                    {p.label}
                  </Link>
                ) : (
                  <span key={i} className={styles.ellipsis}>
                    …
                  </span>
                )
              )}

              <Link
                className={`${styles.pageBtn} ${safePage === totalPages ? styles.disabled : ""}`}
                href={safePage === totalPages ? "#" : linkFor(safePage + 1)}
                aria-disabled={safePage === totalPages}
              >
                »
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}