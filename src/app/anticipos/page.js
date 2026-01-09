"use client";

import { useEffect, useState } from "react";
import styles from "./anticipos.module.css";
import AnticipoModal from "./AnticipoModal";
import AnticipoViewModal from "./AnticipoViewModal";
import dynamic from "next/dynamic";

const FacturaPreviewModal = dynamic(
  () => import("@/components/FacturaPreviewModal"),
  { ssr: false }
);

const API = process.env.NEXT_PUBLIC_BACKEND_URL;
const PAGE_SIZE = 20;

export default function AnticiposPage() {
  const [anticipos, setAnticipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedAnticipo, setSelectedAnticipo] = useState(null);
  const [page, setPage] = useState(1);

  // ===== Facturación =====
  const [showFacturaForm, setShowFacturaForm] = useState(false);
  const [factEstable, setFactEstable] = useState("");
  const [factPtoEmi, setFactPtoEmi] = useState("");
  const [factSecu, setFactSecu] = useState("");
  const [sending, setSending] = useState(false);

  // ✅ Igual que compras/OC: open + data
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  async function loadAnticipos() {
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/anticipos`);
      if (!res.ok) throw new Error("Error al cargar anticipos");
      const data = await res.json();
      setAnticipos(data || []);
      setPage(1);
    } catch (err) {
      console.error("ERROR CARGANDO ANTICIPOS:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnticipos();
  }, []);

  function estadoClass(estado) {
    const base = styles.estado;
    if (!estado) return base;
    const e = estado.toLowerCase();
    if (e.includes("pend")) return `${base} ${styles.estadoPendiente}`;
    if (e.includes("paga")) return `${base} ${styles.estadoPagado}`;
    if (e.includes("anul")) return `${base} ${styles.estadoAnulado}`;
    return base;
  }

  async function handleCancel(anticipo) {
    if (!anticipo?.code) {
      alert("No se encontró el código del anticipo.");
      return;
    }

    const estado = (anticipo.estadoAnticipo || "").toLowerCase();
    if (estado !== "pendiente") {
      alert("Solo se pueden anular anticipos en estado Pendiente.");
      return;
    }

    const ok = window.confirm(
      `¿Seguro que deseas anular el anticipo ${anticipo.numeroAnticipo}?`
    );
    if (!ok) return;

    try {
      setLoading(true);
      const res = await fetch(`${API}/anticipos/${anticipo.code}/anular`, {
        method: "PUT",
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error("Error al anular anticipo: " + t);
      }
      await loadAnticipos();
    } catch (err) {
      console.error(err);
      alert("No se pudo anular el anticipo. Revisa consola.");
      setLoading(false);
    }
  }

  // ====== Abrir modal SRI ======
  function abrirFacturar(anticipo) {
    const estadoLower = (anticipo?.estadoAnticipo || "").toLowerCase();
    if (!estadoLower.includes("paga")) {
      alert("Solo se puede facturar cuando el anticipo está en estado Pagado.");
      return;
    }
    setSelectedAnticipo(anticipo);
    setShowFacturaForm(true);
  }

  function cancelarPrefactura() {
    setShowFacturaForm(false);
    setFactEstable("");
    setFactPtoEmi("");
    setFactSecu("");
  }

  // ====== Confirmar: llama backend y abre FacturaPreviewModal ======
  const confirmarFacturaAnticipo = async () => {
    const est = (factEstable || "").trim();
    const pto = (factPtoEmi || "").trim();
    const sec = (factSecu || "").trim();

    if (!est || !pto || !sec) {
      alert("Completa Establecimiento, Punto de Emisión y Secuencial.");
      return;
    }

    setSending(true);
    try {
      // Cierra modal SRI
      setShowFacturaForm(false);

      const res = await fetch(`${API}/api/anticipos/factura/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Establecimiento: est,
          PuntoEmision: pto,
          Secuencial: sec,
        }),
      });

      const data = await res.json().catch(() => null);

if (!res.ok) {
  throw new Error(data?.error || data?.message || "Error en preview");
}

// ✅ Normalizar para que FacturaPreviewModal reciba lo mismo que OC
const normalized = data?.Cabecera
  ? data
  : {
      encontrado: true,
      docEntry: data?.docEntry ?? data?.DocEntry ?? data?.draft?.DocEntry,
      DocEntry: data?.docEntry ?? data?.DocEntry ?? data?.draft?.DocEntry, // por si el modal usa DocEntry
      Cabecera: data?.draft,
      Lineas: data?.draft?.DocumentLines || [],
      urlPdf: data?.urlPdf || null,
    };

console.log("PREVIEW NORMALIZED:", normalized);

