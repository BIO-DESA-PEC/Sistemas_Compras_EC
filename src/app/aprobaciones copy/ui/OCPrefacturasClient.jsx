// app/aprobaciones/ui/OCPrefacturasClient.jsx
"use client";

import { useMemo, useState, useEffect } from "react";
import styles from "../aprobaciones.module.css";
import { approveOVDraft, rejectOVDraft } from "@/app/lib/backend";

export default function OCPrefacturasClient({ initial = [], userId, pageSize = 15 }) {
  const [rows, setRows] = useState(initial || []);
  const [busyId, setBusyId] = useState(null);

  // --- Paginación ---
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  const pad = (n) => String(n).padStart(2, "0");
  const fmtDateTime = (iso) => {
    if (!iso) return "--";
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  async function handleApprove(row) {
    try {
      setBusyId(row.IdDraft);
      await approveOVDraft(row.IdDraft, userId);
      setRows(prev => prev.filter(r => r.IdDraft !== row.IdDraft));
    } catch (e) { console.error(e); alert("No se pudo aprobar."); }
    finally { setBusyId(null); }
  }

  async function handleReject(row) {
    try {
      const comentario = window.prompt("Comentario de rechazo (opcional):", "") || "";
      setBusyId(row.IdDraft);
      await rejectOVDraft(row.IdDraft, userId, comentario);
      setRows(prev => prev.filter(r => r.IdDraft !== row.IdDraft));
    } catch (e) { console.error(e); alert("No se pudo rechazar."); }
    finally { setBusyId(null); }
  }

  return (
    <div className={styles.card} style={{ marginTop: 24 }}>
      <h2 style={{ marginBottom: 12 }}>Prefacturas OC pendientes</h2>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#OC</th>
              <th>Nro Prefactura</th>
              <th>Nivel</th>
              <th>Creación</th>
              <th>Total</th>
              <th style={{ width: 220 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>No hay prefacturas pendientes.</td></tr>
            ) : (
              pageRows.map((row) => (
                <tr key={row.IdDraft}>
                  <td>#{row.IdOC}</td>
                  <td>{row.NumeroPrefactura || "-"}</td>
                  <td>{row.Nivel}/{row.NivelMax}</td>
                  <td>{fmtDateTime(row.FechaCreacion)}</td>
                  <td>{Number(row.Total || 0).toFixed(2)}</td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.btnPrimary} onClick={() => handleApprove(row)} disabled={busyId === row.IdDraft}>
                        {busyId === row.IdDraft ? "Procesando..." : "Aprobar"}
                      </button>
                      <button className={styles.btnDanger} onClick={() => handleReject(row)} disabled={busyId === row.IdDraft}>
                        {busyId === row.IdDraft ? "Procesando..." : "Rechazar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginador */}
      <div className={styles.pagination}>
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>‹</button>
        <span>Página {page} de {totalPages}</span>
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>›</button>
      </div>
    </div>
  );
}
