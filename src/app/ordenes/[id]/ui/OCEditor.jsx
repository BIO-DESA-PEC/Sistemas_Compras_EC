'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  replaceOCDetail,
  updateOCState,
  // createPrefacturaOC, // lo dejo comentado por si lo usas después
  requestOCApproval,
  getOCApprovalStatus,
  previewPrefacturaOC,
  updatePagoOC,
} from "@/app/lib/backend";
import { useSession } from "next-auth/react";

import styles from "../orden.module.css";
import ProveedorPicker from "@/components/SupplierSelect";

// 👇 el modal lo cargamos solo en cliente para evitar el error de React
const FacturaPreviewModal = dynamic(
  () => import('@/components/FacturaPreviewModal'),
  { ssr: false }
);

// ================================================
// Constantes y catálogos
// ================================================
const IVA_PCT_DEFAULT = 15;

// Fila vacía por defecto para nuevas líneas
const EMPTY_ROW = {
  NumeroArticulo: "",
  Proveedor: "",
  FechaNecesaria: "",
  Cantidad: 0,
  Precio: 0,
  Descuento: 0,
  IvaPct: IVA_PCT_DEFAULT,
  Iva: 0,
  Total: 0,
  DiasPago: 0,
};

// ================================================
// Utilidades de cálculo
// ================================================
function num(v) {
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
}

// Recalcula una fila (subtotal base, IVA, total) respetando locks de proveedor/resumen
function recalcRow(row) {
  // Si es fila resumen o con totales bloqueados, normaliza valores y respeta IVA
  if (row.__summary || row.__provLocked || row.__lockTotals) {
    const ivaPct = row.IvaPct === "" || row.IvaPct == null ? IVA_PCT_DEFAULT : num(row.IvaPct);
    const base = num(row.__base) || 0;
    const iva = num(row.Iva) || 0;
    const total = num(row.Total) || 0;
    return { ...row, IvaPct: ivaPct, __base: base, Iva: iva, Total: total };
  }

  // Caso normal: recalcular en base a Cantidad, Precio, Descuento e IVA
  const cant = num(row.Cantidad);
  const precio = num(row.Precio);
  const desc = num(row.Descuento);
  const base = Math.max(0, cant * precio - desc);
  const ivaPct = row.IvaPct === "" || row.IvaPct == null ? IVA_PCT_DEFAULT : num(row.IvaPct);
  const iva = +(base * (ivaPct / 100)).toFixed(2);
  const total = +(base + iva).toFixed(2);
  return { ...row, IvaPct: ivaPct, Iva: iva, Total: total, __base: +base.toFixed(2) };
}

// Crea una fila de resumen por proveedor con total impuesto incluido
function makeSummaryRow({ proveedor, total, ivaPct, fecha }) {
  const pct = ivaPct == null || ivaPct === "" ? IVA_PCT_DEFAULT : num(ivaPct);
  const base = +(total / (1 + pct / 100)).toFixed(2);
  const iva = +(total - base).toFixed(2);
  return {
    NumeroArticulo: "TOTAL " + (proveedor || "").toUpperCase(),
    Proveedor: proveedor || "",
    FechaNecesaria: fecha || "",
    Cantidad: 0,
    Precio: 0,
    Descuento: 0,
    IvaPct: pct,
    Iva: iva,
    Total: +total.toFixed(2),
    __base: base,
    __summary: true,
    __lockTotals: true,
  };
}

