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

function n2(v){
  if (typeof v === 'string') v = v.replace(',', '.');
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function str(v){ return (v ?? '').toString(); }
const t = (v) => String(v ?? '').trim();

function titleFromOpts(value, opts = []) {
  const v = t(value);
  if (!v) return '';
  const found = opts.find(o => String(o.value) === v);
  return found ? found.label : v;
}
function titleFromDim(code, list = []) {
  const v = t(code);
  if (!v) return '';
  const found = list.find(o => String(o.code) === v);
  return found ? `${found.code} — ${found.name}` : v;
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
  const isData  = Number(rolId) === 5 || rol === "DATA";
  const canEditGasto = isAdmin || isData;

  /* ===== DIMENSIONES ===== */
  const [dLinea, setDLinea] = useState([]);
  const [dRegion, setDRegion] = useState([]);
  const [correoAutoEnviado, setCorreoAutoEnviado] = useState(false);

  // ✅ cache deptos por línea (key = línea)
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
      ItemCode: ln.ItemCode || '',
      Descripcion: ln.ItemDescription || '',
      Cuenta: ln.AccountCode || '',
      Cantidad: n2(ln.Quantity ?? 1),
      Precio: n2(ln.UnitPrice ?? 0),
      Descuento: n2(ln.DiscountPercent ?? 0),
      TaxCode: ln.TaxCode || 'IVA_15',
      CostingCode: ln.CostingCode || '',
      CostingCode2: ln.CostingCode2 || '',
      CostingCode3: ln.CostingCode3 || '',
      IdSustentoTributario: ln.U_SYP_CODIDTRD || (data?.Cabecera?.IdSustentoTributario ?? '01'),
      ConceptoGasto: str(ln.ConceptoGasto || ''),
    }))
  );

  /* ===== BLOQUEO ===== */
  const [finalizado, setFinalizado] = useState(false);
  const [yaTeniaGastoAlAbrir, setYaTeniaGastoAlAbrir] = useState(false);

  const readOnlyTotal = (modo === "facturas_sap") && (finalizado || yaTeniaGastoAlAbrir);
  const isLock = (modo === 'facturas_sap') && !!lockSoloGasto && !readOnlyTotal;

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

  /* =========================================================
     Helpers deptos
  ========================================================= */
  function deptoListForRow(lineaCode) {
  const k = String(lineaCode || '').trim();
  return k && deptosCache[k] ? deptosCache[k] : [];
}

