'use client';

import { useState, useMemo, useEffect } from 'react';
import styles from './FacturaPreviewModal.module.css';
import SearchSelect from '@/components/SearchSelect';

const IVA_OPTS = [
  { value: 'IVA_15', label: 'IVA 15%' },
  { value: 'IVA_0',  label: 'IVA 0%'  },
];

const SUSTENTO_OPTS = [
  { value: '01', label: '01 - Créditos tributarios' },
  { value: '02', label: '02 - Reembolsos' },
];

function n2(v) {
  if (typeof v === 'string') v = v.replace(',', '.');
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function str(v) { return (v ?? '').toString(); }
const t = (v) => String(v ?? '').trim();

function titleFromOpts(value, opts = []) {
  const v = t(value);
  if (!v) return '';
  const found = opts.find(o => String(o.value) === v);
  return found ? found.label : v;
}

function titleFromDim(code, list = []) {
  const v = String(code ?? '').trim();
  if (!v) return '';

  const found = (list || []).find(
    o => String(o.code ?? '').trim() === v
  );

  return found
    ? `${String(found.code ?? '').trim()} — ${String(found.name ?? '').trim()}`
    : v;
}

export default function FacturaPreviewModal({
  open,
  data,
  onClose,
  onUse,
  modo,
  rolNombre = "",
  rolId = null,
  lockSoloGasto = false,
}) {
  const [clase, setClase] = useState('SERVICIO');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);

  const rol = String(rolNombre || "").toUpperCase();
  const isAdmin = Number(rolId) === 1 || rol === "ADMINISTRADOR";
  const isData = Number(rolId) === 5 || rol === "DATA";
  const isCompras = Number(rolId) === 6 || rol === "COMPRAS";

  const canEditGasto = isAdmin || isData;
  const canEditDimensiones = isAdmin || isData;
  const requiereDimensiones = isAdmin || isData;

  const [finalizado, setFinalizado] = useState(false);
  const [yaTeniaGastoAlAbrir, setYaTeniaGastoAlAbrir] = useState(false);

  const readOnlyTotal = (modo === "facturas_sap") && (finalizado || yaTeniaGastoAlAbrir);
  const isLock = (modo === 'facturas_sap') && !!lockSoloGasto && !readOnlyTotal;

  /* ===== DIMENSIONES ===== */
  const [dLinea, setDLinea] = useState([]);
  const [dRegion, setDRegion] = useState([]);
  const [correoAutoEnviado, setCorreoAutoEnviado] = useState(false);
  const [deptosCache, setDeptosCache] = useState({});

  /* ===== CABECERA ===== */
  const buildCabecera = (d) => {
    const c = d?.Cabecera || {};
    const s = (v) => (v ?? '').toString();

    const normDate = (v) => {
      const txt = s(v);
      if (!txt) return '';
      if (txt.includes('Date(')) {
        const ms = parseInt(txt.replace(/[^0-9]/g, ''), 10);
        if (!Number.isNaN(ms)) return new Date(ms).toISOString().slice(0, 10);
      }
      return txt.slice(0, 10);
    };

    return {
      CardCode: s(c.CardCode),
      CardName: s(c.CardName || d?.Cabecera?.CardName || ''),
      DocDate: normDate(c.DocDate),
      DocDueDate: normDate(c.DocDueDate),
      Serie: s(c.Serie),
      PtoEmi: s(c.PtoEmi),
      Secuencial: s(c.Secuencial),
      NumAtCard: s(c.NumAtCard || `${c.Serie}-${c.PtoEmi}${c.Secuencial}`),
      NroAutorizacion: s(c.NroAutorizacion || ''),
      FechaAutorizacion: normDate(c.FechaAutorizacion),
      TipoEmision: s(c.TipoEmision || 'E'),
      IdSustentoTributario: s(c.IdSustentoTributario || '01'),
      Comments: s(c.Comments || ''),
      TipoDoc: s(c.TipoDoc || '01'),
      FormaPago: s(c.FormaPago || '20'),
      TipoPago: s(c.TipoPago || '01'),
      DocTotal: Number(c.DocTotal ?? d?.Cabecera?.DocTotal ?? 0),
    };
  };

  const [cabecera, setCabecera] = useState(() => buildCabecera(data));

  /* ===== LINEAS ===== */
  const [rows, setRows] = useState(() =>
    ((data?.Lineas || [])).map((ln) => ({
      ItemCode: String(ln.ItemCode || ''),
      Descripcion: String(ln.ItemDescription || ''),
      Cuenta: String(ln.AccountCode || ''),
      Cantidad: n2(ln.Quantity ?? 1),
      Precio: n2(ln.UnitPrice ?? 0),
      DatoAdicional: String(ln.DatoAdicional || ''),
      Descuento: n2(ln.DiscountPercent ?? 0),
      TaxCode: String(ln.TaxCode || 'IVA_15'),
      CostingCode: String(ln.CostingCode || ''),
      CostingCode2: String(ln.CostingCode2 || ''),
      CostingCode3: String(ln.CostingCode3 || ''),
      IdSustentoTributario: String(
        ln.U_SYP_CODIDTRD || (data?.Cabecera?.IdSustentoTributario ?? '01')
      ),
      ConceptoGasto: String(ln.ConceptoGasto || ''),
    }))
  );

  const infoCorreo = useMemo(() => ({
    proveedorCod: cabecera.CardCode || '',
    proveedorNom: cabecera.CardName || '',
    establecimiento: cabecera.Serie || '',
    ptoEmision: cabecera.PtoEmi || '',
    secuencial: cabecera.Secuencial || '',
    numAtCard: cabecera.NumAtCard || '',
    docEntry: data?.DocEntry || '',
  }), [cabecera, data?.DocEntry]);

  const setCab = (k, v) => {
    if (isLock || readOnlyTotal) return;
    setCabecera(p => ({ ...p, [k]: v }));
  };

  function deptoListForRow(lineaCode) {
    const k = String(lineaCode ?? '').trim();
    return Array.isArray(deptosCache[k]) ? deptosCache[k] : [];
  }

  function deptoOptsForRow(lineaCode) {
    const list = deptoListForRow(lineaCode);
    return (list || []).map(o => ({
      value: String(o.code).trim(),
      label: `${String(o.code).trim()} — ${String(o.name || '').trim()}`
    }));
  }

  function ensureOption(options, value) {
    const v = String(value ?? "").trim();
    const arr = Array.isArray(options) ? options : [];
    if (!v) return arr;
    const exists = arr.some(o => String(o.value) === v);
    if (exists) return arr;
    return [{ value: v, label: v }, ...arr];
  }

  function applyToEmpty(field, value, extraPatch = {}) {
    if (readOnlyTotal) return;

    setRows(prev => prev.map(r => {
      const cur = String(r?.[field] ?? "").trim();
      if (cur) return r;
      return { ...r, ...extraPatch, [field]: value };
    }));
  }

  async function getDeptosByLinea(lineaCode) {
    const k = String(lineaCode ?? '').trim();
    if (!k) return [];

    if (Array.isArray(deptosCache[k]) && deptosCache[k].length) {
      return deptosCache[k];
    }

    const base = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://back-compras-ec.onrender.com';
    const res = await fetch(`${base}/api/dimensiones/departamento?linea=${encodeURIComponent(k)}`);
    const j = await res.json();

    const arr = (Array.isArray(j) ? j : [])
      .map(d => ({
        code: String(d?.code ?? d?.Code ?? '').trim(),
        name: String(d?.name ?? d?.Name ?? '').trim(),
      }))
      .filter(d => d.code);

    setDeptosCache(prev => ({
      ...prev,
      [k]: arr
    }));

    return arr;
  }

  /* ===== GASTOS ===== */
  const [gastos, setGastos] = useState([]);
  const [gastosLoaded, setGastosLoaded] = useState(false);
  const [gastosError, setGastosError] = useState(null);

  const updateRow = (ix, patch) => {
    if (readOnlyTotal) return;

    if (isLock) {
      const allowedKeys = [
        "ConceptoGasto",
        "CostingCode",
        "CostingCode2",
        "CostingCode3",
        "DatoAdicional",
      ];

      const keys = Object.keys(patch || {});
      const allAllowed = keys.every(k => allowedKeys.includes(k));
      if (!allAllowed) return;
    }

    setRows(prev => prev.map((r, i) => (i === ix ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    if (readOnlyTotal || isLock) return;

    setRows(prev => ([
      ...prev,
      {
        ItemCode: '',
        Descripcion: '',
        Cuenta: '',
        Cantidad: 1,
        Precio: 0,
        DatoAdicional: '',
        Descuento: 0,
        TaxCode: 'IVA_15',
        CostingCode: '',
        CostingCode2: '',
        CostingCode3: '',
        IdSustentoTributario: cabecera.IdSustentoTributario,
        ConceptoGasto: ''
      }
    ]));
  };
const copiarDatoAdicional = (ix, modo = 'vacias') => {
  if (readOnlyTotal) return;

  const valorBase = String(rows[ix]?.DatoAdicional || '').trim();
  if (!valorBase) return;

  setRows(prev =>
    prev.map((r, i) => {
      if (i === ix) return r;

      if (modo === 'todas') {
        return { ...r, DatoAdicional: valorBase };
      }

      const actual = String(r?.DatoAdicional || '').trim();
      if (!actual) {
        return { ...r, DatoAdicional: valorBase };
      }

      return r;
    })
  );

  setMsg({
    type: 'ok',
    text:
      modo === 'todas'
        ? 'Dato adicional copiado a todas las demás líneas.'
        : 'Dato adicional copiado a las líneas vacías.'
  });
};

const limpiarMsgLuego = () => {
  setTimeout(() => {
    setMsg(null);
  }, 2200);
};
useEffect(() => {
  if (!msg) return;
  const id = setTimeout(() => setMsg(null), 2200);
  return () => clearTimeout(id);
}, [msg]);
  const removeRow = (ix) => {
    if (readOnlyTotal || isLock) return;
    setRows(prev => prev.filter((_, i) => i !== ix));
  };

  function handleSelectGasto(i, value) {
    const g = gastos.find(x =>
      x.gasto === value || x.Name === value || x.code === value || x.Code === value
    );

    if (!g) {
      updateRow(i, { ConceptoGasto: value });
      applyToEmpty("ConceptoGasto", value);
      return;
    }

    const concepto = g.concepto ?? g.U_SYP_CONCEPTO ?? '';
    const cuenta = g.cuenta ?? g.U_SYP_CUENTA ?? '';
    const gastoCod = g.gasto ?? g.Name ?? '';

    if (isLock) {
      updateRow(i, { ConceptoGasto: gastoCod });
      applyToEmpty("ConceptoGasto", gastoCod);
      return;
    }

    updateRow(i, { ConceptoGasto: gastoCod, Descripcion: concepto, Cuenta: cuenta });
    applyToEmpty("ConceptoGasto", gastoCod);
  }

  /* =========================================================
     Effects
  ========================================================= */
  useEffect(() => {
    if (!open || !data) return;

    const tipo = (data?.TipoOC || '').toString().trim().toUpperCase();
    if (!tipo) return;

    if (tipo === 'ARTICULO' || tipo === 'ARTÍCULO') {
      setClase('ARTICULO');
      if (!correoAutoEnviado && !isLock && !readOnlyTotal) {
        setCorreoAutoEnviado(true);
        enviarCorreoArticulo();
      }
    } else {
      setClase('SERVICIO');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data?.TipoOC, correoAutoEnviado, isLock, readOnlyTotal]);

  useEffect(() => {
    if (!open) return;
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://back-compras-ec.onrender.com';

    (async () => {
      try {
        const [a, b] = await Promise.all([
          fetch(`${base}/api/dimensiones/linea`).then(r => r.json()),
          fetch(`${base}/api/dimensiones/region`).then(r => r.json()),
        ]);
        setDLinea(a || []);
        setDRegion(b || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open || !rows.length) return;

    const unicas = Array.from(
      new Set(
        rows
          .map(r => String(r?.CostingCode ?? '').trim())
          .filter(Boolean)
      )
    );

    if (!unicas.length) return;

    (async () => {
      for (const linea of unicas) {
        try {
          await getDeptosByLinea(linea);
        } catch (e) {
          console.error('Error cargando departamentos para línea', linea, e);
        }
      }
    })();
  }, [open, rows]);

  useEffect(() => {
    if (!open || !data || gastosLoaded) return;
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://back-compras-ec.onrender.com';

    (async () => {
      try {
        const res = await fetch(`${base}/api/gastos`);
        if (!res.ok) throw new Error('No se pudo obtener la lista de gastos.');
        const j = await res.json();
        setGastos(Array.isArray(j) ? j : []);
        setGastosLoaded(true);
      } catch (e) {
        console.error(e);
        setGastosError('No se pudieron cargar los conceptos de gasto.');
      }
    })();
  }, [open, data, gastosLoaded]);

  useEffect(() => {
    setCabecera(buildCabecera(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.DocEntry]);

  useEffect(() => {
    if (!data) return;

    const teniaGasto = (data.Lineas || []).some(
      ln => String(ln.ConceptoGasto || "").trim() !== ""
    );
    setYaTeniaGastoAlAbrir(teniaGasto);

    setRows((data.Lineas || []).map((ln) => ({
      ItemCode: String(ln.ItemCode || ''),
      Descripcion: String(ln.ItemDescription || ''),
      Cuenta: String(ln.AccountCode || ln.Cuenta || ''),
      Cantidad: n2(ln.Quantity ?? 1),
      Precio: n2(ln.UnitPrice ?? 0),
      DatoAdicional: String(ln.DatoAdicional || ''),
      Descuento: n2(ln.DiscountPercent ?? 0),
      TaxCode: String(ln.TaxCode || 'IVA_15'),
      CostingCode: String(ln.CostingCode || ''),
      CostingCode2: String(ln.CostingCode2 || ''),
      CostingCode3: String(ln.CostingCode3 || ''),
      IdSustentoTributario: String(
        ln.U_SYP_CODIDTRD || cabecera.IdSustentoTributario
      ),
      ConceptoGasto: String(ln.ConceptoGasto || ''),
    })));

    setFinalizado(false);
  }, [data?.DocEntry, cabecera.IdSustentoTributario]);

  /* ===== OPTIONS ===== */
  const dimOptsLinea = useMemo(
    () => (dLinea || []).map(o => ({ value: o.code, label: `${o.code} — ${o.name}` })),
    [dLinea]
  );

  const dimOptsRegion = useMemo(
    () => (dRegion || []).map(o => ({ value: o.code, label: `${o.code} — ${o.name}` })),
    [dRegion]
  );

  const ivaOpts = useMemo(
    () => IVA_OPTS.map(o => ({ value: o.value, label: o.label })),
    []
  );

  const sustentoOpts = useMemo(
    () => SUSTENTO_OPTS.map(o => ({ value: o.value, label: o.label })),
    []
  );

  const gastoOpts = useMemo(() => (
    (gastos || []).map(g => {
      const code = g.gasto ?? g.Name;
      const label = g.concepto ?? g.U_SYP_CONCEPTO ?? '';
      return { value: code, label: label ? `${code} — ${label}` : String(code) };
    })
  ), [gastos]);

  /* ===== TOTALES ===== */
  const resumen = useMemo(() => {
    let sub = 0, ivaBase = 0;

    for (const r of rows) {
      const base = Math.max(0, n2(r.Cantidad) * n2(r.Precio));
      const disc = base * (n2(r.Descuento) / 100);
      const line = Math.max(0, base - disc);
      sub += line;
      if ((r.TaxCode || 'IVA_15') !== 'IVA_0') ivaBase += line;
    }

    const iva = +(ivaBase * 0.15).toFixed(2);
    const total = +(sub + iva).toFixed(2);
    return { sub: +sub.toFixed(2), iva, total };
  }, [rows]);

  async function enviarCorreoArticulo() {
    try {
      setSending(true);
      setMsg(null);

      const base = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://back-compras-ec.onrender.com';
      const res = await fetch(
        `${base}/api/oc/${data?.OcId || 0}/prefactura/notificar-articulo`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(infoCorreo)
        }
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'No se pudo enviar el correo');
      setMsg({ type: 'ok', text: 'Notificado: se envió el correo para creación del ítem.' });
    } catch (e) {
      setMsg({ type: 'err', text: String(e?.message || e) });
    } finally {
      setSending(false);
    }
  }

  async function guardarBorrador() {
    try {
      setSending(true);
      setMsg(null);

      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://back-compras-ec.onrender.com";
      const docEntry = data?.DocEntry;
      if (!docEntry) throw new Error("No hay DocEntry del borrador.");

      if (clase === "ARTICULO") {
        for (let i = 0; i < rows.length; i++) {
          const it = String(rows[i]?.ItemCode || "").trim();
          if (!it) throw new Error(`Línea ${i + 1}: falta ItemCode (Código artículo)`);
          const qty = Number(rows[i]?.Cantidad ?? 0);
          if (!qty || qty <= 0) throw new Error(`Línea ${i + 1}: Cantidad debe ser mayor a 0`);
        }
      }

      if (requiereDimensiones) {
        for (let i = 0; i < rows.length; i++) {
          const ln = rows[i];
          const linea = String(ln?.CostingCode || "").trim();
          const region = String(ln?.CostingCode2 || "").trim();
          const depto = String(ln?.CostingCode3 || "").trim();

          if (!linea) throw new Error(`Línea ${i + 1}: falta Línea`);
          if (!region) throw new Error(`Línea ${i + 1}: falta Región`);
          if (!depto) throw new Error(`Línea ${i + 1}: falta Departamento`);
        }
      }

      const payload = {
        Cabecera: {
          CardCode: cabecera.CardCode,
          CardName: cabecera.CardName,
          Comments: cabecera.Comments,
          DocDate: cabecera.DocDate,
          DocDueDate: cabecera.DocDueDate,
          Serie: cabecera.Serie,
          PtoEmi: cabecera.PtoEmi,
          Secuencial: cabecera.Secuencial,
          NumAtCard: cabecera.NumAtCard,
          TipoDoc: cabecera.TipoDoc,
          TipoEmision: cabecera.TipoEmision,
          NroAutorizacion: cabecera.NroAutorizacion,
          FechaAutorizacion: cabecera.FechaAutorizacion,
          FormaPago: cabecera.FormaPago,
          TipoPago: cabecera.TipoPago,
          IdSustentoTributario: cabecera.IdSustentoTributario,
        },
        Lineas: rows.map((r) => {
          const qty = Math.max(1, Number(r.Cantidad ?? 1) || 1);

          const baseLn = {
            Descripcion: String(r.Descripcion || ""),
            Quantity: qty,
            Cantidad: qty,
            Precio: Number(r.Precio ?? 0) || 0,
            UnitPrice: Number(r.Precio ?? 0) || 0,
            DatoAdicional: String(r.DatoAdicional || ""),
            Descuento: Number(r.Descuento ?? 0) || 0,
            DiscountPercent: Number(r.Descuento ?? 0) || 0,
            TaxCode: (Number(r.Precio ?? 0) || 0) === 0 ? "IVA_0" : (r.TaxCode || "IVA_15"),
            CostingCode: String(r.CostingCode || ""),
            CostingCode2: String(r.CostingCode2 || ""),
            CostingCode3: String(r.CostingCode3 || ""),
            IdSustentoTributario: String(r.IdSustentoTributario || ""),
          };

          if (clase === "SERVICIO") {
            baseLn.ConceptoGasto = String(r.ConceptoGasto || "");
          }

          if (clase === "ARTICULO") {
            return {
              ...baseLn,
              ItemCode: String(r.ItemCode || "").trim(),
              Cuenta: ""
            };
          }

          return {
            ...baseLn,
            Cuenta: String(r.Cuenta || "").trim(),
            ItemCode: ""
          };
        }),
      };

      const res = await fetch(
        `${baseUrl}/api/oc/${data?.OcId || 0}/prefactura/preview/${docEntry}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "No se pudo actualizar el borrador en SAP");

      if (modo === "facturas_sap") {
        setMsg({ type: "ok", text: "Gasto guardado. Este borrador queda en solo lectura." });
        setFinalizado(true);
        onUse?.({ locked: true, docEntry });
        return;
      }

      setMsg({ type: "ok", text: "Borrador actualizado en SAP." });
      onUse?.({ clase, draftUpdated: true, docEntry });

    } catch (e) {
      setMsg({ type: "err", text: String(e?.message || e) });
    } finally {
      setSending(false);
    }
  }

  if (!open || !data) return null;

  const rowTypeClass = clase === 'ARTICULO' ? styles.articleRow : styles.serviceRow;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalBox}>
        <div className={styles.modalHeader}>
          <div className={styles.titleRow}>
            <h3 className={styles.modalTitle}>
              Factura de Proveedores · Borrador #{data.DocEntry}
            </h3>
            <button
              type="button"
              className={styles.closeX}
              onClick={onClose}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          <div className={styles.inlineBar}>
            <label className={styles.inlineField}>
              <span>Clase</span>
              <select
                value={clase}
                onChange={(e) => setClase(e.target.value)}
                className={styles.select}
                disabled={!!data?.TipoOC || isLock || readOnlyTotal}
                title={clase === "ARTICULO" ? "ARTÍCULO" : "SERVICIO"}
              >
                <option value="ARTICULO">ARTÍCULO</option>
                <option value="SERVICIO">SERVICIO</option>
              </select>
            </label>

            <div className={styles.helperNote}>
              {readOnlyTotal
                ? '✅ Gasto ya registrado: este borrador está en solo lectura.'
                : (canEditDimensiones
                  ? 'Rol Data/Administrador: puedes completar Gasto, Línea, Región y Departamento.'
                  : (clase === 'ARTICULO'
                    ? 'Notifica por correo para crear el ítem en SAP.'
                    : 'Completa las líneas y crea la factura en SAP.'))}
            </div>
          </div>
        </div>

        <div className={styles.modalContent}>
          <div className={styles.form2}>
            <label className={styles.field}>
              <span>Proveedor</span>
              <input readOnly value={cabecera.CardCode} title={t(cabecera.CardCode)} />
            </label>

            <label className={styles.field}>
              <span>Nombre</span>
              <input readOnly value={cabecera.CardName} title={t(cabecera.CardName)} />
            </label>

            <label className={styles.field}>
              <span>Fecha contable</span>
              <input
                type="date"
                value={cabecera.DocDate}
                onChange={e => setCab('DocDate', e.target.value)}
                disabled={isLock || readOnlyTotal}
                title={t(cabecera.DocDate)}
              />
            </label>

            <label className={styles.field}>
              <span>Fecha vencimiento</span>
              <input
                type="date"
                value={cabecera.DocDueDate}
                onChange={e => setCab('DocDueDate', e.target.value)}
                disabled={isLock || readOnlyTotal}
                title={t(cabecera.DocDueDate)}
              />
            </label>

            <label className={styles.field}>
              <span>Serie</span>
              <input readOnly value={cabecera.Serie} title={t(cabecera.Serie)} />
            </label>

            <label className={styles.field}>
              <span>Pto. Emisión</span>
              <input readOnly value={cabecera.PtoEmi} title={t(cabecera.PtoEmi)} />
            </label>

            <label className={styles.field}>
              <span>Secuencial</span>
              <input
                value={cabecera.Secuencial}
                onChange={e => setCab('Secuencial', e.target.value)}
                disabled={isLock || readOnlyTotal}
                title={t(cabecera.Secuencial)}
              />
            </label>

            <label className={styles.field}>
              <span>NumAtCard</span>
              <input
                value={cabecera.NumAtCard}
                onChange={e => setCab('NumAtCard', e.target.value)}
                disabled={isLock || readOnlyTotal}
                title={t(cabecera.NumAtCard)}
              />
            </label>

            <label className={styles.field}>
              <span>Nro Autorización</span>
              <input
                value={cabecera.NroAutorizacion}
                onChange={e => setCab('NroAutorizacion', e.target.value)}
                placeholder="10092025011790..."
                disabled={isLock || readOnlyTotal}
                title={t(cabecera.NroAutorizacion)}
              />
            </label>

            <label className={styles.field}>
              <span>Fecha Autorización</span>
              <input
                type="date"
                value={cabecera.FechaAutorizacion}
                onChange={e => setCab('FechaAutorizacion', e.target.value)}
                disabled={isLock || readOnlyTotal}
                title={t(cabecera.FechaAutorizacion)}
              />
            </label>

            <label className={styles.field}>
              <span>Tipo Emisión</span>
              <select
                value={cabecera.TipoEmision}
                onChange={e => setCab('TipoEmision', e.target.value)}
                disabled={isLock || readOnlyTotal}
                title={cabecera.TipoEmision === "E" ? "E - Electrónica" : "F - Física"}
              >
                <option value="E">E - Electrónica</option>
                <option value="F">F - Física</option>
              </select>
            </label>

            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span>Comentarios</span>
              <textarea
                rows={2}
                value={cabecera.Comments}
                onChange={e => setCab('Comments', e.target.value)}
                disabled={isLock || readOnlyTotal}
                title={t(cabecera.Comments)}
              />
            </label>
          </div>

          {gastosError && <div className={styles.alertErr}>{gastosError}</div>}

          <div className={styles.tableCard}>
            <div className={styles.tscroll}>
              <div className={styles.tableGrid}>
                <div className={`${styles.theadRow} ${rowTypeClass}`}>
                  <div className={`${styles.idx} ${styles.stickyHead}`}>#</div>

                  {clase === 'ARTICULO' ? (
                    <>
                      <div>Código artículo</div>
                      <div>Descripción</div>
                    </>
                  ) : (
                    <>
                      <div>Cuenta*</div>
                      <div>Descripción*</div>
                    </>
                  )}

                  <div>Cant.</div>
                  <div>Precio</div>
                  <div>Desc%</div>
                  <div>IVA</div>
                  <div>Dato adicional</div>
                  <div>Línea*</div>
                  <div>Región*</div>
                  <div>Departamento*</div>
                  <div>Sustento</div>
                  <div>Gasto</div>
                  <div className={styles.right}>Total</div>
                  <div></div>
                </div>

                {rows.map((ln, i) => {
                  const base = Math.max(0, n2(ln.Cantidad) * n2(ln.Precio));
                  const disc = base * (n2(ln.Descuento) / 100);
                  const total = Math.max(0, base - disc);

                  const deptoOptionsSafe = ensureOption(
                    deptoOptsForRow(ln.CostingCode),
                    String(ln.CostingCode3 || '').trim()
                  );

                  const gastoTitle = (() => {
                    const v = t(ln.ConceptoGasto);
                    if (!v) return '';
                    const g = gastos.find(x => (x.gasto ?? x.Name) === v);
                    const label = g ? (g.concepto ?? g.U_SYP_CONCEPTO ?? '') : '';
                    return label ? `${v} — ${label}` : v;
                  })();

                  return (
                    <div className={`${styles.trow} ${rowTypeClass}`} key={i}>
                      <div className={`${styles.idx} ${styles.sticky}`}>{i + 1}</div>

                      {clase === 'ARTICULO' ? (
                        <>
                          <div>
                            <input
                              value={ln.ItemCode || ""}
                              onChange={(e) => updateRow(i, { ItemCode: e.target.value })}
                              disabled={isLock || readOnlyTotal}
                              placeholder="AR-7200"
                              title={t(ln.ItemCode)}
                            />
                          </div>

                          <div>
                            <input
                              value={ln.Descripcion || ""}
                              onChange={(e) => updateRow(i, { Descripcion: e.target.value })}
                              disabled={isLock || readOnlyTotal}
                              placeholder="Descripción del artículo"
                              title={t(ln.Descripcion)}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <input
                              value={ln.Cuenta}
                              onChange={e => updateRow(i, { Cuenta: e.target.value })}
                              placeholder="61103001"
                              disabled={isLock || readOnlyTotal}
                              title={t(ln.Cuenta)}
                            />
                          </div>

                          <div>
                            <input
                              value={ln.Descripcion}
                              onChange={e => updateRow(i, { Descripcion: e.target.value })}
                              placeholder="Detalle del servicio"
                              disabled={isLock || readOnlyTotal}
                              title={t(ln.Descripcion)}
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <input
                          type="number"
                          min={1}
                          step="1"
                          value={ln.Cantidad ?? 1}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            updateRow(i, {
                              Cantidad: Number.isFinite(v) ? Math.max(1, v) : 1
                            });
                          }}
                          disabled={isLock || readOnlyTotal}
                          title={t(ln.Cantidad)}
                        />
                      </div>

                      <div>
                        <input
                          type="number"
                          step="0.01"
                          className={styles.numInp}
                          value={ln.Precio}
                          onChange={e => updateRow(i, { Precio: e.target.value })}
                          disabled={isLock || readOnlyTotal}
                          title={t(ln.Precio)}
                        />
                      </div>

                      <div>
                        <input
                          type="number"
                          step="0.01"
                          className={styles.numInp}
                          value={ln.Descuento}
                          onChange={e => updateRow(i, { Descuento: e.target.value })}
                          disabled={isLock || readOnlyTotal}
                          title={t(ln.Descuento)}
                        />
                      </div>

                      <div>
                        <SearchSelect
                          value={ln.TaxCode}
                          onChange={(v) => updateRow(i, { TaxCode: v })}
                          options={ivaOpts}
                          placeholder="IVA"
                          disabled={isLock || readOnlyTotal}
                          title={titleFromOpts(ln.TaxCode, IVA_OPTS)}
                          maxHeight={220}
                          searchPlaceholder="Buscar IVA..."
                          clearable={false}
                          mode="dialog"
                          dialogTitle="Seleccionar IVA"
                          inputClassName={styles.ssInput}
                        />
                      </div>

                      <div className={styles.datoAdicionalCell}>
  <input
    type="text"
    value={ln.DatoAdicional || ""}
    onChange={(e) => updateRow(i, { DatoAdicional: e.target.value })}
    disabled={readOnlyTotal || (isLock && !(isAdmin || isData))}
    placeholder="Escribe un dato adicional"
    title={t(ln.DatoAdicional)}
  />

  <div className={styles.copyActions}>
    <button
      type="button"
      className={styles.copyMiniBtn}
      onClick={() => copiarDatoAdicional(i, 'vacias')}
      disabled={!String(ln.DatoAdicional || '').trim() || readOnlyTotal}
      title="Copiar a filas vacías"
    >
      Copiar
    </button>

    <button
      type="button"
      className={styles.copyMiniBtnAlt}
      onClick={() => copiarDatoAdicional(i, 'todas')}
      disabled={!String(ln.DatoAdicional || '').trim() || readOnlyTotal}
      title="Reemplazar en todas las filas"
    >
      Todas
    </button>
  </div>
</div>
                      <div>
                        <SearchSelect
                          value={ln.CostingCode}
                          onChange={async (v) => {
                            updateRow(i, { CostingCode: v, CostingCode3: "" });
                            applyToEmpty("CostingCode", v, { CostingCode3: "" });

                            try {
                              await getDeptosByLinea(v);
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          options={dimOptsLinea}
                          placeholder="Seleccione línea"
                          disabled={readOnlyTotal || !canEditDimensiones}
                          title={titleFromDim(ln.CostingCode, dLinea)}
                          searchPlaceholder="Buscar línea..."
                          maxHeight={320}
                          mode="dialog"
                          dialogTitle="Seleccionar línea"
                          inputClassName={styles.ssInput}
                        />
                      </div>

                      <div>
                        <SearchSelect
                          value={ln.CostingCode2}
                          onChange={(v) => {
                            updateRow(i, { CostingCode2: v });
                            applyToEmpty("CostingCode2", v);
                          }}
                          options={dimOptsRegion}
                          placeholder="Seleccione región"
                          disabled={readOnlyTotal || !canEditDimensiones}
                          title={titleFromDim(ln.CostingCode2, dRegion)}
                          searchPlaceholder="Buscar región..."
                          maxHeight={320}
                          mode="dialog"
                          dialogTitle="Seleccionar región"
                          inputClassName={styles.ssInput}
                        />
                      </div>

                      <div>
                        <SearchSelect
                          value={String(ln.CostingCode3 || '').trim()}
                          onChange={(v) => {
                            const depto = String(v || '').trim();
                            updateRow(i, { CostingCode3: depto });
                            applyToEmpty("CostingCode3", depto);
                          }}
                          options={deptoOptionsSafe}
                          placeholder={ln.CostingCode ? 'Seleccione departamento' : 'Primero seleccione línea'}
                          disabled={readOnlyTotal || !canEditDimensiones || !String(ln.CostingCode || '').trim()}
                          title={titleFromDim(ln.CostingCode3, deptoListForRow(ln.CostingCode))}
                          searchPlaceholder="Buscar departamento..."
                          maxHeight={320}
                          mode="dialog"
                          dialogTitle="Seleccionar departamento"
                          inputClassName={styles.ssInput}
                        />
                      </div>

                      <div>
                        <SearchSelect
                          value={ln.IdSustentoTributario}
                          onChange={(v) => updateRow(i, { IdSustentoTributario: v })}
                          options={sustentoOpts}
                          placeholder="Sustento"
                          disabled={isLock || readOnlyTotal || !!t(ln.IdSustentoTributario)}
                          title={titleFromOpts(ln.IdSustentoTributario, SUSTENTO_OPTS)}
                          maxHeight={220}
                          searchPlaceholder="Buscar sustento..."
                          clearable={false}
                          mode="dialog"
                          dialogTitle="Seleccionar sustento"
                          inputClassName={styles.ssInput}
                        />
                      </div>

                      <div>
  <SearchSelect
    value={ln.ConceptoGasto}
    onChange={(v) => handleSelectGasto(i, v)}
    options={gastoOpts}
    placeholder={gastos.length ? "Seleccione concepto de gasto" : "Cargando..."}
    disabled={!gastos.length || readOnlyTotal || (!isLock && !canEditGasto)}
    title={gastoTitle}
    maxHeight={320}
    searchPlaceholder="Buscar gasto..."
    mode="dialog"
    dialogTitle="Seleccionar gasto"
    inputClassName={styles.ssInput}
  />
</div>

                      <div className={styles.num} title={total.toFixed(2)}>
                        {total.toFixed(2)}
                      </div>

                      <div>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => removeRow(i)}
                          aria-label={`Eliminar línea ${i + 1}`}
                          disabled={isLock || readOnlyTotal}
                          title={`Eliminar línea ${i + 1}`}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div className={`${styles.trow} ${styles.addRow} ${rowTypeClass}`}>
                  <div className={styles.addRowBtnWrap}>
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={addRow}
                      disabled={isLock || readOnlyTotal}
                      title={clase === 'ARTICULO'
                        ? 'Agregar una nueva línea de artículo'
                        : 'Agregar una nueva línea de servicio'}
                    >
                      {clase === 'ARTICULO'
                        ? '+ Agregar línea de artículo'
                        : '+ Agregar línea de servicio'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {msg && (
            <div className={msg.type === 'ok' ? styles.alertOk : styles.alertErr}>
              {msg.text}
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <div className={styles.resumen}>
            <div>
              <span>Subtotal</span>
              <strong className={styles.num}>${resumen.sub.toFixed(2)}</strong>
            </div>
            <div>
              <span>IVA 15%</span>
              <strong className={styles.num}>${resumen.iva.toFixed(2)}</strong>
            </div>
            <div>
              <span>Total calculado</span>
              <strong className={styles.num}>${resumen.total.toFixed(2)}</strong>
            </div>
            <div>
              <span>Total borrador SAP</span>
              <strong className={styles.num}>
                ${Number(cabecera.DocTotal || 0).toFixed(2)}
              </strong>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.secondary}
              onClick={onClose}
              disabled={sending}
              title="Cerrar"
            >
              Cerrar
            </button>

            <button
              className={styles.primary}
              onClick={guardarBorrador}
              disabled={sending || readOnlyTotal}
              title={readOnlyTotal ? "Este borrador ya tiene gasto guardado" : "Guardar cambios del borrador"}
            >
              {sending ? 'Guardando…' : (readOnlyTotal ? 'Solo lectura' : 'Guardar borrador')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}