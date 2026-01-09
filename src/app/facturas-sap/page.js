'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import styles from './Facturas.module.css';
import { getFacturasSap, getFacturaSapByDraft } from '@/app/lib/backend';
import { useSession } from "next-auth/react";
import { getUserByEmail } from "@/app/lib/backend";

// Cargamos el modal solo en cliente
const FacturaPreviewModal = dynamic(
  () => import('@/components/FacturaPreviewModal'),
  { ssr: false }
);

const PAGE_SIZE = 20; // número de filas por página

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

  // --------- cargar lista de borradores ----------
  const loadFacturas = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getFacturasSap();
      setFacturas(data || []);
      setPage(1); // reset página al recargar
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

  // --------- paginado (en memoria) ----------
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

  // --------- al hacer clic en "Editar" ----------
  const handleEditar = async (row) => {
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
      alert(
        'No se pudo cargar el borrador de SAP: ' +
          (err?.message || String(err))
      );
    } finally {
      setLoadingDraft(false);
    }
  };

  // Cuando el modal termina algo (guardar borrador / crear factura), recargamos la lista
  const handleUseDraft = () => {
    setPreviewOpen(false);
    setPreviewData(null);
    loadFacturas();
  };
const { data: session } = useSession();
const [lockSoloGasto, setLockSoloGasto] = useState(false);

useEffect(() => {
  async function loadRole() {
    try {
      const email = session?.user?.email;
      if (!email) return;

      const u = await getUserByEmail(email); // usa TU backend.js
      const rol = (u?.RolNombre || "").toString().toLowerCase(); // viene del API :contentReference[oaicite:1]{index=1}
      setLockSoloGasto(rol === "data");
    } catch (e) {
      console.error("getUserByEmail role:", e);
      setLockSoloGasto(false);
    }
  }
  loadRole();
}, [session?.user?.email]);

  // --------- render ----------
  if (loading) {
    return <p className={styles.msg}>Cargando facturas...</p>;
  }

  if (error) {
    return <p className={styles.error}>{error}</p>;
  }

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
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={loadFacturas}
          >
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
              {paginatedFacturas.map((f, i) => (
                <tr key={`${f.IdOC}-${f.DraftDocEntry}-${i}`}>
                  <td>{f.IdOC}</td>
                  <td>{f.IdSolicitud}</td>
                  <td>{f.DraftDocEntry}</td>
                  <td>{f.Estado}</td>
                  <td>{f.Proveedor || '—'}</td>
                  <td>
                    {Number(
                      f.TotalSAP != null ? f.TotalSAP : f.DocTotal || 0
                    ).toLocaleString('es-EC', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td>
                    <button
                      className={styles.btn}
                      onClick={() => handleEditar(f)}
                      disabled={loadingDraft}
                    >
                      {loadingDraft ? 'Cargando…' : 'Editar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Paginación estilo pill */}
<div className={styles.pagination}>
  <div className={styles.pageButtons}>
    {/* Flecha izquierda */}
    <button
      className={`${styles.pageBtn} ${styles.arrowBtn} ${
        currentPage === 1 ? styles.pageBtnDisabled : ''
      }`}
      onClick={() => goToPage(currentPage - 1)}
      disabled={currentPage === 1}
    >
      «
    </button>

    {/* Números de página */}
    {Array.from({ length: totalPages }, (_, idx) => {
      const p = idx + 1;
      return (
        <button
          key={p}
          className={
            p === currentPage
              ? `${styles.pageBtn} ${styles.pageBtnActive}`
              : styles.pageBtn
          }
          onClick={() => goToPage(p)}
        >
          {p}
        </button>
      );
    })}

    {/* Flecha derecha */}
    <button
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

        </>
      )}

      {/* Modal de edición del Draft OPCH */}
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
