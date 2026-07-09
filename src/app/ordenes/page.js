import Link from "next/link";
import { auth } from "@/auth";
import { getOCList } from "@/app/lib/backend";
import NumeroOrdenCompraCell from "./NumeroOrdenCompraCell";
import EstadoSapCell from "./EstadoSapCell";
import styles from "./ordenes.module.css";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 15;

export default async function OCListPage({ searchParams }) {
  const session = await auth();

  const userEmail = (session?.user?.email || "").trim().toLowerCase();
  const rolNombre = (session?.user?.RolNombre || "").trim().toUpperCase();
  const rolId = Number(session?.user?.RolId);

  const isAdmin = rolId === 1 || rolNombre === "ADMINISTRADOR";
  const isBrithanny = userEmail === "brithanny.ortega@biocellsmed.com";
  const canEditNumeroOrdenCompra = true;
  const canEditEstadoSAP = true;
  const estado = (searchParams?.estado ?? "Todos").toString();
  const q = (searchParams?.q ?? "").toString().trim();
  const fechaDesde = (searchParams?.fechaDesde ?? "").toString().trim();
  const fechaHasta = (searchParams?.fechaHasta ?? "").toString().trim();
  const historico = searchParams?.historico === "Y" ? "Y" : "N";
  const facturaSAP = (searchParams?.facturaSAP ?? "").toString().trim();

  const pageParam = parseInt((searchParams?.page ?? "1").toString(), 10);
  const currentPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  // --- NUEVO: la paginación, el total y el filtro de facturaSAP ahora
  // los resuelve el backend. Ya no se trae ni se filtra el arreglo completo aquí. ---
  let paginated = [];
  let total = 0;
  let totalPages = 1;
  let safePage = currentPage;
  let error = null;

  try {
    const res = await getOCList({
      estado,
      q,
      historico,
      fechaDesde,
      fechaHasta,
      facturaSAP,
      page: currentPage,
      pageSize: PAGE_SIZE,
    });

    // getOCList debe pasar estos params tal cual al backend
    // (?page=&pageSize=&facturaSAP=) — ver nota al final.
    paginated = Array.isArray(res?.data) ? res.data : [];
    total = Number(res?.total ?? 0);
    totalPages = Number(res?.totalPages ?? 1);
    safePage = Number(res?.page ?? currentPage);
  } catch (e) {
    error = e?.message ?? "Error cargando órdenes";
    paginated = [];
    total = 0;
    totalPages = 1;
  }

  const start = (safePage - 1) * PAGE_SIZE;

  const estadoOpts = [
    "Todos",
    "GENERADA",
    "PENDIENTE FACTURAR",
    "PROCESADA",
    "ANULADA",
    "RECHAZADA",
  ];

  const buildLink = ({
    newEstado = estado,
    newHistorico = historico,
    newFacturaSAP = facturaSAP,
    newFechaDesde = fechaDesde,
    newFechaHasta = fechaHasta,
    page = 1,
  } = {}) => {
    const qs = new URLSearchParams();

    if (q) qs.set("q", q);
    if (newFacturaSAP) qs.set("facturaSAP", newFacturaSAP);
    if (newEstado && newEstado !== "Todos") qs.set("estado", newEstado);
    if (newHistorico === "Y") qs.set("historico", "Y");
    if (newFechaDesde) qs.set("fechaDesde", newFechaDesde);
    if (newFechaHasta) qs.set("fechaHasta", newFechaHasta);
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

  const excelHref = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/oc/export-excel?${new URLSearchParams({
    ...(q ? { q } : {}),
    ...(estado && estado !== "Todos" ? { estado } : {}),
    ...(historico === "Y" ? { historico: "Y" } : {}),
    ...(fechaDesde ? { fechaDesde } : {}),
    ...(fechaHasta ? { fechaHasta } : {}),
    ...(facturaSAP ? { facturaSAP } : {}),
  }).toString()}`;

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

          <div className={styles.headerActions}>
          <Link href="/ordenes/nueva" className={styles.newBtn}>
            + Nueva orden
          </Link>

          <a href={excelHref} className={styles.newBtn}>
            Descargar Excel
          </a>
        </div>
        </div>
        
        <div className={styles.filters}>
          <div className={styles.chipsGroup}>
            {estadoOpts.map((est) => (
              <Link
                key={est}
                href={buildLink({
                  newEstado: est,
                  page: 1,
                })}
                prefetch={false}
                className={`${styles.chip} ${
                  estado === est ? styles.active : ""
                }`}
              >
                {est}
              </Link>
            ))}
          </div>

          <div className={styles.segmented}>
            <Link
              href={buildLink({
                newHistorico: "N",
                page: 1,
              })}
              prefetch={false}
              className={`${styles.segment} ${
                historico !== "Y" ? styles.segmentActive : ""
              }`}
            >
              Actuales
            </Link>

            <Link
              href={buildLink({
                newHistorico: "Y",
                page: 1,
              })}
              prefetch={false}
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

            {facturaSAP && (
              <input type="hidden" name="facturaSAP" value={facturaSAP} />
            )}
            {fechaDesde && (
              <input type="hidden" name="fechaDesde" value={fechaDesde} />
            )}

            {fechaHasta && (
              <input type="hidden" name="fechaHasta" value={fechaHasta} />
            )}
            <input
              name="q"
              placeholder="Buscar por #OC, #Solicitud o #PreOC"
              defaultValue={q}
            />

            <button type="submit">Filtrar</button>
          </form>
          <form className={styles.dateFilter} action="/ordenes" method="get">
  {q && <input type="hidden" name="q" value={q} />}

  {estado && estado !== "Todos" && (
    <input type="hidden" name="estado" value={estado} />
  )}

  {historico === "Y" && (
    <input type="hidden" name="historico" value="Y" />
  )}

  {facturaSAP && (
    <input type="hidden" name="facturaSAP" value={facturaSAP} />
  )}

  <input
    type="date"
    name="fechaDesde"
    defaultValue={fechaDesde}
    title="Fecha desde"
  />

  <input
    type="date"
    name="fechaHasta"
    defaultValue={fechaHasta}
    title="Fecha hasta"
  />

  <button type="submit">Filtrar fechas</button>

  {(fechaDesde || fechaHasta) && (
  <Link
    href={`/ordenes${historico === "Y" ? "?historico=Y" : ""}`}
    className={styles.clearFilter}
  >
    Limpiar fechas
  </Link>
)}
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
            <div>Draft SAP</div>

            <div className={styles.filterBox}>
              <button
                type="button"
                popoverTarget="facturaSapFilter"
                className={`${styles.filterHeader} ${
                  facturaSAP ? styles.filterHeaderActive : ""
                }`}
                title="Buscar por Factura SAP"
              >
                <span>Factura SAP</span>

                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 5h16l-6 7v5l-4 2v-7L4 5z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <div
                id="facturaSapFilter"
                popover="auto"
                className={styles.filterPanel}
              >
                <form action="/ordenes" method="get">
                  <strong>Factura SAP</strong>
                  <span>Buscar orden por factura SAP</span>

                  {q && <input type="hidden" name="q" value={q} />}

                  {estado && estado !== "Todos" && (
                    <input type="hidden" name="estado" value={estado} />
                  )}

                  {historico === "Y" && (
                    <input type="hidden" name="historico" value="Y" />
                  )}

                  <div className={styles.filterInputWrap}>
                    <input
                      name="facturaSAP"
                      placeholder="Ingrese factura SAP"
                      defaultValue={facturaSAP}
                      autoComplete="off"
                    />

                    <button type="submit">🔎</button>
                  </div>

                  {facturaSAP && (
                    <Link
                      href={buildLink({ newFacturaSAP: "", page: 1 })}
                      className={styles.clearFilter}
                    >
                      Limpiar filtro
                    </Link>
                  )}
                </form>
              </div>
            </div>
            <div>Cod. proveedor</div>
            <div>Proveedor</div>
            <div>Fecha pago</div>
            <div>Comentario SAP</div>
            <div>Número Orden Compra</div>
            <div>Estado SAP</div>
            <div>Comentario cambio estado</div>
            <div className={styles.num}>Total SAP</div>
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
                        <div className={`${styles.badge} ${badgeClass}`}>
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

                <div>{r.DraftDocEntry || "—"}</div>
                <div>{r.FacturaSAP || "—"}</div>
                <div>{r.SapCardCode || "—"}</div>
                <div>{r.SapCardName || "—"}</div>
                <div>{r.SapFechaPago ? String(r.SapFechaPago).slice(0, 10) : "—"}</div>
                <div title={r.SapComments || ""}>
                  {r.SapComments || "—"}
                </div>
                <NumeroOrdenCompraCell
                  idOC={r.IdOC}
                  value={r.NumeroOrdenCompra}
                  canEdit={canEditNumeroOrdenCompra}
                  userEmail={userEmail}
                />
                <EstadoSapCell
                      idOC={r.IdOC}
                      estadoInicial={r.EstadoSAP}
                      comentarioInicial={r.ComentarioSAP}
                      canEdit={canEditEstadoSAP}
                      userEmail={userEmail}
                    />
                  <div className={styles.num}>
                  {Number(r.Total || 0).toLocaleString("es-EC", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>

                <div className={styles.actions}>
  {r.PendienteFacturar ? (
    <Link
      href={`/ordenes/${r.IdOC}?facturar=1`}
      className={styles.facturarBtn}
      title="Facturar"
    >
      📄
    </Link>
  ) : r.Estado === "GENERADA" ? (
    <Link
      href={`/ordenes/${r.IdOC}`}
      className={styles.iconBtn}
      title="Editar OC"
    >
      ✎
    </Link>
  ) : (
    <Link
      href={`/ordenes/${r.IdOC}`}
      className={`${styles.iconBtn} ${styles.ghost}`}
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
    title="Descargar orden de compra"
  >
    OC
  </a>

  {r.FacturaAdjuntoId ? (
    <a
      href={`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/oc/${r.IdOC}/factura/adjunto/${r.FacturaAdjuntoId}/download`}
      target="_blank"
      rel="noopener"
      className={`${styles.iconBtn} ${styles.ghost}`}
      title="Descargar factura"
    >
      FAC
    </a>
  ) : (
    <span
      className={`${styles.iconBtn} ${styles.ghost}`}
      title="Sin factura adjunta"
      style={{ opacity: 0.45, cursor: "not-allowed" }}
    >
      FAC
    </span>
  )}
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
                prefetch={false}
              >
                «
              </Link>

              {pageNumbers().map((p, i) =>
                p.n ? (
                  <Link
                    key={i}
                    href={buildLink({ page: p.n })}
                    prefetch={false}
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
                  safePage === totalPages
                    ? "#"
                    : buildLink({ page: safePage + 1 })
                }
                prefetch={false}
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