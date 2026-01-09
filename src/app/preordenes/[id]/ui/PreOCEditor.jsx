"use client";

import { useState, useMemo, useCallback } from "react";
import styles from "../../preorden.module.css";
import {
  replacePreOCDetail,
  splitPreOC,
  requestOCApproval,
} from "@/app/lib/backend";
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

  const normalized = String(v).replace(",", "."); // acepta 22,40 o 22.40
  const n = parseFloat(normalized);
  return Number.isNaN(n) ? 0 : n;
}


function recalcRow(row) {
  const cant = num(row.Cantidad);
  const precio = num(row.Precio);
  const desc = num(row.Descuento);
  const base = Math.max(0, cant * precio - desc);

  const ivaPct =
    row.IvaPct === "" || row.IvaPct == null
      ? IVA_PCT_DEFAULT
      : num(row.IvaPct);

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

      // 👇 Normalizamos nombres de campos que vienen del back
      ProveedorId: d.ProveedorId ?? d.IdProveedor ?? "",
      CodigoSAP:  d.CodigoSAP  ?? d.CardCode    ?? "",

      DiasPago:   d.DiasPago   ?? d.DiasCredito ?? 0,
      FormaPago:  d.FormaPago  ?? d.U_SYP_FPAGO ?? "01",
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

   async function cargarProveedor(id) {
  // si no comienza con PL, le ponemos PL delante
  const cardCode = id?.startsWith("PL") ? id : `PL${id}`;

  console.log("[cargarProveedor] id recibido:", id, "cardCode usado:", cardCode);

  try {
    const res = await fetch(
      `https://back-compras-ec.onrender.com/api/proveedores-sap/${encodeURIComponent(cardCode)}`
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
    detalle.forEach(r => {
      const key = r.CodigoSAP || r.ProveedorId || r.Proveedor;
      if (key) setProv.add(key);
    });
    return Array.from(setProv);
  }, [detalle]);

  const onChange = useCallback((i, field, value) => {
  setDetalle((prev) => {
    const rows = [...prev];

    // guardamos el valor tal cual (string o número)
    const next = {
      ...rows[i],
      [field]: value,
    };

    // recalcRow se encarga de parsear con num()
    rows[i] = recalcRow(next);
    return rows;
  });
}, []);


  const addRow = useCallback(
  () =>
    setDetalle((prev) => {
      if (prev.length === 0) {
        return [
          recalcRow({
            ...EMPTY_ROW,
          }),
        ];
      }

      const last = prev[prev.length - 1];

      return [
        ...prev,
        recalcRow({
          ...EMPTY_ROW,

          // 👇 estos valores se mantienen
          Proveedor: last.Proveedor,
          ProveedorId: last.ProveedorId,
          EmailAddress: last.EmailAddress,
          Phone1: last.Phone1,

          FechaNecesaria: last.FechaNecesaria,

          IvaPct: last.IvaPct,
          DiasPago: last.DiasPago,
          FormaPago: last.FormaPago,
        }),
      ];
    }),
  []
);


  const removeRow = useCallback(
    (i) => setDetalle((d) => d.filter((_, k) => k !== i)),
    []
  );

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

  setDetalle(prev => {
    let rows = [...prev];

    const indices = rows
      .map((r, idx) => ({
        key: r.CodigoSAP || r.ProveedorId || r.Proveedor,
        idx
      }))
      .filter(x => x.key === proveedorGlobal)
      .map(x => x.idx);

    if (!indices.length) return prev;

    // Primera línea monetaria
    const first = indices[0];

    rows[first] = recalcRow({
      ...rows[first],
      Precio: subtotal,
      Descuento: desc,
      IvaPct: ivaPct,
    });

    // Otras líneas = solo informativas
    indices.slice(1).forEach(i => {
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

  {/* 👇 Barra globalizada, ahora dentro de la tarjeta */}
  {editable && (
    <div className={styles.globalBar}>
      <span className={styles.globalTitle}>Monto globalizado por proveedor:</span>

      <select
        className={styles.globalInput}
        value={proveedorGlobal}
        onChange={e => setProveedorGlobal(e.target.value)}
      >
        <option value="">Seleccione…</option>
        {proveedoresUnicos.map(p => (
          <option key={p} value={p}>{p}</option>
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
          />

          <input
            type="number"
            className={styles.globalInput}
            placeholder="Desc"
            value={descuentoGlobal}
            onChange={(e) => setDescuentoGlobal(e.target.value)}
          />

          <input
            type="number"
            className={styles.globalInput}
            placeholder="IVA %"
            value={ivaGlobal}
            onChange={(e) => setIvaGlobal(e.target.value)}
          />

          <span className={styles.globalTotal}>
            Total:{" "}
            {(
              num(subtotalGlobal - descuentoGlobal) *
              (1 + num(ivaGlobal) / 100)
            ).toFixed(2)}
          </span>

          <button
            className={styles.globalBtn}
            onClick={aplicarGlobalizado}
          >
            Aplicar
          </button>
        </>
      )}
    </div>
  )}
</div>


      {/* === CARD PRINCIPAL: tabla + botones === */}
      <div className={styles.card}>
        <div className={styles.actions}>
          <div className={styles.leftTools} />
          <div className={styles.right}>
            {editable ? (
              <>
                <button
                  className={styles.secondary}
                  type="button"
                  onClick={addRow}
                >
                  Agregar línea
                </button>
                <button
                  className={styles.secondary}
                  type="button"
                  onClick={guardarDetalle}
                >
                  Guardar detalle
                </button>
                <button
                  className={styles.primary}
                  type="button"
                  onClick={crearOCs}
                >
                  Crear OCs por proveedor
                </button>
              </>
            ) : (
              <span className={styles.muted}>
                Pre-Orden {estado} (no editable)
              </span>
            )}
          </div>
        </div>

        {/* Tabla */}
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
              {detalle.map((r, i) => (
                <tr key={i}>
                  <td className={styles.colArticulo}>
                  <input
                    className={styles.input}
                    disabled={!editable}
                    value={r.NumeroArticulo || ""}
                    title={r.NumeroArticulo || ""}   // 👈 tooltip con el texto completo
                    onChange={(e) =>
                      onChange(i, "NumeroArticulo", e.target.value)
                    }
                    placeholder="Artículo/Servicio…"
                  />
                </td>
                 <td className={styles.colProveedor}>
  <div className={styles.proveedorWrapper}>
    <ProveedorPicker
      disabled={!editable}
      value={r.Proveedor || ""}
      onChange={(nombre, prov) => {
        onChange(i, "Proveedor", nombre);

        if (prov) {
          // IdProveedor (RUC/CI)
          onChange(i, "ProveedorId", prov.IdProveedor);
          // Código SAP (CardCode)
          onChange(i, "CodigoSAP", prov.CodigoSAP);

          onChange(i, "EmailAddress", prov.EmailAddress || "");
          onChange(i, "Phone1", prov.Phone1 || "");

          if (typeof prov.DiasCredito === "number") {
            onChange(i, "DiasPago", prov.DiasCredito);
          }

          if (prov.U_SYP_FPAGO) {
            onChange(i, "FormaPago", prov.U_SYP_FPAGO);
          }
        }
      }}
    />

    {/* 👇 OJITO SIEMPRE VISIBLE */}
    <button
  className={styles.viewInfoBtn}
  type="button"
  title="Ver información del proveedor"
  onClick={() => {
    const key = r.CodigoSAP || r.ProveedorId;
    if (!key) {
      alert(
        "Esta línea no tiene asociado un código SAP o IdProveedor. " +
        "Guarda la pre-orden con un proveedor válido para ver el detalle."
      );
      return;
    }
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
                      onChange={(e) =>
                        onChange(i, "FechaNecesaria", e.target.value)
                      }
                    />
                  </td>

                  <td className={styles.colCant}>
                    <input
                      className={`${styles.input} ${styles.inputNum}`}
                      disabled={!editable}
                      type="number"
                      value={r.Cantidad ?? 1}
                      onChange={(e) =>
                        onChange(i, "Cantidad", e.target.value)
                      }
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
    title={String(r.Precio ?? "")}    // 👈 tooltip
    onChange={(e) => onChange(i, "Precio", e.target.value)}
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
                      title={String(r.Descuento ?? "")} // 👈 tooltip
                      onChange={(e) => onChange(i, "Descuento", e.target.value)}
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
                      onChange={(e) => onChange(i, "IvaPct", e.target.value)}
                    />
                  </td>

                  <td className={styles.colDias}>
                    <input
                      className={`${styles.input} ${styles.inputNum}`}
                      disabled={true}     // 👈 siempre bloqueado
                      type="number"
                      value={r.DiasPago ?? 0}
                      readOnly
                    />
                  </td>

                  <td className={styles.colForma}>
                    <div className={styles.selectWrap}>
                      <select
                        className={styles.select}
                        disabled={true}     // 👈 siempre bloqueado
                        value={r.FormaPago || "01"}
                        readOnly
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
                    <div className={styles.num}>
                      {Number(r.Iva || 0).toFixed(2)}
                    </div>
                  </td>

                  <td className={styles.colTotal}>
                    <div className={styles.num}>
                      {Number(r.Total || 0).toFixed(2)}
                    </div>
                  </td>

                  <td className={styles.colActions}>
                    <button
                      disabled={!editable}
                      className={styles.linkBtn}
                      type="button"
                      onClick={() => removeRow(i)}
                      title="Eliminar"
                    >
                      ✕
                    </button>
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
            <div className={styles.totalValue}>
              {totals.sub.toFixed(2)}
            </div>
          </div>
          <div className={styles.totalBox}>
            <div className={styles.totalLabel}>IVA</div>
            <div className={styles.totalValue}>
              {totals.iva.toFixed(2)}
            </div>
          </div>
          <div className={`${styles.totalBox} ${styles.totalBoxEm}`}>
            <div className={styles.totalLabel}>Total</div>
            <div className={styles.totalValue}>
              {totals.tot.toFixed(2)}
            </div>
          </div>
        </div>

        <p className={styles.muted} style={{ marginTop: 8 }}>
          * Edición solo disponible en estado BORRADOR.
        </p>
      </div>
      {provInfo && (
  <ProveedorInfoModal
    proveedor={provInfo}
    onClose={() => setProvInfo(null)}
  />
)}

    </div>
    
  );
}