// ================================================
// Componente principal
// ================================================
export default function OCEditor({ oc, detalleInicial }) {
  const router = useRouter();
    // Id de la Orden de Compra (para pasar al modal)
  const ocId = oc?.IdOC ?? oc?.IdOc ?? oc?.idOc ?? null;


  // --------------------------------
  // Estado base
  // --------------------------------
  const [detalle, setDetalle] = useState((detalleInicial || []).map(recalcRow));
  const [estado, setEstado] = useState(oc.Estado);

  // Aprobación por niveles (estado remoto)
  const [ocAprob, setOcAprob] = useState({
    existe: false,
    estado: null, // PENDIENTE | APROBADA | RECHAZADA | null
    nivel_actual: null,
    nivel_max: null,
    aprobadorId: null,
    aprobadorNombre: "",
  });
const { data: session } = useSession();
const [user, setUser] = useState(null);

useEffect(() => {
  let alive = true;

  (async () => {
    try {
      const email = session?.user?.email;
      if (!email) return;

      const u = await getUserByEmail(email);
      if (!alive) return;

      setUser(u);
    } catch (e) {
      console.error("No pude cargar usuario por email", e);
    }
  })();

  return () => { alive = false; };
}, [session?.user?.email]);

  // Derivados útiles para UI/locks
  const enAprobacion = ocAprob?.existe && ocAprob.estado === "PENDIENTE";
  const aprobadaTotal = ocAprob?.existe && ocAprob.estado === "APROBADA";
  const estadoUI = enAprobacion
    ? "EN_APROBACION"
    : estado === "GENERADA" && aprobadaTotal
    ? "PENDIENTE_FACTURAR"
    : estado;

  // Modo de precios y utilidades para total por proveedor
  const [priceMode, setPriceMode] = useState("LINEA");
  const [provTotalTarget, setProvTotalTarget] = useState("");
  const [provTotalMonto, setProvTotalMonto] = useState("");

  // Sorting
  const [sort, setSort] = useState({ field: null, dir: "asc" });

  // Modal de preview de prefactura (datos cargados desde SAP)
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [diasPago, setDiasPago] = useState(oc.DiasPago ?? 0);

  // Bloqueo de edición
  const editable = !(
    estado === "PROCESADA" ||
    estado === "ANULADA" ||
    (ocAprob?.existe && (ocAprob.estado === "PENDIENTE" || ocAprob.estado === "APROBADA"))
  );

  // Modal facturación básica
  const [showFacturaForm, setShowFacturaForm] = useState(false);
  const [factMode, setFactMode] = useState("NORMAL");
  const [factEstable, setFactEstable] = useState("");
  const [factPtoEmi, setFactPtoEmi] = useState("");
  const [factSecu, setFactSecu] = useState("");
  const [sending, setSending] = useState(false);

  // --------------------------------
  // Efectos: recargar datos al cambiar OC
  // --------------------------------
  useEffect(() => {
    setDetalle((detalleInicial || []).map(recalcRow));
    setEstado(oc.Estado);
    setDiasPago(oc.DiasPago ?? 0);
    // Consulta estado de aprobación para esta OC
    (async () => {
      try {
        const st = await getOCApprovalStatus(oc.IdOC);
        if (st?.existe) {
          setOcAprob({
            existe: true,
            estado: st.estado || null,
            nivel_actual: st.nivel_actual ?? null,
            nivel_max: st.nivel_max ?? null,
            aprobadorId: st.aprobadorId ?? null,
            aprobadorNombre: st.aprobadorNombre || "",
          });
        } else {
          setOcAprob({
            existe: false,
            estado: null,
            nivel_actual: null,
            nivel_max: null,
            aprobadorId: null,
            aprobadorNombre: "",
          });
        }
      } catch {
        setOcAprob({
          existe: false,
          estado: null,
          nivel_actual: null,
          nivel_max: null,
          aprobadorId: null,
          aprobadorNombre: "",
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oc?.IdOC]);

  // --------------------------------
  // Totales (memoizados)
  // --------------------------------
  const totals = useMemo(() => {
    const sub = detalle.reduce((s, r) => s + num(r.__base), 0);
    const iva = detalle.reduce((s, r) => s + num(r.Iva), 0);
    const tot = detalle.reduce((s, r) => s + num(r.Total), 0);
    return { sub: +sub.toFixed(2), iva: +iva.toFixed(2), tot: +tot.toFixed(2) };
  }, [detalle]);

  // ================================================
  // Handlers de edición/tabla
  // ================================================
  const onChangeCell = useCallback(
    (idx, field, value) => {
      setDetalle((prev) => {
        const rows = [...prev];
        const next = { ...rows[idx], [field]: value };
        if (["Cantidad", "Precio", "Descuento", "IvaPct"].includes(field)) {
          next[field] = value === "" ? 0 : num(value);
        }
        rows[idx] = recalcRow(next);
        return rows;
      });
    },
    []
  );

  const addRow = useCallback(() => {
    setDetalle((d) => {
      const r = [...d].reverse();
      const lastProv = r.find((x) => (x.Proveedor || "").trim())?.Proveedor || "";
      const lastFecha = r.find((x) => (x.FechaNecesaria || "").trim())?.FechaNecesaria || "";
      const lastIva = r.find((x) => x.IvaPct !== "" && x.IvaPct != null)?.IvaPct ?? IVA_PCT_DEFAULT;
      const nueva = recalcRow({
        ...EMPTY_ROW,
        Proveedor: lastProv,
        FechaNecesaria: lastFecha,
        IvaPct: lastIva,
        DiasPago: 0,
      });
      return [...d, nueva];
    });
  }, []);

  const removeRow = useCallback((i) => {
    setDetalle((d) => d.filter((_, k) => k !== i));
  }, []);

  const sortBy = useCallback(
    (field) => {
      if (!detalle.length) return;
      setDetalle((d) => {
        const dir = sort.field === field && sort.dir === "asc" ? "desc" : "asc";
        setSort({ field, dir });
        const factor = dir === "asc" ? 1 : -1;
        const norm = (v) => (v ?? "").toString().toUpperCase();
        return [...d].sort((a, b) => norm(a[field]).localeCompare(norm(b[field])) * factor);
      });
    },
    [detalle.length, sort.field, sort.dir]
  );

  // Aplica un total por proveedor
  const aplicarTotalPorProveedor = useCallback(() => {
    if (!editable) return;

    const prov = (provTotalTarget || "").trim();
    const total = parseFloat(provTotalMonto);

    if (!prov || Number.isNaN(total) || total <= 0) {
      alert("Elige un proveedor y un monto total válido (> 0).");
      return;
    }

    setDetalle((d) => {
      const rows = [...d];

      // Índices de filas del proveedor (no resumen)
      const idxs = rows
        .map((r, idx) => ({ r, idx }))
        .filter((x) => (x.r.Proveedor || "") === prov && !x.r.__summary)
        .map((x) => x.idx);

      // Semillas de IVA y fecha
      const ivaSeed =
        (idxs.length ? rows[idxs.find((i) => rows[i].IvaPct != null)]?.IvaPct : undefined) ?? IVA_PCT_DEFAULT;
      const fechaSeed =
        (idxs.length
          ? rows[idxs.find((i) => (rows[i].FechaNecesaria || "").trim())]?.FechaNecesaria
          : undefined) || "";

      // Bloquea las filas del proveedor
      idxs.forEach((i) => {
        rows[i] = recalcRow({
          ...rows[i],
          __provLocked: true,
          Precio: 0,
          Descuento: 0,
          Iva: 0,
          Total: 0,
          __base: 0,
        });
      });

      // Inserta o reemplaza la fila resumen
      const sumIdx = rows.findIndex((r) => r.__summary && (r.Proveedor || "") === prov);
      const summary = makeSummaryRow({ proveedor: prov, total, ivaPct: ivaSeed, fecha: fechaSeed });
      if (sumIdx >= 0) rows[sumIdx] = summary;
      else rows.push(summary);

      return rows;
    });
  }, [editable, provTotalMonto, provTotalTarget]);

  // ================================================
  // Guardado + Aprobación
  // ================================================
  const saveDetail = useCallback(
    async (auto = false) => {
      // 1) Persistir el detalle actual
      await replaceOCDetail(oc.IdOC, detalle);

      // 2) Solicitar aprobación
      try {
        const r = await requestOCApproval(oc.IdOC, { autoApprove: auto });

        // 3) Refrescar estado de aprobación
        try {
          const s = await getOCApprovalStatus(oc.IdOC);
          if (s?.existe) {
            setOcAprob({
              existe: true,
              estado: s.estado || null,
              nivel_actual: s.nivel_actual ?? null,
              nivel_max: s.nivel_max ?? null,
              aprobadorId: s.aprobadorId ?? null,
              aprobadorNombre: s.aprobadorNombre || "",
            });
          }
        } catch (_) {}

        // 4) Mensaje
        if (r?.estado === "APROBADA") {
          alert(
            auto
              ? "Detalle guardado y OC aprobada automáticamente."
              : "Detalle guardado. La regla dio 0 niveles (aprobada)."
          );
        } else if (r?.estado === "PENDIENTE") {
          alert(`Detalle guardado. Enviado a aprobación (nivel ${r?.nivel_actual || 1}/${r?.nivel_max || "?"}).`);
        } else if (r?.estado === "RECHAZADA") {
          alert("Detalle guardado. (Estado: RECHAZADA)");
        } else {
          alert("Detalle guardado.");
        }
      } catch (e) {
        console.error(e);
        alert("Detalle guardado, pero al solicitar aprobación hubo un error: " + (e?.message || e));
      }
    },
    [detalle, oc.IdOC]
  );

  // ================================================
  // Facturación
  // ================================================
  const mandarAFacturar = useCallback(
    async (modo = "NORMAL") => {
      try {
        const st = await getOCApprovalStatus(oc.IdOC);
        if (!st?.existe || st.estado !== "APROBADA") {
          const quien = st?.aprobadorNombre ? ` — pendiente de: ${st.aprobadorNombre}` : "";
          alert(`Para facturar, la OC debe estar APROBADA. Estado actual: ${st?.estado || "SIN APROBACIÓN"}${quien}`);
          return;
        }
      } catch {}
      setFactMode(modo);
      setShowFacturaForm(true);
    },
    [oc.IdOC]
  );

  // Guardar encabezado de pago
  const guardarPagoEncabezado = useCallback(async () => {
    try {
      await updatePagoOC(oc.IdOC, { DiasPago: diasPago });
      alert("Días de crédito (global) guardados.");
    } catch (e) {
      console.error(e);
      alert("Error guardando días de crédito.");
    }
  }, [diasPago, oc.IdOC]);

  // Confirmar y hacer preview en SAP
  const confirmarPrefactura = useCallback(async () => {
    const est = (factEstable || "").trim();
    const pto = (factPtoEmi || "").trim();
    const sec = (factSecu || "").trim();
    if (!est || !pto || !sec) {
      alert("Completa Establecimiento, Punto de Emisión y Secuencial.");
      return;
    }

    setSending(true);
    try {
      setShowFacturaForm(false);

      const prev = await previewPrefacturaOC(oc.IdOC, {
        Establecimiento: est,
        PuntoEmision: pto,
        Secuencial: sec,
      });
      if (prev && prev.error) throw new Error(prev.error);

      if (!prev || !prev.encontrado) {
        alert((prev && prev.mensaje) || "No se encontró el borrador en SAP.");
        return;
      }

      setPreviewData(prev);
      setPreviewOpen(true);
    } catch (e) {
      alert("Error en preview: " + (e && e.message ? e.message : String(e)));
    } finally {
      setSending(false);
    }
  }, [factEstable, factPtoEmi, factSecu, oc.IdOC]);

  // Usa el borrador encontrado y marca la OC como PROCESADA
  const handleUseDraft = useCallback(async () => {
    try {
      if (estado !== "PROCESADA") {
        await updateOCState(oc.IdOC, { estado: "PROCESADA" });
        setEstado("PROCESADA");
        alert("OC PROCESADA usando el borrador detectado.");
      }
    } catch (e) {
      alert("Se encontró el borrador, pero no pude marcar PROCESADA: " + (e?.message || e));
    } finally {
      setPreviewOpen(false);
      setPreviewData(null);
    }
  }, [estado, oc.IdOC]);

  // Cancelar formulario de prefactura
  const cancelarPrefactura = useCallback(() => {
    setShowFacturaForm(false);
    setFactEstable("");
    setFactPtoEmi("");
    setFactSecu("");
  }, []);

  // Anular OC
  const anularOC = useCallback(async () => {
    const motivo = prompt("Motivo de anulación (requerido):", "");
    if (!motivo) return;
    await updateOCState(oc.IdOC, { estado: "ANULADA", comentario: motivo });
    alert("OC anulada. La solicitud fue reabierta.");
    router.push("/solicitudes");
  }, [oc.IdOC, router]);

  // Abrir modal de facturación si viene ?facturar=1
  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("facturar") === "1") {
        mandarAFacturar("NORMAL");
        const url = new URL(window.location.href);
        url.searchParams.delete("facturar");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ================================================
  // Render
  // ================================================
    return (
    <div className={`${styles.ocTheme} ${styles.card}`}>

      {/* === Top: resumen + acciones === */}
      <div className={styles.topSection}>
        {/* Fila 1: total + chips de estado + acciones principales */}
        <div className={styles.topRow}>
          <div className={styles.topRowLeft}>
            <span className={styles.topLabel}>Total orden</span>
            <div className={styles.topTotal}>
              {totals.tot.toLocaleString("es-EC", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>

            <div className={styles.topChips}>
              <span className={`${styles.chip} ${styles.chipMuted}`}>
                {estadoUI === "EN_APROBACION"
                  ? "En aprobación"
                  : estadoUI.replace("_", " ")}
              </span>

              {ocAprob?.estado === "PENDIENTE" && (
                <span className={`${styles.chip} ${styles.chipWarn}`}>
                  Nivel {ocAprob.nivel_actual}/{ocAprob.nivel_max}
                </span>
              )}

              {ocAprob?.estado === "APROBADA" && (
                <span className={styles.chip}>
                  Aprobada (nivel {ocAprob.nivel_max})
                </span>
              )}
            </div>
          </div>

          <div className={styles.topRowRight}>
            {editable ? (
              <>
                <button
                  className={styles.secondary}
                  onClick={addRow}
                >
                  Agregar línea
                </button>

                <button
                  className={styles.primary}
                  onClick={() => saveDetail(false)}
                >
                  Guardar detalle (enviar a aprobación)
                </button>

                <button
                  className={styles.secondary}
                  onClick={() => saveDetail(true)}
                  title="Aprueba automáticamente (omite flujo)"
                >
                  Guardar detalle (sin aprobación)
                </button>
              </>
            ) : (
              <span className={styles.muted}>Edición bloqueada</span>
            )}

            <button className={styles.warn} onClick={anularOC}>
              Anular
            </button>
            <button
              className={styles.ok}
              onClick={() => mandarAFacturar("NORMAL")}
            >
              Facturar
            </button>
          </div>
        </div>

      </div>

            {/* Tabla principal */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colArticulo}>
                <button
                  type="button"
                  className={styles.hSort}
                  onClick={() => sortBy("NumeroArticulo")}
                  title="Ordenar por artículo"
                >
                  <span>Artículo</span>
                  {sort.field === "NumeroArticulo" && (
                    <span className={styles.sortMark}>{sort.dir === "asc" ? "↑" : "↓"}</span>
                  )}
                </button>
              </th>

              <th className={styles.colProveedor}>
                <button
                  type="button"
                  className={styles.hSort}
                  onClick={() => sortBy("Proveedor")}
                  title="Ordenar por proveedor"
                >
                  <span>Proveedor</span>
                  {sort.field === "Proveedor" && (
                    <span className={styles.sortMark}>{sort.dir === "asc" ? "↑" : "↓"}</span>
                  )}
                </button>
              </th>

              <th className={styles.colFecha}>Fecha necesaria</th>
              <th className={`${styles.colCant} ${styles.num}`}>Cant.</th>
              <th className={`${styles.colPrecio} ${styles.num}`}>Precio</th>
              <th className={`${styles.colDesc} ${styles.num}`}>Desc.</th>
              <th className={`${styles.colIvaPct} ${styles.num}`}>IVA %</th>
              <th className={`${styles.colDias} ${styles.num}`}>Días crédito</th>
              <th className={`${styles.colIva} ${styles.num}`}>IVA</th>
              <th className={`${styles.colTotal} ${styles.num}`}>Total</th>
              <th className={styles.colActions}></th>
            </tr>
          </thead>

          <tbody>
            {detalle.map((r, i) => (
              <tr
                key={i}
                className={r.__summary ? styles.summaryRow : undefined}
              >
                {/* Artículo */}
                <td className={styles.colArticulo}>
                  {r.__summary ? (
                    <span className={styles.inputReadonly}>{r.NumeroArticulo}</span>
                  ) : (
                    <input
                      disabled={!editable}
                      className={styles.input}
                      value={r.NumeroArticulo || ""}
                      onChange={(e) =>
                        onChangeCell(i, "NumeroArticulo", e.target.value)
                      }
                      placeholder="Artículo..."
                    />
                  )}
                </td>

                {/* Proveedor */}
                <td className={styles.colProveedor}>
                  {r.__summary || r.__provLocked ? (
                    <span className={styles.inputReadonly}>{r.Proveedor || "—"}</span>
                  ) : (
                    <div className={styles.proveedorWrapper}>
                      <ProveedorPicker
                        disabled={!editable}
                        value={r.Proveedor || ""}
                        onChange={(nombre) => onChangeCell(i, "Proveedor", nombre)}
                      />
                    </div>
                  )}
                </td>

                {/* Fecha necesaria */}
                <td className={styles.colFecha}>
                  {r.__summary ? (
                    <span className={styles.inputReadonly}>
                      {r.FechaNecesaria || "—"}
                    </span>
                  ) : (
                    <input
                      disabled={!editable}
                      className={styles.input}
                      type="date"
                      value={r.FechaNecesaria || ""}
                      onChange={(e) =>
                        onChangeCell(i, "FechaNecesaria", e.target.value)
                      }
                    />
                  )}
                </td>

                {/* Cantidad */}
                <td className={`${styles.colCant} ${styles.num}`}>
                  {r.__summary ? (
                    <span className={styles.inputReadonly}>—</span>
                  ) : (
                    <input
                      disabled={!editable}
                      className={`${styles.input} ${styles.inputNum}`}
                      type="number"
                      value={r.Cantidad ?? 0}
                      onChange={(e) =>
                        onChangeCell(i, "Cantidad", e.target.value)
                      }
                    />
                  )}
                </td>

                {/* Precio */}
                <td className={`${styles.colPrecio} ${styles.num}`}>
                  {r.__summary || r.__provLocked ? (
                    <span className={styles.inputReadonly}>—</span>
                  ) : (
                    <input
                      disabled={!editable || priceMode === "TOTAL_X_PROV"}
                      className={`${styles.input} ${styles.inputNum}`}
                      type="number"
                      value={r.Precio ?? 0}
                      onChange={(e) =>
                        onChangeCell(i, "Precio", e.target.value)
                      }
                      title={
                        priceMode === "TOTAL_X_PROV"
                          ? "Bloqueado por 'Total por proveedor'"
                          : ""
                      }
                    />
                  )}
                </td>

                {/* Descuento */}
                <td className={`${styles.colDesc} ${styles.num}`}>
                  {r.__summary || r.__provLocked ? (
                    <span className={styles.inputReadonly}>—</span>
                  ) : (
                    <input
                      disabled={!editable}
                      className={`${styles.input} ${styles.inputNum}`}
                      type="number"
                      value={r.Descuento ?? 0}
                      onChange={(e) =>
                        onChangeCell(i, "Descuento", e.target.value)
                      }
                    />
                  )}
                </td>

                {/* IVA % */}
                <td className={`${styles.colIvaPct} ${styles.num}`}>
                  {r.__summary || r.__provLocked ? (
                    <span className={styles.inputReadonly}>—</span>
                  ) : (
                    <input
                      disabled={!editable}
                      className={`${styles.input} ${styles.inputNum}`}
                      type="number"
                      value={r.IvaPct ?? IVA_PCT_DEFAULT}
                      onChange={(e) =>
                        onChangeCell(i, "IvaPct", e.target.value)
                      }
                    />
                  )}
                </td>

                {/* Días crédito por línea */}
                <td className={`${styles.colDias} ${styles.num}`}>
                  {r.__summary ? (
                    <span className={styles.inputReadonly}>—</span>
                  ) : (
                    <input
                      disabled={!editable}
                      className={`${styles.input} ${styles.inputNum}`}
                      type="number"
                      min={0}
                      value={r.DiasPago ?? 0}
                      onChange={(e) =>
                        onChangeCell(i, "DiasPago", e.target.value)
                      }
                      title="Si no se define, aplica el global."
                    />
                  )}
                </td>

                {/* IVA */}
                <td className={`${styles.colIva} ${styles.num}`}>
                  {r.__provLocked ? "—" : Number(r.Iva || 0).toFixed(2)}
                </td>

                {/* Total */}
                <td className={`${styles.colTotal} ${styles.num}`}>
                  {r.__provLocked ? "—" : Number(r.Total || 0).toFixed(2)}
                </td>

                {/* Acciones por fila */}
                <td className={styles.colActions}>
                  {!r.__summary && (
                    <button
                      disabled={!editable}
                      className={styles.linkBtn}
                      onClick={() => removeRow(i)}
                      title="Eliminar línea"
                      aria-label="Eliminar línea"
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>


      {/* Totales */}
      <div className={styles.totals}>
        <div className={styles.totalBox}>
          <div className={styles.totalLabel}>Subtotal</div>
          <div className={styles.totalValue}>{totals.sub.toFixed(2)}</div>
        </div>
        <div className={styles.totalBox}>
          <div className={styles.totalLabel}>IVA</div>
          <div className={styles.totalValue}>{totals.iva.toFixed(2)}</div>
        </div>
        <div className={`${styles.totalBox} ${styles.totalBoxEm}`}>
          <div className={styles.totalLabel}>Total</div>
          <div className={styles.totalValue}>{totals.tot.toFixed(2)}</div>
        </div>
      </div>

      {/* Mensajes de estado */}
      {!editable && (
        <p className={styles.note}>
          * Edición deshabilitada
          {estado === "RECHAZADA"
            ? " (rechazada)"
            : enAprobacion
            ? " (en aprobación)"
            : ocAprob?.estado === "APROBADA"
            ? " (aprobada)"
            : ""}
          .
        </p>
      )}

      {ocAprob?.estado === "PENDIENTE" && (
        <p className={styles.note}>
          * En aprobación (nivel {ocAprob.nivel_actual}/{ocAprob.nivel_max})
          {ocAprob.aprobadorNombre ? ` — pendiente de: ${ocAprob.aprobadorNombre}` : ""}.
        </p>
      )}

      {ocAprob?.estado === "APROBADA" && (
        <p className={styles.note}>
          * Aprobada (nivel {ocAprob.nivel_max}/{ocAprob.nivel_max}). Ya no se puede modificar el detalle; puedes
          Facturar o Anular.
        </p>
      )}

      {/* Modal de datos para facturar */}
      {showFacturaForm && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalBox}>
            <h3 className={styles.modalTitle}>
              {factMode === "SIN_APROB" ? "Facturar (sin aprobación)" : "Datos para facturar"}
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
              <button className={styles.secondary} onClick={cancelarPrefactura} disabled={sending}>
                Cancelar
              </button>
              <button className={styles.primary} onClick={confirmarPrefactura} disabled={sending}>
                {sending ? "Enviando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de PREVIEW (archivo aparte) */}
           <FacturaPreviewModal
  open={previewOpen}
  data={previewData ? { ...previewData, OcId: ocId } : null}
  onClose={() => {
    setPreviewOpen(false);
    setPreviewData(null);
  }}
  onUse={handleUseDraft}

  // ✅ ESTO ES EL PASO 5
  rolNombre={user?.RolNombre}
  rolId={user?.RolId}

  // opcional: etiqueta del origen
  modo="ordenes"
/>


    </div>
  );
}
