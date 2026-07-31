'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import styles from './Facturas.module.css';
import {
  getFacturasSap,
  getFacturaSapByDraft,
  getUserByEmail,
  downloadFacturaAdjuntoOC,
} from '@/app/lib/backend';
import { useSession } from "next-auth/react";

const FacturaPreviewModal = dynamic(
  () => import('@/components/FacturaPreviewModal'),
  { ssr: false }
);

const PAGE_SIZE = 20;

function formatAuditDate(value) {
  if (!value) return "Pendiente";
  return String(value).substring(0, 19).replace("T", " ");
}

export default function FacturasSAPPage() {
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usuario, setUsuario] = useState(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [loadingDraft, setLoadingDraft] = useState(false);

  const [search, setSearch] = useState('');
  const [gastoFilter, setGastoFilter] = useState('all');
  const [historico, setHistorico] = useState('N');
  const [page, setPage] = useState(1);

  const { data: session } = useSession();
  const [lockSoloGasto, setLockSoloGasto] = useState(false);

  useEffect(() => {
    async function loadRole() {
      try {
        const email = session?.user?.email?.trim();
        if (!email) return;

        const u = await getUserByEmail(email);
        setUsuario(u || null);
        setLockSoloGasto(false);
      } catch (e) {
        console.error("getUserByEmail role:", e);
        setUsuario(null);
        setLockSoloGasto(false);
      }
    }

    loadRole();
  }, [session?.user?.email]);

  const loadFacturas = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getFacturasSap({ historico });
      setFacturas(data || []);
      setPage(1);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'No se pudieron cargar las facturas.');
    } finally {
      setLoading(false);
    }
  }, [historico]);

  useEffect(() => {
    loadFacturas();
  }, [loadFacturas]);

  const filteredFacturas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return facturas;

    return facturas.filter((f) => {
      const idOc = String(f.IdOC ?? '').toLowerCase();
      const idSol = String(f.IdSolicitud ?? '').toLowerCase();
      const draft = String(f.DraftDocEntry ?? '').toLowerCase();
      const prov = String(f.Proveedor ?? '').toLowerCase();
      const estado = String(f.Estado ?? '').toLowerCase();

      return (
        idOc.includes(q) ||
        idSol.includes(q) ||
        draft.includes(q) ||
        prov.includes(q) ||
        estado.includes(q)
      );
    });
  }, [facturas, search]);

  const filteredFacturasFinal = useMemo(() => {
    if (gastoFilter === 'all') return filteredFacturas;

    return filteredFacturas.filter((f) => {
      const hasGasto = !!f?.TieneGasto;

      if (gastoFilter === 'con') return hasGasto;
      if (gastoFilter === 'sin') return !hasGasto;

      return true;
    });
  }, [filteredFacturas, gastoFilter]);

  const totalRows = filteredFacturasFinal.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginatedFacturas = filteredFacturasFinal.slice(startIndex, endIndex);

  const goToPage = (p) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  // ✅ Misma lógica de truncado de páginas que usa /ordenes
  // (1 … 5 6 7 … 40 en vez de listar todos los números sueltos)
  const pageNumbers = () => {
    const max = totalPages;
    const curr = currentPage;
    const out = [];

    const add = (n) => out.push({ n, active: n === curr });

    if (max <= 7) {
      for (let n = 1; n <= max; n++) add(n);
    } else {
      add(1);
      if (curr > 3) out.push({ ellipsis: true, key: 'start' });

      const s = Math.max(2, curr - 1);
      const e = Math.min(max - 1, curr + 1);

      for (let n = s; n <= e; n++) add(n);

      if (curr < max - 2) out.push({ ellipsis: true, key: 'end' });
      add(max);
    }

    return out;
  };

  const handleOpenDraft = async (row) => {
    try {
      setLoadingDraft(true);
      setError('');

      const draft = await getFacturaSapByDraft(row.DraftDocEntry);

      const dataForModal = {
        ...draft,
        OcId: draft.IdOC ?? row.IdOC ?? 0,
      };

      setPreviewData(dataForModal);
      setPreviewOpen(true);
    } catch (err) {
      console.error(err);
      alert('No se pudo cargar el borrador de SAP: ' + (err?.message || String(err)));
    } finally {
      setLoadingDraft(false);
    }
  };

  const handleUseDraft = () => {
    setPreviewOpen(false);
    setPreviewData(null);
    loadFacturas();
  };

  if (loading) return <p className={styles.msg}>Cargando facturas...</p>;
  if (error) return <p className={styles.error}>{error}</p>;

  return (
    <main className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>🧾 Facturas SAP (Borradores)</h1>
          <p className={styles.subtitle}>
            {historico === "Y"
              ? "Mostrando facturas históricas anteriores al 10/06/2026."
              : "Mostrando facturas actuales desde el 10/06/2026."}
          </p>
        </div>

        <div className={styles.toolbar}>
          <input
            type="text"
            placeholder="Buscar por OC, solicitud, proveedor, estado..."
            className={styles.search}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />

          <select
            className={styles.filterSelect}
            value={gastoFilter}
            onChange={(e) => {
              setGastoFilter(e.target.value);
              setPage(1);
            }}
            title="Filtrar por gasto"
          >
            <option value="all">Todos</option>
            <option value="sin">Sin gasto</option>
            <option value="con">Con gasto</option>
          </select>

          <div className={styles.segmented}>
            <button
              type="button"
              className={`${styles.segment} ${
                historico === "N" ? styles.segmentActive : ""
              }`}
              onClick={() => {
                setHistorico("N");
                setPage(1);
              }}
            >
              Actuales
            </button>

            <button
              type="button"
              className={`${styles.segment} ${
                historico === "Y" ? styles.segmentActive : ""
              }`}
              onClick={() => {
                setHistorico("Y");
                setPage(1);
              }}
            >
              Históricas
            </button>
          </div>

          <button type="button" className={styles.btnSecondary} onClick={loadFacturas}>
            Actualizar
          </button>
        </div>
      </div>

      {paginatedFacturas.length === 0 ? (
        <p className={styles.msg}>
          {facturas.length === 0
            ? 'No hay borradores registrados aún.'
            : 'No hay resultados para ese filtro.'}
        </p>
      ) : (
        <>
          <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID OC</th>
                <th>Solicitud</th>
                <th>Draft DocEntry</th>
                <th>Estado</th>
                <th>Últ. Administrativo</th>
                <th>Últ. Data</th>
                <th>Proveedor (SAP)</th>
                <th>Total (SAP)</th>
                <th>Gasto</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {paginatedFacturas.map((f, i) => {
                const hasGasto = !!f?.TieneGasto;
                const pdfHref = f.FacturaAdjuntoId
                  ? downloadFacturaAdjuntoOC(f.IdOC, f.FacturaAdjuntoId)
                  : null;

                return (
                  <tr key={`${f.IdOC}-${f.DraftDocEntry}-${i}`}>
                    <td>{f.IdOC}</td>
                    <td>{f.IdSolicitud}</td>
                    <td>{f.DraftDocEntry}</td>
                    <td>{f.Estado}</td>
                    <td title={f.UsuarioModificacionAdministrativo || ""}>
                      {formatAuditDate(f.FechaModificacionAdministrativo)}
                    </td>
                    <td title={f.UsuarioModificacionData || ""}>
                      {formatAuditDate(f.FechaModificacionData)}
                    </td>
                    <td>{f.Proveedor || '—'}</td>
                    <td>
                      {Number(f.TotalSAP != null ? f.TotalSAP : f.DocTotal || 0)
                        .toLocaleString('es-EC', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                    </td>

                    <td>
                      <span
                        className={`${styles.gastoPill} ${
                          hasGasto ? styles.gastoOk : styles.gastoPend
                        }`}
                        title={hasGasto ? "Con gasto registrado" : "Sin gasto"}
                      >
                        {hasGasto ? "✅ Con gasto" : "⛔ Sin gasto"}
                      </span>
                    </td>

                    <td>
                      <div className={styles.actions}>
                        {/* Icono: ver/descargar PDF de factura */}
                        {pdfHref ? (
                          <a
                            href={pdfHref}
                            target="_blank"
                            rel="noopener"
                            className={styles.iconBtn}
                            title={f.FacturaAdjuntoNombre || 'Ver PDF de factura'}
                          >
                            <svg viewBox="0 0 24 24" fill="none">
                              <path
                                d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M14 3v5h5"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M9 13h6M9 17h6"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                              />
                            </svg>
                          </a>
                        ) : (
                          <span
                            className={`${styles.iconBtn} ${styles.iconBtnDisabled}`}
                            title="Sin factura adjunta"
                          >
                            <svg viewBox="0 0 24 24" fill="none">
                              <path
                                d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M14 3v5h5"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                        )}

                        {/* Icono: editar/ver borrador SAP */}
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => handleOpenDraft(f)}
                          disabled={loadingDraft}
                          title={
                            hasGasto
                              ? "Ver borrador (ya tiene gasto registrado)"
                              : "Editar borrador"
                          }
                        >
                          {hasGasto ? (
                            <svg viewBox="0 0 24 24" fill="none">
                              <path
                                d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinejoin="round"
                              />
                              <circle
                                cx="12"
                                cy="12"
                                r="3"
                                stroke="currentColor"
                                strokeWidth="1.8"
                              />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none">
                              <path
                                d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M13.5 6.5 17.5 10.5"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          {/* ✅ Paginación estilo /ordenes: "Mostrando X–Y de Z" + números truncados */}
          {totalRows > 0 && (
            <div className={styles.pager}>
              <span className={styles.pagerInfo}>
                Mostrando {startIndex + 1}–{Math.min(totalRows, startIndex + paginatedFacturas.length)} de {totalRows}
              </span>

              <div className={styles.pagerNav}>
                <button
                  type="button"
                  className={`${styles.pageBtn} ${styles.arrowBtn} ${
                    currentPage === 1 ? styles.pageBtnDisabled : ''
                  }`}
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  «
                </button>

                {pageNumbers().map((p, idx) =>
                  p.ellipsis ? (
                    <span key={`ellipsis-${p.key}-${idx}`} className={styles.ellipsis}>
                      …
                    </span>
                  ) : (
                    <button
                      type="button"
                      key={p.n}
                      className={`${styles.pageBtn} ${p.active ? styles.pageBtnActive : ''}`}
                      onClick={() => goToPage(p.n)}
                    >
                      {p.n}
                    </button>
                  )
                )}

                <button
                  type="button"
                  className={`${styles.pageBtn} ${styles.arrowBtn} ${
                    currentPage === totalPages ? styles.pageBtnDisabled : ''
                  }`}
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  »
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <FacturaPreviewModal
        open={previewOpen}
        data={previewData}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewData(null);
        }}
        onUse={handleUseDraft}
        modo="facturas_sap"
        rolNombre={usuario?.RolNombre || ""}
        rolId={usuario?.RolId ?? null}
        lockSoloGasto={lockSoloGasto}
      />
    </main>
  );
}