function deptoOptsForRow(lineaCode) {
  const list = deptoListForRow(lineaCode);
  return (list || []).map(o => ({
    value: String(o.code).trim(),
    label: `${String(o.code).trim()} — ${String(o.name || '').trim()}`
  }));
}


  // ✅ asegura que el value exista en options (evita que SearchSelect lo "borre")
  function ensureOption(options, value) {
    const v = String(value ?? "").trim();
    const arr = Array.isArray(options) ? options : [];
    if (!v) return arr;
    const exists = arr.some(o => String(o.value) === v);
    if (exists) return arr;
    return [{ value: v, label: v }, ...arr];
  }

  // ✅ aplica patch a todas las filas SOLO si el campo está vacío
  function applyToEmpty(field, value, extraPatch = {}) {
    if (readOnlyTotal) return;

    setRows(prev => prev.map(r => {
      const cur = String(r?.[field] ?? "").trim();
      if (cur) return r;
      return { ...r, ...extraPatch, [field]: value };
    }));
  }

  // ✅ trae deptos por línea y guarda en cache
  async function getDeptosByLinea(lineaCode) {
  const k = String(lineaCode || '').trim();
  if (!k) return [];

  if (deptosCache[k]) return deptosCache[k];

  const base = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://back-compras-ec.onrender.com';
  const res = await fetch(`${base}/api/dimensiones/departamento?linea=${encodeURIComponent(k)}`);
  const j = await res.json();

  const arr = (Array.isArray(j) ? j : [])
    .map(d => {
      const code = String(d?.code ?? d?.Code ?? '').trim();
      const name = String(d?.name ?? d?.Name ?? '').trim();
      return { code, name };
    })
    .filter(d => d.code);

  setDeptosCache(prev => ({ ...prev, [k]: arr }));
  return arr;
}


  /* ===== GASTOS ===== */
  const [gastos, setGastos] = useState([]);
  const [gastosLoaded, setGastosLoaded] = useState(false);
  const [gastosError, setGastosError] = useState(null);

  const updateRow = (ix, patch) => {
    if (readOnlyTotal) return;

    if (isLock) {
      const keys = Object.keys(patch || {});
      const onlyGasto = keys.length === 1 && keys[0] === "ConceptoGasto";
      if (!onlyGasto) return;
    }
    setRows(prev => prev.map((r, i) => (i === ix ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    if (readOnlyTotal || isLock || clase === 'ARTICULO') return;
    setRows(prev => ([
      ...prev,
      {
        ItemCode: '',
        Descripcion: '',
        Cuenta: '',
        Cantidad: 1,
        Precio: 0,
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

  const removeRow = (ix) => {
    if (readOnlyTotal || isLock || clase === 'ARTICULO') return;
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
    const cuenta   = g.cuenta ?? g.U_SYP_CUENTA ?? '';
    const gastoCod = g.gasto ?? g.Name ?? '';

    if (isLock) {
      updateRow(i, { ConceptoGasto: gastoCod });
      applyToEmpty("ConceptoGasto", gastoCod);
      return;
    }

    // esta fila
    updateRow(i, { ConceptoGasto: gastoCod, Descripcion: concepto, Cuenta: cuenta });

    // otras solo si están vacías
    applyToEmpty("ConceptoGasto", gastoCod);
  }

  /* =========================================================
     Effects
  ========================================================= */
  // 1) Set clase por tipo OC
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

  // 2) Cargar dimensiones (línea / región)
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

  // ✅ precargar deptos para líneas ya existentes al abrir
  useEffect(() => {
    if (!open) return;
    (async () => {
      const unicas = Array.from(
        new Set((rows || []).map(r => String(r.CostingCode || '').trim()).filter(Boolean))
      );
      for (const l of unicas) {
        try { await getDeptosByLinea(l); } catch {}
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 3) Cargar gastos
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

  // 4) Refrescar cabecera
  useEffect(() => {
    setCabecera(buildCabecera(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.DocEntry]);

  // 5) Refrescar líneas
  useEffect(() => {
    if (!data) return;

    const teniaGasto = (data.Lineas || []).some(ln => String(ln.ConceptoGasto || "").trim() !== "");
    setYaTeniaGastoAlAbrir(teniaGasto);

    setRows((data.Lineas || []).map((ln) => ({
      ItemCode: ln.ItemCode || '',
      Descripcion: ln.ItemDescription || '',
      Cuenta: str(ln.AccountCode || ln.Cuenta || ''),
      Cantidad: n2(ln.Quantity ?? 1),
      Precio: n2(ln.UnitPrice ?? 0),
      Descuento: n2(ln.DiscountPercent ?? 0),
      TaxCode: ln.TaxCode || 'IVA_15',
      CostingCode: ln.CostingCode || '',
      CostingCode2: ln.CostingCode2 || '',
      CostingCode3: ln.CostingCode3 || '',
      IdSustentoTributario: (ln.U_SYP_CODIDTRD || cabecera.IdSustentoTributario),
      ConceptoGasto: str(ln.ConceptoGasto || ''),
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
  const ivaOpts = useMemo(() => IVA_OPTS.map(o => ({ value: o.value, label: o.label })), []);
  const sustentoOpts = useMemo(() => SUSTENTO_OPTS.map(o => ({ value: o.value, label: o.label })), []);
  const gastoOpts = useMemo(() => (gastos || []).map(g => {
    const code = g.gasto ?? g.Name;
    const label = g.concepto ?? g.U_SYP_CONCEPTO ?? '';
    return { value: code, label: label ? `${code} — ${label}` : String(code) };
  }), [gastos]);

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

      // ✅ OBLIGATORIOS: Línea / Región / Departamento (para cada línea)
      for (let i = 0; i < rows.length; i++) {
        const ln = rows[i];
        const linea = String(ln?.CostingCode || "").trim();
        const region = String(ln?.CostingCode2 || "").trim();
        const depto = String(ln?.CostingCode3 || "").trim();
        if (!linea) throw new Error(`Línea ${i + 1}: falta Línea`);
        if (!region) throw new Error(`Línea ${i + 1}: falta Región`);
        if (!depto) throw new Error(`Línea ${i + 1}: falta Departamento`);
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
            Descuento: Number(r.Descuento ?? 0) || 0,
            DiscountPercent: Number(r.Descuento ?? 0) || 0,
            TaxCode: (Number(r.Precio ?? 0) || 0) === 0 ? "IVA_0" : (r.TaxCode || "IVA_15"),
            CostingCode: String(r.CostingCode || ""),
            CostingCode2: String(r.CostingCode2 || ""),
            CostingCode3: String(r.CostingCode3 || ""),
            IdSustentoTributario: String(r.IdSustentoTributario || ""),
          };

          if (clase === "SERVICIO") baseLn.ConceptoGasto = String(r.ConceptoGasto || "");

          if (clase === "ARTICULO") {
            return { ...baseLn, ItemCode: String(r.ItemCode || "").trim(), Cuenta: "" };
          }
          return { ...baseLn, Cuenta: String(r.Cuenta || "").trim(), ItemCode: "" };
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

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalBox}>

        {/* Header */}
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
                : (isLock
                  ? 'Rol Data: solo puedes seleccionar el Gasto.'
                  : (clase === 'ARTICULO'
                    ? 'Notifica por correo para crear el ítem en SAP.'
                    : 'Completa las líneas y crea la factura en SAP.'))}
            </div>
          </div>
        </div>

        {/* Contenido */}
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

                {/* HEADER */}
                <div className={styles.theadRow}>
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
                  <div>Línea*</div>
                  <div>Región*</div>
                  <div>Departamento*</div>
                  <div>Sustento</div>
                  {clase === "SERVICIO" && <div>Gasto</div>}
                  <div className={styles.right}>Total</div>
                  <div></div>
                </div>

                {/* FILAS */}
                {rows.map((ln, i) => {
                  const base = Math.max(0, n2(ln.Cantidad) * n2(ln.Precio));
                  const disc = base * (n2(ln.Descuento) / 100);
                  const total = Math.max(0, base - disc);

                  // ✅ deptoOptionsSafe AQUÍ adentro (aquí existe ln)
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
                    <div className={styles.trow} key={i}>
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
                            updateRow(i, { Cantidad: Number.isFinite(v) ? Math.max(1, v) : 1 });
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

                      {/* IVA */}
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

                      {/* LÍNEA (D1) */}
                      <div>
                        <SearchSelect
                          value={ln.CostingCode}
                          onChange={async (v) => {
                            // esta fila
                            updateRow(i, { CostingCode: v, CostingCode3: "" });

                            // otras filas vacías: set linea y limpia depto
                            applyToEmpty("CostingCode", v, { CostingCode3: "" });

                            // precargar deptos
                            try { await getDeptosByLinea(v); } catch(e) { console.error(e); }
                          }}
                          options={dimOptsLinea}
                          placeholder="Seleccione línea"
                          disabled={isLock || readOnlyTotal}
                          title={titleFromDim(ln.CostingCode, dLinea)}
                          searchPlaceholder="Buscar línea..."
                          maxHeight={320}
                          mode="dialog"
                          dialogTitle="Seleccionar línea"
                          inputClassName={styles.ssInput}
                        />
                      </div>

                      {/* REGIÓN (D2) */}
                      <div>
                        <SearchSelect
                          value={ln.CostingCode2}
                          onChange={(v) => {
                            updateRow(i, { CostingCode2: v });
                            applyToEmpty("CostingCode2", v);
                          }}
                          options={dimOptsRegion}
                          placeholder="Seleccione región"
                          disabled={isLock || readOnlyTotal}
                          title={titleFromDim(ln.CostingCode2, dRegion)}
                          searchPlaceholder="Buscar región..."
                          maxHeight={320}
                          mode="dialog"
                          dialogTitle="Seleccionar región"
                          inputClassName={styles.ssInput}
                        />
                      </div>

                      {/* DEPARTAMENTO (D3) */}
                      <div>
                        <SearchSelect
                          value={ln.CostingCode3}
                          onChange={(v) => {
                            updateRow(i, { CostingCode3: v });
                            applyToEmpty("CostingCode3", v);
                          }}
                          options={deptoOptionsSafe}
                          placeholder={ln.CostingCode ? "Seleccione departamento" : "Primero seleccione línea"}
                          disabled={readOnlyTotal || !ln.CostingCode}
                          title={titleFromDim(ln.CostingCode3, deptoListForRow(ln.CostingCode))}
                          searchPlaceholder="Buscar departamento..."
                          maxHeight={320}
                          mode="dialog"
                          dialogTitle="Seleccionar departamento"
                          inputClassName={styles.ssInput}
                        />
                      </div>

                      {/* SUSTENTO (bloqueado si ya está lleno) */}
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

                      {/* GASTO */}
                      {clase === "SERVICIO" && (
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
                      )}

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

                {/* ADD ROW */}
                {clase !== 'ARTICULO' && (
                  <div className={`${styles.trow} ${styles.addRow}`}>
                    <div className={styles.addRowBtnWrap}>
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={addRow}
                        disabled={isLock || readOnlyTotal}
                        title="Agregar una nueva línea de servicio"
                      >
                        + Agregar línea de servicio
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>

          {msg && (
            <div className={msg.type === 'ok' ? styles.alertOk : styles.alertErr}>
              {msg.text}
            </div>
          )}
        </div>

        {/* Footer */}
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
