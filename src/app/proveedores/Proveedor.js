"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import styles from "./Proveedor.module.css";
import {
  getCondicionesPago,
  solicitarCambioProveedor,
  getProveedoresSapAll,
  getFormasPago,
} from "@/app/lib/backend";
import ProveedorEditModal from "./ProveedorEditModal";

const PAGE_SIZE = 20;

/* =========================
 * Helpers estado
 * ========================= */
function labelEstado(v) {
  const s = String(v || "").toUpperCase().trim();
  if (!s || s === "NORMAL" || s === "APPROVED" || s === "APROBADO") return "Normal";
  if (s.includes("PEND")) return "En espera"; // PENDING / PENDIENTE
  if (s.includes("RECHAZ") || s === "REJECTED") return "Rechazado";
  if (s === "EXPIRED" || s === "EXPIRADO") return "Expirado";
  return s;
}

function badgeClass(v) {
  const s = String(v || "").toUpperCase().trim();
  if (!s || s === "NORMAL" || s === "APPROVED" || s === "APROBADO") return styles.badgeOk;
  if (s.includes("PEND")) return styles.badgeWait;
  if (s.includes("RECHAZ") || s === "REJECTED") return styles.badgeBad;
  if (s === "EXPIRED" || s === "EXPIRADO") return styles.badgeBad;
  return styles.badgeWait;
}

function isPendiente(v) {
  const s = String(v || "").toUpperCase().trim();
  return s.includes("PEND");
}

export default function Proveedor() {
  const { data: session } = useSession();

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [rows, setRows] = useState([]);
  const [condiciones, setCondiciones] = useState([]);
  const [formasPago, setFormasPago] = useState([]);

  const [page, setPage] = useState(1);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const [saving, setSaving] = useState(false);
  const [saveOkMsg, setSaveOkMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    setSaveOkMsg("");

    try {
      const [prov, cond, fp] = await Promise.all([
        getProveedoresSapAll({ q }),
        getCondicionesPago(),
        getFormasPago(),
      ]);

      setRows(Array.isArray(prov) ? prov : []);
      setCondiciones(Array.isArray(cond) ? cond : []);
      setFormasPago(Array.isArray(fp) ? fp : []);
      setPage(1);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;

    return rows.filter((r) => {
      const a = String(r.CodigoSAP || "").toLowerCase();
      const b = String(r.NombreProveedor || "").toLowerCase();
      const c = String(r.IdProveedor || "").toLowerCase();
      return a.includes(t) || b.includes(t) || c.includes(t);
    });
  }, [rows, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const start = (pageSafe - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  function openEdit(r) {
    // ✅ Editar SOLO abre modal
    setSelected(r);
    setErr("");
    setSaveOkMsg("");
    setOpen(true);
  }

  async function onSave(updatedPayload) {
    const card = selected?.CodigoSAP;
    if (!card) {
      setErr("No se encontró CodigoSAP (CardCode).");
      return;
    }

    setErr("");
    setSaveOkMsg("");
    setSaving(true);

    try {
      const requestedBy = session?.user?.email || null;

      // ✅ Aquí SÍ se manda el correo (crea solicitud PENDING)
      const resp = await solicitarCambioProveedor(card, updatedPayload, requestedBy);
      console.log("[solicitarCambioProveedor] resp =>", resp);

      await load();

      setOpen(false);
      setSelected(null);

      setSaveOkMsg("✅ Solicitud enviada a Contabilidad para aprobación.");
    } catch (e) {
      console.error(e);
      setErr(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Proveedores</h1>
          <p className={styles.subtitle}>
            Gestión de datos del proveedor en SAP (días crédito, forma pago, contacto).
          </p>
        </div>

        <div className={styles.actions}>
          <input
            className={styles.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por CardCode / Nombre / RUC..."
          />
          <button className={styles.btn} onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Buscar"}
          </button>
        </div>
      </div>

      {err ? <div className={styles.error}>⚠️ {err}</div> : null}
      {saveOkMsg ? <div className={styles.success}>{saveOkMsg}</div> : null}

      <div className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>CardCode</th>
                <th>Proveedor</th>
                <th>RUC</th>
                <th>Email</th>
                <th>Teléfono 1</th>
                <th>Teléfono 2</th>
                <th>Días crédito</th>
                <th>Forma pago</th>
                <th>Estado</th>
                <th className={styles.thActions}>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className={styles.center}>Cargando...</td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className={styles.center}>Sin resultados</td>
                </tr>
              ) : (
                pageRows.map((r) => {
                  const enEspera = isPendiente(r.EstadoCambio);

                  return (
                    <tr key={r.CodigoSAP}>
                      <td className={styles.mono}>{r.CodigoSAP}</td>
                      <td title={r.NombreProveedor}>{r.NombreProveedor}</td>
                      <td className={styles.mono}>{r.IdProveedor || ""}</td>
                      <td title={r.EmailAddress || ""}>{r.EmailAddress || ""}</td>
                      <td className={styles.mono}>{r.Phone1 || ""}</td>
                      <td className={styles.mono}>{r.Phone2 || ""}</td>
                      <td className={styles.mono}>{String(r.DiasCredito ?? "")}</td>
                      <td className={styles.mono}>{r.FormaPagoNombre || r.U_SYP_FPAGO || ""}</td>

                      <td>
                        <span className={`${styles.badge} ${badgeClass(r.EstadoCambio)}`}>
                          {labelEstado(r.EstadoCambio)}
                        </span>
                      </td>

                      <td className={styles.actionsCell}>
                        <button
                          className={styles.btnBlue}
                          onClick={() => openEdit(r)}
                          disabled={saving || enEspera}
                          title={
                            enEspera
                              ? "Este proveedor tiene cambios pendientes de aprobación"
                              : "Editar proveedor"
                          }
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.pager}>
          <div className={styles.pagerInfo}>
            Página {pageSafe} / {totalPages} • {filtered.length} registros
          </div>

          <div className={styles.pagerBtns}>
            <button className={styles.btnGhost} onClick={() => setPage(1)} disabled={pageSafe === 1}>«</button>
            <button className={styles.btnGhost} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageSafe === 1}>‹</button>
            <button className={styles.btnGhost} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={pageSafe === totalPages}>›</button>
            <button className={styles.btnGhost} onClick={() => setPage(totalPages)} disabled={pageSafe === totalPages}>»</button>
          </div>
        </div>
      </div>

      <ProveedorEditModal
        open={open}
        onClose={() => { setOpen(false); setSelected(null); }}
        proveedor={selected}
        condiciones={condiciones}
        formasPago={formasPago}
        onSave={onSave}
        saving={saving}
        error={err}
      />
    </div>
  );
}
