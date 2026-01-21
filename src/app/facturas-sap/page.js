'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import styles from './Facturas.module.css';
import { getFacturasSap, getFacturaSapByDraft, getUserByEmail } from '@/app/lib/backend';
import { useSession } from "next-auth/react";

// Cargamos el modal solo en cliente
const FacturaPreviewModal = dynamic(
  () => import('@/components/FacturaPreviewModal'),
  { ssr: false }
);

const PAGE_SIZE = 20;

export default function FacturasSAPPage() {
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Estado para el modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [loadingDraft, setLoadingDraft] = useState(false);

  // Buscador
  const [search, setSearch] = useState('');

  // Paginado
  const [page, setPage] = useState(1);

  const { data: session } = useSession();
  const [lockSoloGasto, setLockSoloGasto] = useState(false);

  // ✅ Cache: DraftDocEntry -> true/false si ya tiene gasto
  const [gastoByDraft, setGastoByDraft] = useState({}); // { [DraftDocEntry]: boolean }

  // --------- cargar rol (Data) ----------
  useEffect(() => {
    async function loadRole() {
      try {
        const email = session?.user?.email;
        if (!email) return;

        const u = await getUserByEmail(email);
        const rol = (u?.RolNombre || "").toString().toLowerCase();
        setLockSoloGasto(rol === "data");
      } catch (e) {
        console.error("getUserByEmail role:", e);
        setLockSoloGasto(false);
      }
    }
    loadRole();
  }, [session?.user?.email]);

  // --------- cargar lista ----------
  const loadFacturas = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getFacturasSap();
      setFacturas(data || []);
      setPage(1);
      // opcional: limpiar cache si quieres recalcular todo
      // setGastoByDraft({});
    } catch (err) {
      console.error(err);
      setError(err?.message || 'No se pudieron cargar las facturas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFacturas();
  }, [loadFacturas]);

  // --------- filtro por buscador ----------
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

  // --------- paginado ----------
  const totalRows = filteredFacturas.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginatedFacturas = filteredFacturas.slice(startIndex, endIndex);

  const goToPage = (p) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  // ✅ Detecta si un draft YA tiene gasto leyendo el Draft (real)
  const checkDraftHasGasto = useCallback(async (draftDocEntry) => {
    try {
      const draft = await getFacturaSapByDraft(draftDocEntry);
      const lineas = draft?.Lineas || [];
      // busca ConceptoGasto en cualquiera
      const has = lineas.some(ln => String(ln?.ConceptoGasto || "").trim().length > 0);
      return has;
    } catch (e) {
      console.error("checkDraftHasGasto error:", e);
      return false;
    }
  }, []);

  // ✅ Prefetch (solo para la página actual) y cachear
  useEffect(() => {
    let alive = true;

    (async () => {
      const toCheck = paginatedFacturas
        .map(r => Number(r?.DraftDocEntry))
        .filter(n => Number.isFinite(n) && gastoByDraft[n] === undefined);

      if (!toCheck.length) return;

      // OJO: esto hace llamadas al back por cada draft en la página (máx 20)
      const results = await Promise.all(
        toCheck.map(async (docEntry) => {
          const has = await checkDraftHasGasto(docEntry);
          return [docEntry, has];
        })
      );

      if (!alive) return;

      setGastoByDraft(prev => {
        const next = { ...prev };
        for (const [docEntry, has] of results) next[docEntry] = has;
        return next;
      });
    })();

    return () => { alive = false; };
  }, [paginatedFacturas, gastoByDraft, checkDraftHasGasto]);

  // --------- abrir modal ----------
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
    loadFacturas(); // recarga lista
  };

  // --------- render ----------
  if (loading) return <p className={styles.msg}>Cargando facturas...</p>;
  if (error) return <p className={styles.error}>{error}</p>;

  return (
    <main className={styles.container}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>🧾 Facturas SAP (Borradores)</h1>

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
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID OC</th>
                <th>Solicitud</th>
                <th>Draft DocEntry</th>
                <th>Estado</th>
                <th>Proveedor (SAP)</th>
                <th>Total (SAP)</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {paginatedFacturas.map((f, i) => {
                const docEntry = Number(f?.DraftDocEntry);
                const hasGasto = Number.isFinite(docEntry) ? !!gastoByDraft[docEntry] : false;

                // ✅ si ya tiene gasto => botón "Ver"
                const label = hasGasto ? "Ver" : "Editar";

                return (
                  <tr key={`${f.IdOC}-${f.DraftDocEntry}-${i}`}>
                    <td>{f.IdOC}</td>
                    <td>{f.IdSolicitud}</td>
                    <td>{f.DraftDocEntry}</td>
                    <td>{f.Estado}</td>
                    <td>{f.Proveedor || '—'}</td>
                    <td>
                      {Number(f.TotalSAP != null ? f.TotalSAP : f.DocTotal || 0)
                        .toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td>
                      <button
                        className={styles.btn}
                        onClick={() => handleOpenDraft(f)}
                        disabled={loadingDraft}
                        title={hasGasto ? "Este borrador ya tiene gasto registrado" : "Editar borrador"}
                      >
                        {loadingDraft ? 'Cargando…' : label}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Paginación */}
          <div className={styles.pagination}>
            <div className={styles.pageButtons}>
              <button
                className={`${styles.pageBtn} ${styles.arrowBtn} ${currentPage === 1 ? styles.pageBtnDisabled : ''}`}
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                «
              </button>

              {Array.from({ length: totalPages }, (_, idx) => {
                const p = idx + 1;
                return (
                  <button
                    key={p}
                    className={p === currentPage ? `${styles.pageBtn} ${styles.pageBtnActive}` : styles.pageBtn}
                    onClick={() => goToPage(p)}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                className={`${styles.pageBtn} ${styles.arrowBtn} ${currentPage === totalPages ? styles.pageBtnDisabled : ''}`}
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                »
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal */}
      <FacturaPreviewModal
        open={previewOpen}
        data={previewData}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewData(null);
        }}
        onUse={handleUseDraft}
        modo="facturas_sap"
        lockSoloGasto={lockSoloGasto}
      />
    </main>
  );
}
