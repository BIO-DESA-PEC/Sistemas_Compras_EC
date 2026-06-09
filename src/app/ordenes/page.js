import Link from "next/link";
import { getOCList } from "@/app/lib/backend";
import styles from "./ordenes.module.css";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 15;

export default async function OCListPage({ searchParams }) {
  const estado = (searchParams?.estado ?? "Todos").toString();
  const q = (searchParams?.q ?? "").toString().trim();
  const historico = searchParams?.historico === "Y" ? "Y" : "N";

  const pageParam = parseInt((searchParams?.page ?? "1").toString(), 10);
  const currentPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  let items = [];
  let error = null;

  try {
    const res = await getOCList({ estado, q, historico });
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

  const buildLink = ({ newEstado = estado, newHistorico = historico, page = 1 }) => {
    const qs = new URLSearchParams();

    if (q) qs.set("q", q);
    if (newEstado && newEstado !== "Todos") qs.set("estado", newEstado);
    if (newHistorico === "Y") qs.set("historico", "Y");
    if (page > 1) qs.set("page", String(page));

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
          <div>
            <h1 className={styles.title}>Órdenes de compra</h1>
            <p className={styles.subtitle}>
              {historico === "Y"
                ? "Mostrando órdenes históricas anteriores al 10/06/2026."
                : "Mostrando órdenes actuales desde el 10/06/2026."}
            </p>
          </div>

          <Link href="/ordenes/nueva" className={styles.newBtn}>
            + Nueva orden
          </Link>
        </div>

        <div className={styles.filters}>
          {estadoOpts.map((est) => (
            <Link
              key={est}
              href={buildLink({ newEstado: est, page: 1 })}
              className={`${styles.chip} ${estado === est ? styles.active : ""}`}
            >
              {est}
            </Link>
          ))}

          <div className={styles.segmented}>
            <Link
              href={buildLink({ newHistorico: "N", page: 1 })}
              className={`${styles.segment} ${
                historico !== "Y" ? styles.segmentActive : ""
              }`}
            >
              Actuales
            </Link>

            <Link
              href={buildLink({ newHistorico: "Y", page: 1 })}
              className={`${styles.segment} ${
                historico === "Y" ? styles.segmentActive : ""
              }`}
            >
              Históricas
            </Link>
          </div>

          <form className={styles.search} action="/ordenes" method="get">
            {estado && estado !== "Todos" && (
              <input type="hidden" name="estado" value={estado} />
            )}

            {historico === "Y" && (
              <input type="hidden" name="historico" value="Y" />
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
                <div className={styles.ocContainer}>
                  <Link className={styles.link} href={`/ordenes/${r.IdOC}`}>
                    #{r.IdOC}
                  </Link>

                  {r.EsAnticipo && (
                    <span
                      className={styles.anticipoTag}
                      title={`Orden generada desde el anticipo ${
                        r.CodigoAnticipo || ""
                      }`}
                    >
                      ANTICIPO
                    </span>
                  )}
                </div>

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
                        <div
                          className={`${styles.badge} ${badgeClass}`}
                          title={
                            visual === "ANULADA"
                              ? `Motivo: ${
                                  r.ComentarioOC || "Sin motivo registrado"
                                }`
                              : ""
                          }
                        >
                          {visual}
                        </div>

                        {r.EnAprobacion ? (
                          <div className={styles.subnote}>
                            En aprobación —{" "}
                            <b>
                              {r.AprobadorPendiente ||
                                r.NivelPendiente ||
                                "pendiente"}
                            </b>
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
                      ✎
                    </Link>
                  ) : (
                    <Link
                      href={`/ordenes/${r.IdOC}`}
                      className={`${styles.iconBtn} ${styles.ghost}`}
                      aria-label={`Ver OC #${r.IdOC}`}
                      title="Ver OC"
                    >
                      👁
                    </Link>
                  )}

                  <a
                    href={`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/oc/${r.IdOC}/pdf`}
                    target="_blank"
                    rel="noopener"
                    className={`${styles.iconBtn} ${styles.ghost}`}
                    aria-label={`Descargar PDF OC #${r.IdOC}`}
                    title="PDF"
                  >
                    PDF
                  </a>
                </div>
              </div>
            ))
          )}
        </div>

        {total > 0 && (
          <div className={styles.pager}>
            <span className={styles.pagerInfo}>
              Mostrando {start + 1}–
              {Math.min(total, start + paginated.length)} de {total}
            </span>

            <div className={styles.pagerNav}>
              <Link
                className={`${styles.pageBtn} ${
                  safePage === 1 ? styles.disabled : ""
                }`}
                href={safePage === 1 ? "#" : buildLink({ page: safePage - 1 })}
                aria-disabled={safePage === 1}
              >
                «
              </Link>

              {pageNumbers().map((p, i) =>
                p.n ? (
                  <Link
                    key={i}
                    href={buildLink({ page: p.n })}
                    className={`${styles.pageBtn} ${
                      p.active ? styles.pageActive : ""
                    }`}
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
                className={`${styles.pageBtn} ${
                  safePage === totalPages ? styles.disabled : ""
                }`}
                href={
                  safePage === totalPages ? "#" : buildLink({ page: safePage + 1 })
                }
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