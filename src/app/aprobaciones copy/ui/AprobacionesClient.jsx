// app/aprobaciones/ui/AprobacionesClient.jsx
"use client";

import { useMemo, useState, useEffect } from "react";
import styles from "../aprobaciones.module.css";
import { postApprovalsDecide } from "@/app/lib/backend";

export default function AprobacionesClient({ initial = [], userId, pageSize = 15 }) {
  const [rows, setRows] = useState(initial || []);
  const [selected, setSelected] = useState(() => new Set());
  const [busyId, setBusyId] = useState(null);
  const [busyBulk, setBusyBulk] = useState(false);

  // --- Paginación ---
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  // Ids y campos
  const getApprovalId = (r) => r.IdAprobacion ?? r.ApprovalId ?? r.Id ?? r.IdSolicitud;
  const getSolicitudId = (r) => r.IdSolicitud ?? r.SolicitudId ?? r.Id;
  const getTotal = (r) => r.Total ?? r.MontoTotal ?? r.total ?? 0;
  const getDepto = (r) => r.Departamento ?? r.Depto ?? "--";
  const getSolicitante = (r) => r.Solicitante ?? r.SolicitanteNombre ?? "--";
  const getRenglones = (r) => r.Renglones ?? r.NumRenglones ?? 0;
  const getCreacion = (r) => r.FechaCreacion ?? r.Creacion ?? r.createdAt ?? null;

  const pad = (n) => String(n).padStart(2, "0");
  const fmtDateTime = (iso) => {
    if (!iso) return "--";
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  function toggleSelect(row) {
    const id = getApprovalId(row);
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  async function decideOne(row, action) {
    const approvalId = getApprovalId(row);
    if (!approvalId) return;

    let comentario = "";
    if (action === "REJECT") comentario = window.prompt("Comentario (opcional):", "") || "";

    try {
      setBusyId(approvalId);
      await postApprovalsDecide(userId, [approvalId], action, comentario);
      setRows((prev) => prev.filter((r) => getApprovalId(r) !== approvalId));
      setSelected((prev) => { const n = new Set(prev); n.delete(approvalId); return n; });
    } catch (e) {
      console.error(e);
      alert("No se pudo completar la acción.");
    } finally {
      setBusyId(null);
    }
  }

  async function decideSelected(action) {
    const ids = Array.from(selected);
    if (ids.length === 0) { alert("Selecciona al menos una solicitud."); return; }
    let comentario = "";
    if (action === "REJECT") comentario = window.prompt("Comentario (opcional para todas):", "") || "";
    try {
      setBusyBulk(true);
      await postApprovalsDecide(userId, ids, action, comentario);
      setRows((prev) => prev.filter((r) => !selected.has(getApprovalId(r))));
      setSelected(new Set());
    } catch (e) {
      console.error(e);
      alert("No se pudo completar la acción masiva.");
    } finally {
      setBusyBulk(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.toolbar}>
        <button
          className={styles.btnPrimary}
          onClick={() => decideSelected("APPROVE")}
          disabled={busyBulk || selected.size === 0}
        >
          {busyBulk ? "Procesando..." : "Aprobar seleccionadas"}
        </button>
        <button
          className={styles.btnDanger}
          onClick={() => decideSelected("REJECT")}
          disabled={busyBulk || selected.size === 0}
        >
          {busyBulk ? "Procesando..." : "Rechazar seleccionadas"}
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>#Soli</th>
              <th>Solicitante</th>
              <th>Depto</th>
              <th>Creación</th>
              <th>Renglones</th>
              <th>Total</th>
              <th style={{ width: 220 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={8} className={styles.empty}>No hay aprobaciones pendientes.</td></tr>
            ) : (
              pageRows.map((row) => {
                const approvalId = getApprovalId(row);
                const isBusy = busyId === approvalId || busyBulk;
                const isChecked = selected.has(approvalId);
                return (
                  <tr key={approvalId ?? getSolicitudId(row)}>
                    <td>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleSelect(row)} disabled={isBusy}/>
                    </td>
                    <td>#{getSolicitudId(row)}</td>
                    <td>{getSolicitante(row)}</td>
                    <td>{getDepto(row)}</td>
                    <td>{fmtDateTime(getCreacion(row))}</td>
                    <td>{getRenglones(row)}</td>
                    <td>{Number(getTotal(row)).toFixed(2)}</td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.btnPrimary} onClick={() => decideOne(row, "APPROVE")} disabled={isBusy}>
                          {isBusy ? "..." : "Aprobar"}
                        </button>
                        <button className={styles.btnDanger} onClick={() => decideOne(row, "REJECT")} disabled={isBusy}>
                          {isBusy ? "..." : "Rechazar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
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
