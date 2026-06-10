"use client";

import { useState, useMemo, useCallback } from "react";
import styles from "../../preorden.module.css";
import { replacePreOCDetail, splitPreOC, requestOCApproval } from "@/app/lib/backend";
import ProveedorPicker from "@/components/SupplierSelect";
import ProveedorInfoModal from "@/components/ProveedorInfoModal";

const IVA_PCT_DEFAULT = 15;

const FP_OPTS = [
  { value: "01", label: "01 - Contado" },
  { value: "20", label: "20 - Crédito" },
  { value: "99", label: "99 - Otra" },
];

function num(v) {
  if (typeof v === "number") return v;
  if (v == null || v === "") return 0;
  const normalized = String(v).replace(",", ".");
  const n = parseFloat(normalized);
  return Number.isNaN(n) ? 0 : n;
}

function recalcRow(row) {
  const cant = num(row.Cantidad);
  const precio = num(row.Precio);
  const desc = num(row.Descuento);
  const base = Math.max(0, cant * precio - desc);

  const ivaPct =
    row.IvaPct === "" || row.IvaPct == null ? IVA_PCT_DEFAULT : num(row.IvaPct);

  const iva = +(base * (ivaPct / 100)).toFixed(2);
  const total = +(base + iva).toFixed(2);

  return {
    ...row,
    IvaPct: ivaPct,
    Iva: iva,
    Total: total,
    __base: +base.toFixed(2),
  };
}

const EMPTY_ROW = {
  NumeroArticulo: "",
  Proveedor: "",
  ProveedorId: "",
  CodigoSAP: "",
  EmailAddress: "",
  Phone1: "",
  FechaNecesaria: "",
  Cantidad: 1,
  Precio: 0,
  Descuento: 0,
  IvaPct: IVA_PCT_DEFAULT,
  Iva: 0,
  Total: 0,
  DiasPago: 0,
  FormaPago: "01",
};