setPreviewData(normalized);
setPreviewOpen(true);

    } catch (e) {
      console.error(e);
      alert("Error en preview: " + (e?.message || String(e)));
    } finally {
      setSending(false);
    }
  };

  // ====== Paginación ======
  const total = anticipos.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(total, startIndex + PAGE_SIZE);
  const pageItems = anticipos.slice(startIndex, endIndex);

  function goToPage(p) {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h1>Anticipos</h1>
        <button
          className={styles.addBtn}
          onClick={() => setShowCreateModal(true)}
        >
          <span>➕</span>
          <span>Añadir anticipo</span>
        </button>
      </div>

      {loading && <p>Cargando...</p>}

      {!loading && (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th># Anticipo</th>
                <th>Detalle gasto</th>
                <th>Identificación</th>
                <th>Fecha pago</th>
                <th>Estado</th>
                <th>Valor</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {pageItems.map((a, idx) => {
                const estadoLower = (a.estadoAnticipo || "").toLowerCase();
                const puedeAnular = estadoLower === "pendiente";
                const puedeFacturar = estadoLower.includes("paga");

                return (
                  <tr key={idx}>
                    <td>{a.numeroAnticipo}</td>
                    <td>{a.detalleGasto}</td>
                    <td>{a.identificacion}</td>
                    <td>{a.fechaPago?.substring(0, 10)}</td>
                    <td>
                      <span className={estadoClass(a.estadoAnticipo)}>
                        {a.estadoAnticipo}
                      </span>
                    </td>
                    <td>{a.valor}</td>

                    <td className={styles.actions}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => {
                          setSelectedAnticipo(a);
                          setShowViewModal(true);
                        }}
                      >
                        👁 Ver
                      </button>

                      {a.adjuntoUrl && (
                        <a
                          className={styles.actionBtn}
                          href={a.adjuntoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          ⬇ Descargar
                        </a>
                      )}

                      {puedeFacturar && (
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnOk}`}
                          onClick={() => abrirFacturar(a)}
                        >
                          🧾 Facturar
                        </button>
                      )}

                      {puedeAnular && (
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          onClick={() => handleCancel(a)}
                        >
                          ✖ Anular
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={7}>No hay anticipos en esta página.</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className={styles.paginationRow}>
            <div className={styles.paginationInfo}>
              {total > 0
                ? `Mostrando ${startIndex + 1}–${endIndex} de ${total}`
                : "Sin anticipos registrados"}
            </div>

            <div className={styles.paginationButtons}>
              <button
                className={styles.pageBtn}
                disabled={currentPage <= 1}
                onClick={() => goToPage(currentPage - 1)}
              >
                «
              </button>

              <button className={`${styles.pageBtn} ${styles.pageBtnActive}`}>
                {currentPage}
              </button>

              <button
                className={styles.pageBtn}
                disabled={currentPage >= totalPages}
                onClick={() => goToPage(currentPage + 1)}
              >
                »
              </button>
            </div>
          </div>
        </>
      )}

      {showCreateModal && (
        <AnticipoModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={loadAnticipos}
        />
      )}

      {showViewModal && (
        <AnticipoViewModal
          anticipo={selectedAnticipo}
          onClose={() => setShowViewModal(false)}
        />
      )}

      {/* ✅ MODAL PREVIEW FACTURA (igual que compras/OC) */}
      {previewOpen && previewData && (
        <FacturaPreviewModal
          open={previewOpen}
          data={previewData}
          onClose={() => {
            setPreviewOpen(false);
            setPreviewData(null);
          }}
          onUse={async (payload) => {
  try {
    // ✅ Fuerza CardCode desde el preview (porque a veces el modal no lo manda)
    const cabeceraFix = {
      ...(payload?.Cabecera || {}),
      CardCode:
        payload?.Cabecera?.CardCode ||
        previewData?.Cabecera?.CardCode ||   // ✅ respaldo
        previewData?.Cabecera?.CardCode?.trim?.(),
    };

    console.log("CABECERA FIX:", cabeceraFix); // para validar en consola

    const res = await fetch(`${API}/api/anticipos/factura/borrador`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numeroAnticipo: selectedAnticipo?.numeroAnticipo,
        Cabecera: cabeceraFix,
        Lineas: payload.Lineas,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(t);
    }

    setPreviewOpen(false);
    setPreviewData(null);
  } catch (e) {
    console.error(e);
    alert("No se pudo guardar el borrador de factura del anticipo");
  }
}}


        />
      )}

      {/* ===== MODAL FACTURAR (SRI) ===== */}
      {showFacturaForm && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalBox}>
            <h3 className={styles.modalTitle}>
              Datos para facturar anticipo {selectedAnticipo?.numeroAnticipo || ""}
            </h3>

            <div className={styles.formGrid}>
              <label>
                <span>Establecimiento</span>
                <input
                  value={factEstable}
                  onChange={(e) => setFactEstable(e.target.value)}
                  placeholder="001"
                  maxLength={10}
                />
              </label>

              <label>
                <span>Punto de emisión</span>
                <input
                  value={factPtoEmi}
                  onChange={(e) => setFactPtoEmi(e.target.value)}
                  placeholder="002"
                  maxLength={10}
                />
              </label>

              <label className={styles.gridFull}>
                <span>Secuencial</span>
                <input
                  value={factSecu}
                  onChange={(e) => setFactSecu(e.target.value)}
                  placeholder="00001234"
                  maxLength={20}
                />
              </label>
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.secondary}
                onClick={cancelarPrefactura}
                disabled={sending}
              >
                Cancelar
              </button>
              <button
                className={styles.primary}
                onClick={confirmarFacturaAnticipo}
                disabled={sending}
              >
                {sending ? "Enviando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