export default function PreOCEditor({ preoc, detalleInicial }) {
  const [detalle, setDetalle] = useState(
    (detalleInicial || []).map((d) =>
      recalcRow({
        ...d,
        ProveedorId: d.ProveedorId ?? d.IdProveedor ?? "",
        CodigoSAP: d.CodigoSAP ?? d.CardCode ?? "",
        DiasPago: d.DiasPago ?? d.DiasCredito ?? 0,
        FormaPago: d.FormaPago ?? d.U_SYP_FPAGO ?? "01",
      })
    )
  );

  const [proveedorGlobal, setProveedorGlobal] = useState("");
  const [subtotalGlobal, setSubtotalGlobal] = useState("");
  const [descuentoGlobal, setDescuentoGlobal] = useState("");
  const [ivaGlobal, setIvaGlobal] = useState(15);

  const [estado, setEstado] = useState(preoc?.Estado || "BORRADOR");
  const editable = estado === "BORRADOR";
  const [provInfo, setProvInfo] = useState(null);

  // ✅ Tooltip con TODA la info de la fila
  const tooltipRow = useCallback((r) => {
    const parts = [
      r.NumeroArticulo ? `Artículo/Servicio: ${r.NumeroArticulo}` : null,

      r.Proveedor ? `Proveedor: ${r.Proveedor}` : null,
      r.CodigoSAP ? `Código SAP: ${r.CodigoSAP}` : null,
      r.ProveedorId ? `IdProveedor: ${r.ProveedorId}` : null,
      r.EmailAddress ? `Email: ${r.EmailAddress}` : null,
      r.Phone1 ? `Tel: ${r.Phone1}` : null,

      r.FechaNecesaria ? `Fecha necesaria: ${r.FechaNecesaria}` : null,
      `Cantidad: ${r.Cantidad ?? ""}`,
      `Precio: ${Number(r.Precio ?? 0).toFixed(2)}`,
      `Descuento: ${Number(r.Descuento ?? 0).toFixed(2)}`,
      `IVA %: ${Number(r.IvaPct ?? 0).toFixed(2)}`,
      `Días crédito: ${r.DiasPago ?? 0}`,
      `Forma pago: ${r.FormaPago || ""}`,

      `Base: ${Number(r.__base ?? 0).toFixed(2)}`,
      `IVA: ${Number(r.Iva ?? 0).toFixed(2)}`,
      `Total: ${Number(r.Total ?? 0).toFixed(2)}`,
    ];

    return parts.filter(Boolean).join("\n");
  }, []);

  async function cargarProveedor(id) {
    const cardCode = id?.startsWith("PL") ? id : `PL${id}`;
    try {
      const res = await fetch(
        `https://compras-back-ec-prod.onrender.com/api/proveedores-sap/${encodeURIComponent(
          cardCode
        )}`
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }

      const data = await res.json();
      setProvInfo(data);
    } catch (e) {
      console.error("Error cargando proveedor SAP:", e);
      alert(`No se pudo cargar la información del proveedor: ${e.message}`);
    }
  }

  // ===== PAGINACIÓN DETALLE =====
  const PAGE_SIZE = 10;
  const [pageDet, setPageDet] = useState(1);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil((detalle?.length || 0) / PAGE_SIZE));
  }, [detalle]);

  const safePage = Math.min(pageDet, totalPages);

  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return detalle.slice(start, start + PAGE_SIZE);
  }, [detalle, safePage]);

  const pageStartIndex = useMemo(() => (safePage - 1) * PAGE_SIZE, [safePage]);

  const totals = useMemo(() => {
    const sub = detalle.reduce((s, r) => s + num(r.__base), 0);
    const iva = detalle.reduce((s, r) => s + num(r.Iva), 0);
    const tot = detalle.reduce((s, r) => s + num(r.Total), 0);
    return {
      sub: +sub.toFixed(2),
      iva: +iva.toFixed(2),
      tot: +tot.toFixed(2),
    };
  }, [detalle]);

  const proveedoresUnicos = useMemo(() => {
    const setProv = new Set();
    detalle.forEach((r) => {
      const key = r.CodigoSAP || r.ProveedorId || r.Proveedor;
      if (key) setProv.add(key);
    });
    return Array.from(setProv);
  }, [detalle]);

  const onChange = useCallback((i, field, value) => {
    setDetalle((prev) => {
      const rows = [...prev];
      const next = { ...rows[i], [field]: value };
      rows[i] = recalcRow(next);
      return rows;
    });
  }, []);

  const addRow = useCallback(() => {
    setDetalle((prev) => {
      let next;
      if (prev.length === 0) {
        next = [recalcRow({ ...EMPTY_ROW })];
      } else {
        const last = prev[prev.length - 1];
        next = [
          ...prev,
          recalcRow({
            ...EMPTY_ROW,
            Proveedor: last.Proveedor,
            ProveedorId: last.ProveedorId,
            CodigoSAP: last.CodigoSAP,
            EmailAddress: last.EmailAddress,
            Phone1: last.Phone1,
            FechaNecesaria: last.FechaNecesaria,
            IvaPct: last.IvaPct,
            DiasPago: last.DiasPago,
            FormaPago: last.FormaPago,
          }),
        ];
      }
      const newTotalPages = Math.max(1, Math.ceil(next.length / PAGE_SIZE));
      setPageDet(newTotalPages);
      return next;
    });
  }, []);

  const removeRow = useCallback((realIndex) => {
    setDetalle((prev) => {
      const next = prev.filter((_, k) => k !== realIndex);
      const newTotalPages = Math.max(1, Math.ceil(next.length / PAGE_SIZE));
      setPageDet((p) => Math.min(p, newTotalPages));
      return next;
    });
  }, []);

  const guardarDetalle = useCallback(async () => {
    await replacePreOCDetail(preoc.IdPreOC, detalle);
    alert("Detalle de Pre-Orden guardado.");
  }, [detalle, preoc.IdPreOC]);

  const crearOCs = useCallback(async () => {
    if (!editable) {
      alert(`La Pre-Orden está en estado ${estado}.`);
      return;
    }
    const r = await splitPreOC(preoc.IdPreOC);
    if (!r?.ok || !r?.created?.length) {
      alert(r?.error || "No se pudieron crear OCs.");
      return;
    }
    try {
      for (const oc of r.created) {
        await requestOCApproval(oc.IdOC, { autoApprove: false });
      }
    } catch {}
    setEstado("SEPARADA");
    window.location.href = `/ordenes/${r.created[0].IdOC}`;
  }, [editable, estado, preoc.IdPreOC]);

  function aplicarGlobalizado() {
    if (!proveedorGlobal) return;

    const subtotal = num(subtotalGlobal);
    const desc = num(descuentoGlobal);
    const ivaPct = num(ivaGlobal);

    const base = subtotal - desc;
    if (base <= 0) {
      alert("El subtotal - descuento debe ser mayor a 0.");
      return;
    }

    setDetalle((prev) => {
      let rows = [...prev];

      const indices = rows
        .map((r, idx) => ({ key: r.CodigoSAP || r.ProveedorId || r.Proveedor, idx }))
        .filter((x) => x.key === proveedorGlobal)
        .map((x) => x.idx);

      if (!indices.length) return prev;

      const first = indices[0];

      rows[first] = recalcRow({
        ...rows[first],
        Precio: subtotal,
        Descuento: desc,
        IvaPct: ivaPct,
      });

      indices.slice(1).forEach((i) => {
        rows[i] = recalcRow({
          ...rows[i],
          Precio: 0,
          Descuento: 0,
          IvaPct: ivaPct,
        });
      });

      return rows;
    });
  }

  return (
    <div className={`${styles.ocTheme} ${styles.preordenRoot}`}>
      {/* === CARD SUPERIOR: TOTAL PRE-ORDEN === */}
      <div className={styles.summaryCard}>
        <div className={styles.summaryHeader}>
          <div>
            <div className={styles.summaryLabel}>Total Pre-Orden</div>
            <div className={styles.summaryAmount}>
              {totals.tot.toLocaleString("es-EC", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>

          <div className={styles.summaryStatus}>
            <span className={styles.muted}>
              {editable ? "Edición habilitada" : "Edición bloqueada"}
            </span>
          </div>
        </div>

        {editable && (
          <div className={styles.globalBar}>
            <span className={styles.globalTitle}>Monto globalizado por proveedor:</span>

            <select
              className={styles.globalInput}
              value={proveedorGlobal}
              onChange={(e) => setProveedorGlobal(e.target.value)}
              title="Selecciona un proveedor para globalizar"
            >
              <option value="">Seleccione…</option>
              {proveedoresUnicos.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            {proveedorGlobal && (
              <>
                <input
                  type="number"
                  className={styles.globalInput}
                  placeholder="Subtotal"
                  value={subtotalGlobal}
                  onChange={(e) => setSubtotalGlobal(e.target.value)}
                  title="Subtotal a aplicar al proveedor seleccionado"
                />

                <input
                  type="number"
                  className={styles.globalInput}
                  placeholder="Desc"
                  value={descuentoGlobal}
                  onChange={(e) => setDescuentoGlobal(e.target.value)}
                  title="Descuento a aplicar al proveedor seleccionado"
                />

                <input
                  type="number"
                  className={styles.globalInput}
                  placeholder="IVA %"
                  value={ivaGlobal}
                  onChange={(e) => setIvaGlobal(e.target.value)}
                  title="IVA % a aplicar al proveedor seleccionado"
                />

                <span
                  className={styles.globalTotal}
                  title="Total calculado (Subtotal - Desc) * (1 + IVA%)"
                >
                  Total:{" "}
                  {(
                    num(subtotalGlobal - descuentoGlobal) *
                    (1 + num(ivaGlobal) / 100)
                  ).toFixed(2)}
                </span>

                <button className={styles.globalBtn} onClick={aplicarGlobalizado} title="Aplicar globalizado">
                  Aplicar
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {(preoc?.Comentario || "").trim() && (
        <div className={styles.commentBox} title={`Comentario: ${preoc.Comentario}`}>
          <div className={styles.commentLabel}>Comentario</div>
          <div className={styles.commentText}>{preoc.Comentario}</div>
        </div>
      )}

      {/* === CARD PRINCIPAL === */}
      <div className={styles.card}>
        <div className={styles.actions}>
          <div className={styles.leftTools} />
          <div className={styles.right}>
            {editable ? (
              <>
                <button className={styles.secondary} type="button" onClick={addRow} title="Agregar una nueva línea">
                  Agregar línea
                </button>
                <button className={styles.secondary} type="button" onClick={guardarDetalle} title="Guardar el detalle de la Pre-Orden">
                  Guardar detalle
                </button>
                <button className={styles.primary} type="button" onClick={crearOCs} title="Crear OCs separadas por proveedor">
                  Crear OCs por proveedor
                </button>
              </>
            ) : (
              <span className={styles.muted}>Pre-Orden {estado} (no editable)</span>
            )}
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colArticulo}>Artículo / Servicio</th>
                <th className={styles.colProveedor}>Proveedor</th>
                <th className={styles.colFecha}>Fecha necesaria</th>
                <th className={styles.colCant}>Cant.</th>
                <th className={styles.colPrecio}>Precio</th>
                <th className={styles.colDesc}>Desc.</th>
                <th className={styles.colIvaPct}>IVA %</th>
                <th className={styles.colDias}>Días crédito</th>
                <th className={styles.colForma}>Forma pago</th>
                <th className={styles.colIva}>IVA</th>
                <th className={styles.colTotal}>Total</th>
                <th className={styles.colActions}></th>
              </tr>
            </thead>

           <tbody>
  {pageSlice.map((r, i) => {
    const realIndex = pageStartIndex + i;

    const tipArticulo  = `Artículo/Servicio: ${r.NumeroArticulo || ""}`;
    const tipProveedor = [
  r.Proveedor ? `Proveedor: ${r.Proveedor}` : null,
  r.CodigoSAP ? `Código SAP: ${r.CodigoSAP}` : null,
  r.ProveedorId ? `IdProveedor: ${r.ProveedorId}` : null,
  r.EmailAddress ? `Email: ${r.EmailAddress}` : null,
  r.Phone1 ? `Tel: ${r.Phone1}` : null,
].filter(Boolean).join("\n");

    const tipFecha   = `Fecha necesaria: ${r.FechaNecesaria || ""}`;
    const tipCant    = `Cantidad: ${r.Cantidad ?? ""}`;
    const tipPrecio  = `Precio: ${Number(r.Precio || 0).toFixed(2)}`;
    const tipDesc    = `Descuento: ${Number(r.Descuento || 0).toFixed(2)}`;
    const tipIvaPct  = `IVA %: ${Number(r.IvaPct || 0).toFixed(2)}`;
    const tipDias    = `Días crédito: ${r.DiasPago ?? 0}`;
    const tipForma   = `Forma pago: ${r.FormaPago || ""}`;
    const tipIva     = `IVA: ${Number(r.Iva || 0).toFixed(2)}`;
    const tipTotal   = `Total: ${Number(r.Total || 0).toFixed(2)}`;

    return (
      <tr key={realIndex}>
        <td className={styles.colArticulo}>
          <input
            className={styles.input}
            disabled={!editable}
            value={r.NumeroArticulo || ""}
            title={tipArticulo}
            onChange={(e) => onChange(realIndex, "NumeroArticulo", e.target.value)}
            placeholder="Artículo/Servicio…"
          />
        </td>

        <td className={styles.colProveedor}>
          <div className={styles.proveedorWrapper}>
            {/* ✅ Tooltip SOLO de proveedor */}
            <div style={{ width: "100%" }} title={tipProveedor}>
             <ProveedorPicker
  disabled={!editable}
  value={r.Proveedor || ""}
  title={tipProveedor}
  onChange={(nombre, prov) => {
    setDetalle((prev) => {
      const rows = [...prev];

      const proveedorData = {
        Proveedor: nombre || "",
        ProveedorId: prov?.IdProveedor ?? "",
        CodigoSAP: prov?.CodigoSAP ?? "",
        EmailAddress: prov?.EmailAddress || "",
        Phone1: prov?.Phone1 || "",
        DiasPago:
          typeof prov?.DiasCredito === "number"
            ? prov.DiasCredito
            : 0,
        FormaPago: prov?.U_SYP_FPAGO || "01",
      };

      rows.forEach((row, idx) => {
        const tieneProveedor =
          !!(row.Proveedor || row.ProveedorId || row.CodigoSAP);

        // La fila donde seleccionaste: siempre se actualiza
        if (idx === realIndex) {
          rows[idx] = recalcRow({
            ...row,
            ...proveedorData,
          });
          return;
        }

        // Las demás: solo si están vacías
        if (!tieneProveedor) {
          rows[idx] = recalcRow({
            ...row,
            ...proveedorData,
          });
        }
      });

      return rows;
    });
  }}
/>

            </div>

            <button
              className={styles.viewInfoBtn}
              type="button"
              title="Ver información del proveedor (SAP)"
              onClick={() => {
                const key = r.CodigoSAP || r.ProveedorId;
                if (!key) return alert("Esta línea no tiene código SAP o IdProveedor.");
                cargarProveedor(key);
              }}
            >
              <span className={styles.eyeIcon}>👁️</span>
            </button>
          </div>
        </td>

        <td className={styles.colFecha}>
          <input
            type="date"
            className={styles.input}
            disabled={!editable}
            value={r.FechaNecesaria || ""}
            title={tipFecha}
            onChange={(e) => onChange(realIndex, "FechaNecesaria", e.target.value)}
          />
        </td>

        <td className={styles.colCant}>
          <input
            className={`${styles.input} ${styles.inputNum}`}
            disabled={!editable}
            type="number"
            value={r.Cantidad ?? 1}
            title={tipCant}
            onChange={(e) => onChange(realIndex, "Cantidad", e.target.value)}
          />
        </td>

        <td className={styles.colPrecio}>
          <input
            className={`${styles.input} ${styles.inputNum}`}
            disabled={
              !editable ||
              (proveedorGlobal &&
                proveedorGlobal === (r.CodigoSAP || r.ProveedorId || r.Proveedor))
            }
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={r.Precio ?? ""}
            title={tipPrecio}
            onChange={(e) => onChange(realIndex, "Precio", e.target.value)}
          />
        </td>

        <td className={styles.colDesc}>
          <input
            className={`${styles.input} ${styles.inputNum}`}
            disabled={
              !editable ||
              (proveedorGlobal &&
                proveedorGlobal === (r.CodigoSAP || r.ProveedorId || r.Proveedor))
            }
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={r.Descuento ?? ""}
            title={tipDesc}
            onChange={(e) => onChange(realIndex, "Descuento", e.target.value)}
          />
        </td>

        <td className={styles.colIvaPct}>
          <input
            className={`${styles.input} ${styles.inputNum}`}
            disabled={
              !editable ||
              (proveedorGlobal &&
                proveedorGlobal === (r.CodigoSAP || r.ProveedorId || r.Proveedor))
            }
            type="number"
            value={r.IvaPct ?? 15}
            title={tipIvaPct}
            onChange={(e) => onChange(realIndex, "IvaPct", e.target.value)}
          />
        </td>

        <td className={styles.colDias}>
          <input
            className={`${styles.input} ${styles.inputNum}`}
            disabled={true}
            type="number"
            value={r.DiasPago ?? 0}
            readOnly
            title={tipDias}
          />
        </td>

        <td className={styles.colForma}>
          <div className={styles.selectWrap}>
            <select
              className={styles.select}
              disabled={true}
              value={r.FormaPago || "01"}
              readOnly
              title={tipForma}
            >
              {FP_OPTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </td>

        <td className={styles.colIva}>
          <div className={styles.num} title={tipIva}>
            {Number(r.Iva || 0).toFixed(2)}
          </div>
        </td>

        <td className={styles.colTotal}>
          <div className={styles.num} title={tipTotal}>
            {Number(r.Total || 0).toFixed(2)}
          </div>
        </td>

        <td className={styles.colActions}>
          <button
            disabled={!editable}
            className={styles.linkBtn}
            type="button"
            onClick={() => removeRow(realIndex)}
            title="Eliminar línea"
          >
            ✕
          </button>
        </td>
      </tr>
    );
  })}
</tbody>
          </table>

          <div className={styles.paginationBar}>
            <button className={styles.pageBtn} disabled={safePage <= 1} onClick={() => setPageDet(1)} type="button" title="Primera página">
              «
            </button>
            <button className={styles.pageBtn} disabled={safePage <= 1} onClick={() => setPageDet((p) => Math.max(1, p - 1))} type="button" title="Página anterior">
              ‹
            </button>

            <span className={styles.pageInfo} title="Información de paginación">
              Página {safePage} de {totalPages} — {detalle.length} líneas
            </span>

            <button className={styles.pageBtn} disabled={safePage >= totalPages} onClick={() => setPageDet((p) => Math.min(totalPages, p + 1))} type="button" title="Página siguiente">
              ›
            </button>
            <button className={styles.pageBtn} disabled={safePage >= totalPages} onClick={() => setPageDet(totalPages)} type="button" title="Última página">
              »
            </button>
          </div>
        </div>

        <div className={styles.totals}>
          <div className={styles.totalBox} title="Suma de bases (Cantidad*Precio - Descuento)">
            <div className={styles.totalLabel}>Subtotal</div>
            <div className={styles.totalValue}>{totals.sub.toFixed(2)}</div>
          </div>
          <div className={styles.totalBox} title="Suma de IVA de todas las líneas">
            <div className={styles.totalLabel}>IVA</div>
            <div className={styles.totalValue}>{totals.iva.toFixed(2)}</div>
          </div>
          <div className={`${styles.totalBox} ${styles.totalBoxEm}`} title="Total final (Subtotal + IVA)">
            <div className={styles.totalLabel}>Total</div>
            <div className={styles.totalValue}>{totals.tot.toFixed(2)}</div>
          </div>
        </div>

        <p className={styles.muted} style={{ marginTop: 8 }}>
          * Edición solo disponible en estado BORRADOR.
        </p>
      </div>

      {provInfo && <ProveedorInfoModal proveedor={provInfo} onClose={() => setProvInfo(null)} />}
    </div>
  );
}
