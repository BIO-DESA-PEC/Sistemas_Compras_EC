'use client';

import { useState, useMemo, useEffect } from 'react';
import styles from './FacturaPreviewModal.module.css';

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
  const canEditGasto = isAdmin || isData;   // ✅ SOLO estos pueden

  /* ===== DIMENSIONES ===== */
  const [dLinea,  setDLinea]  = useState([]); // 1/2/3
  const [dRegion, setDRegion] = useState([]); // 01..05
  const [dDepto,  setDDepto]  = useState([]); // resto
  const [correoAutoEnviado, setCorreoAutoEnviado] = useState(false);

  /* ===== GASTOS ===== */
  const [gastos, setGastos] = useState([]);
  const [gastosLoaded, setGastosLoaded] = useState(false);
  const [gastosError, setGastosError] = useState(null);

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
      // 👉 PARA ARTÍCULO
      ItemCode: ln.ItemCode || '',
      Descripcion: ln.ItemDescription || '',

      // 👉 PARA SERVICIO
      Cuenta: ln.AccountCode || '',

      Cantidad: n2(ln.Quantity ?? 1),
      Precio: n2(ln.UnitPrice ?? 0),
      Descuento: n2(ln.DiscountPercent ?? 0),
      TaxCode: ln.TaxCode || 'IVA_15',

      CostingCode:  ln.CostingCode  || '',
      CostingCode2: ln.CostingCode2 || '',
      CostingCode3: ln.CostingCode3 || '',

      IdSustentoTributario: ln.U_SYP_CODIDTRD || (data?.Cabecera?.IdSustentoTributario ?? '01'),
      ConceptoGasto: str(ln.ConceptoGasto || ''),
    }))
  );

  /* ============================================
     ✅ NUEVO: BLOQUEO DEFINITIVO DESPUÉS DE GUARDAR
     ============================================ */

  // Se pone true cuando Data guarda el gasto en este modal
  const [finalizado, setFinalizado] = useState(false);
  // ✅ Guarda si el borrador YA venía con gasto desde SAP (al abrir)
  const [yaTeniaGastoAlAbrir, setYaTeniaGastoAlAbrir] = useState(false);

  const readOnlyTotal = (modo === "facturas_sap") && (finalizado || yaTeniaGastoAlAbrir);

  // ✅ Data lock: mientras NO esté finalizado => solo gasto editable
  const isLock = (modo === 'facturas_sap') && !!lockSoloGasto && !readOnlyTotal;

  /* ===== INFO CORREO ===== */
  const infoCorreo = useMemo(() => ({
    proveedorCod: cabecera.CardCode || '',
    proveedorNom: cabecera.CardName || '',
    establecimiento: cabecera.Serie || '',
    ptoEmision: cabecera.PtoEmi || '',
    secuencial: cabecera.Secuencial || '',
    numAtCard: cabecera.NumAtCard || '',
    docEntry: data?.DocEntry || '',
  }), [cabecera, data?.DocEntry]);

  // 🔒 setter cabecera
  const setCab = (k, v) => {
    if (isLock || readOnlyTotal) return; // 🚫 bloquear cabecera
    setCabecera(p => ({ ...p, [k]: v }));
  };

  /* =========================
     EFFECTS
     ========================= */

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

  // 2) Cargar dimensiones
  useEffect(() => {
    if (!open) return;
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://back-compras-ec.onrender.com';

    (async () => {
      try {
        const [a, b, c] = await Promise.all([
          fetch(`${base}/api/dimensiones/linea`).then(r => r.json()),
          fetch(`${base}/api/dimensiones/region`).then(r => r.json()),
          fetch(`${base}/api/dimensiones/departamento`).then(r => r.json()),
        ]);
        setDLinea(a || []);
        setDRegion(b || []);
        setDDepto(c || []);
      } catch (e) {
        console.error(e);
      }
    })();
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

  // 4) Refrescar cabecera cuando cambia DocEntry
  useEffect(() => {
    setCabecera(buildCabecera(data));
  }, [data?.DocEntry]);

  // 5) Refrescar líneas cuando cambia DocEntry o sustento
  useEffect(() => {
  if (!data) return;

  // ✅ Detecta si el borrador YA tenía gasto desde SAP (NO usa rows editables)
  const teniaGasto = (data.Lineas || []).some(ln =>
    String(ln.ConceptoGasto || "").trim() !== ""
  );
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

  // ✅ si abres otro docEntry, resetea finalizado
  setFinalizado(false);
}, [data?.DocEntry, cabecera.IdSustentoTributario]);

  const updateRow = (ix, patch) => {
    // 🔒 si ya finalizó o ya tenía gasto => nada editable
    if (readOnlyTotal) return;

    // ✅ bloqueo parcial: solo ConceptoGasto
    if (isLock) {
      const keys = Object.keys(patch || {});
      const onlyGasto = keys.length === 1 && keys[0] === "ConceptoGasto";
      if (!onlyGasto) return;
    }

    setRows((prev) => prev.map((r, i) => (i === ix ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    if (readOnlyTotal || isLock || clase === 'ARTICULO') return;
    setRows(prev => ([
      ...prev,
      {
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
    const g = gastos.find(x => x.gasto === value || x.Name === value || x.code === value || x.Code === value);
    if (!g) { updateRow(i, { ConceptoGasto: value }); return; }

    const concepto = g.concepto ?? g.U_SYP_CONCEPTO ?? '';
    const cuenta   = g.cuenta   ?? g.U_SYP_CUENTA   ?? '';
    const gastoCod = g.gasto    ?? g.Name           ?? '';

    // ✅ si está bloqueado, solo cambia ConceptoGasto (no toca Cuenta/Descripcion)
    if (isLock) {
      updateRow(i, { ConceptoGasto: gastoCod });
      return;
    }

    updateRow(i, { ConceptoGasto: gastoCod, Descripcion: concepto, Cuenta: cuenta });
  }

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

  /* ===== ACCIONES ===== */
  async function enviarCorreoArticulo() {
    try {
      setSending(true); setMsg(null);
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://back-compras-ec.onrender.com';
      const res = await fetch(`${base}/api/oc/${data?.OcId || 0}/prefactura/notificar-articulo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(infoCorreo)
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'No se pudo enviar el correo');
      setMsg({ type: 'ok', text: 'Notificado: se envió el correo para creación del ítem.' });
    } catch (e) {
      setMsg({ type: 'err', text: String(e?.message || e) });
    } finally {
      setSending(false);
    }
  }

  function validateServicio() {
    if (!cabecera.CardCode) return 'Falta el proveedor (CardCode).';
    if (!cabecera.DocDate) return 'Falta la Fecha contable.';
    if (!cabecera.DocDueDate) return 'Falta la Fecha de vencimiento.';
    if (!cabecera.Serie || !cabecera.PtoEmi || !cabecera.Secuencial) return 'Falta Serie/PtoEmi/Secuencial.';
    if (cabecera.TipoEmision === 'E') {
      if (!cabecera.NroAutorizacion) return 'Falta NroAutorizacion (electrónica).';
      if (!cabecera.FechaAutorizacion) return 'Falta FechaAutorizacion (electrónica).';
    }
    if (!rows.length) return 'Debes ingresar al menos una línea.';
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!str(r.Cuenta)) return `Línea ${i + 1}: la Cuenta es obligatoria.`;
      if (!str(r.CostingCode)) return `Línea ${i + 1}: Dim 1 (Línea de negocio) es obligatoria.`;
    }
    return null;
  }

  async function crearFacturaServicio() {
    const err = validateServicio();
    if (err) { setMsg({ type: 'err', text: err }); return; }

    try {
      setSending(true); setMsg(null);
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://back-compras-ec.onrender.com';
      const payload = {
        Cabecera: {
          CardCode: cabecera.CardCode, DocDate: cabecera.DocDate, DocDueDate: cabecera.DocDueDate,
          Serie: cabecera.Serie, PtoEmi: cabecera.PtoEmi, Secuencial: cabecera.Secuencial, NumAtCard: cabecera.NumAtCard,
          TipoDoc: cabecera.TipoDoc, TipoEmision: cabecera.TipoEmision,
          NroAutorizacion: cabecera.NroAutorizacion, FechaAutorizacion: cabecera.FechaAutorizacion,
          FormaPago: cabecera.FormaPago, TipoPago: cabecera.TipoPago,
          IdSustentoTributario: cabecera.IdSustentoTributario, Comments: cabecera.Comments,
        },
        Lineas: rows.map((r) => {
          const qty = Math.max(1, Number(r.Cantidad ?? 1) || 1);
          const price = Number(r.Precio ?? 0) || 0;
          const disc = Number(r.Descuento ?? 0) || 0;

          if (clase === "ARTICULO") {
            return {
              ItemCode: String(r.ItemCode || "").trim(),
              Quantity: qty,
              UnitPrice: price,
              DiscountPercent: disc,
              TaxCode: price === 0 ? "IVA_0" : (r.TaxCode || "IVA_15"),

              CostingCode: String(r.CostingCode || ""),
              CostingCode2: String(r.CostingCode2 || ""),
              CostingCode3: String(r.CostingCode3 || ""),

              ConceptoGasto: String(r.ConceptoGasto || ""),
              IdSustentoTributario: String(r.IdSustentoTributario || ""),
            };
          }

          return {
            AccountCode: String(r.Cuenta || "").trim(),
            ItemDescription: String(r.Descripcion || "SERVICIO").trim(),
            Quantity: qty,
            UnitPrice: price,
            DiscountPercent: disc,
            TaxCode: price === 0 ? "IVA_0" : (r.TaxCode || "IVA_15"),

            CostingCode: String(r.CostingCode || ""),
            CostingCode2: String(r.CostingCode2 || ""),
            CostingCode3: String(r.CostingCode3 || ""),

            ConceptoGasto: String(r.ConceptoGasto || ""),
            IdSustentoTributario: String(r.IdSustentoTributario || ""),
          };
        }),
      };
      const res = await fetch(`${base}/api/oc/${data?.OcId || 0}/prefactura/servicio`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'No se pudo crear la factura de servicio');
      setMsg({ type: 'ok', text: `Factura creada (SERVICIO). DocEntry ${j?.DocEntry} — DocNum ${j?.DocNum}` });
      onUse?.({ clase: 'SERVICIO', created: j });
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

      const baseUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "https://back-compras-ec.onrender.com";

      const docEntry = data?.DocEntry;
      if (!docEntry) throw new Error("No hay DocEntry del borrador.");

      // ✅ Validación FRONT antes de pegarle al back
      if (clase === "ARTICULO") {
        for (let i = 0; i < rows.length; i++) {
          const it = String(rows[i]?.ItemCode || "").trim();
          if (!it) throw new Error(`Línea ${i + 1}: falta ItemCode (Código artículo)`);
          const qty = Number(rows[i]?.Cantidad ?? 0);
          if (!qty || qty <= 0) throw new Error(`Línea ${i + 1}: Cantidad debe ser mayor a 0`);
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

            Descuento: Number(r.Descuento ?? 0) || 0,
            DiscountPercent: Number(r.Descuento ?? 0) || 0,

            TaxCode: (Number(r.Precio ?? 0) || 0) === 0 ? "IVA_0" : (r.TaxCode || "IVA_15"),

            CostingCode: String(r.CostingCode || ""),
            CostingCode2: String(r.CostingCode2 || ""),
            CostingCode3: String(r.CostingCode3 || ""),

            IdSustentoTributario: String(r.IdSustentoTributario || ""),
          };

          // ✅ SOLO SERVICIO manda ConceptoGasto
          if (clase === "SERVICIO") {
            baseLn.ConceptoGasto = String(r.ConceptoGasto || "");
          }

          if (clase === "ARTICULO") {
            return {
              ...baseLn,
              ItemCode: String(r.ItemCode || "").trim(),
              Cuenta: "",
            };
          }

          return {
            ...baseLn,
            Cuenta: String(r.Cuenta || "").trim(),
            ItemCode: "",
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

      // ✅ AQUI ES EL CAMBIO CLAVE
      if (modo === "facturas_sap") {
        setMsg({ type: "ok", text: "Gasto guardado. Este borrador queda en solo lectura." });
        setFinalizado(true);                 // 🔒 bloquea todo ya
        onUse?.({ locked: true, docEntry }); // ✅ para que en la lista salga "Ver"
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

  /* ===== RENDER ===== */
  if (!open || !data) return null;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalBox}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.titleRow}>
            <h3 className={styles.modalTitle}>Factura de Proveedores · Borrador #{data.DocEntry}</h3>
            <button type="button" className={styles.closeX} onClick={onClose} aria-label="Cerrar">×</button>
          </div>

          <div className={styles.inlineBar}>
            <label className={styles.inlineField}>
              <span>Clase</span>
              <select
                value={clase}
                onChange={(e)=>setClase(e.target.value)}
                className={styles.select}
                disabled={!!data?.TipoOC || isLock || readOnlyTotal}
              >
                <option value="ARTICULO">ARTÍCULO</option>
                <option value="SERVICIO">SERVICIO</option>
              </select>
            </label>

            <div className={styles.helperNote}>
              {readOnlyTotal
                ? '✅ Gasto ya registrado: este borrador está en solo lectura.'
                : (isLock ? 'Rol Data: solo puedes seleccionar el Gasto.' :
                    (clase === 'ARTICULO'
                      ? 'Notifica por correo para crear el ítem en SAP.'
                      : 'Completa las líneas y crea la factura en SAP.'))
              }
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div className={styles.modalContent}>
          {/* FORM 2×N */}
          <div className={styles.form2}>
            <label className={styles.field}>
              <span>Proveedor</span>
              <input readOnly value={cabecera.CardCode}/>
            </label>
            <label className={styles.field}>
              <span>Nombre</span>
              <input readOnly value={cabecera.CardName}/>
            </label>

            <label className={styles.field}>
              <span>Fecha contable</span>
              <input
                type="date"
                value={cabecera.DocDate}
                onChange={e=>setCab('DocDate',e.target.value)}
                disabled={isLock || readOnlyTotal}
              />
            </label>
            <label className={styles.field}>
              <span>Fecha vencimiento</span>
              <input
                type="date"
                value={cabecera.DocDueDate}
                onChange={e=>setCab('DocDueDate',e.target.value)}
                disabled={isLock || readOnlyTotal}
              />
            </label>

            <label className={styles.field}>
              <span>Serie</span>
              <input readOnly value={cabecera.Serie}/>
            </label>
            <label className={styles.field}>
              <span>Pto. Emisión</span>
              <input readOnly value={cabecera.PtoEmi}/>
            </label>

            <label className={styles.field}>
              <span>Secuencial</span>
              <input
                value={cabecera.Secuencial}
                onChange={e=>setCab('Secuencial',e.target.value)}
                disabled={isLock || readOnlyTotal}
              />
            </label>
            <label className={styles.field}>
              <span>NumAtCard</span>
              <input
                value={cabecera.NumAtCard}
                onChange={e=>setCab('NumAtCard',e.target.value)}
                disabled={isLock || readOnlyTotal}
              />
            </label>

            <label className={styles.field}>
              <span>Nro Autorización</span>
              <input
                value={cabecera.NroAutorizacion}
                onChange={e=>setCab('NroAutorizacion',e.target.value)}
                placeholder="10092025011790..."
                disabled={isLock || readOnlyTotal}
              />
            </label>
            <label className={styles.field}>
              <span>Fecha Autorización</span>
              <input
                type="date"
                value={cabecera.FechaAutorizacion}
                onChange={e=>setCab('FechaAutorizacion',e.target.value)}
                disabled={isLock || readOnlyTotal}
              />
            </label>

            <label className={styles.field}>
              <span>Tipo Emisión</span>
              <select
                value={cabecera.TipoEmision}
                onChange={e=>setCab('TipoEmision',e.target.value)}
                disabled={isLock || readOnlyTotal}
              >
                <option value="E">E - Electrónica</option>
                <option value="F">F - Física</option>
              </select>
            </label>

            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span>Comentarios</span>
              <textarea
                rows={3}
                value={cabecera.Comments}
                onChange={e=>setCab('Comments',e.target.value)}
                disabled={isLock || readOnlyTotal}
              />
            </label>
          </div>

          {gastosError && <div className={styles.alertErr}>{gastosError}</div>}

          {/* DETALLE */}
          <div className={styles.tableCard}>
            <div className={styles.tscroll}>
              <div className={`${styles.trow} ${styles.thead}`}>
                <div className={styles.idx}>#</div>

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
                <div>Línea</div>
                <div>Región</div>
                <div>Departamento</div>
                <div>Sustento</div>
                {clase === "SERVICIO" && <div>Gasto</div>}
                <div className={styles.right}>Total</div>
                <div></div>
              </div>

              {rows.map((ln, i) => {
                const base = Math.max(0, n2(ln.Cantidad) * n2(ln.Precio));
                const disc = base * (n2(ln.Descuento) / 100);
                const total = Math.max(0, base - disc);

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
                          />
                        </div>

                        <div>
                          <input
                            value={ln.Descripcion || ""}
                            onChange={(e) => updateRow(i, { Descripcion: e.target.value })}
                            disabled={isLock || readOnlyTotal}
                            placeholder="Descripción del artículo"
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
                          />
                        </div>

                        <div>
                          <input
                            value={ln.Descripcion}
                            onChange={e => updateRow(i, { Descripcion: e.target.value })}
                            placeholder="Detalle del servicio"
                            disabled={isLock || readOnlyTotal}
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
                      />
                    </div>

                    {/* IVA */}
                    <div>
                      <select
                        value={ln.TaxCode}
                        onChange={e => updateRow(i, { TaxCode: e.target.value })}
                        disabled={isLock || readOnlyTotal}
                      >
                        {IVA_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>

                    {/* LÍNEA (D1) */}
                    <div>
                      <select
                        value={ln.CostingCode}
                        onChange={e => updateRow(i, { CostingCode: e.target.value })}
                        disabled={isLock || readOnlyTotal}
                      >
                        <option value="">Seleccione línea</option>
                        {dLinea.map(o => <option key={o.code} value={o.code}>{o.code} — {o.name}</option>)}
                      </select>
                    </div>

                    {/* REGIÓN (D2) */}
                    <div>
                      <select
                        value={ln.CostingCode2}
                        onChange={e => updateRow(i, { CostingCode2: e.target.value })}
                        disabled={isLock || readOnlyTotal}
                      >
                        <option value="">Seleccione región</option>
                        {dRegion.map(o => <option key={o.code} value={o.code}>{o.code} — {o.name}</option>)}
                      </select>
                    </div>

                    {/* DEPARTAMENTO (D3) */}
                    <div>
                      <select
                        value={ln.CostingCode3}
                        onChange={e => updateRow(i, { CostingCode3: e.target.value })}
                        disabled={isLock || readOnlyTotal}
                      >
                        <option value="">Seleccione departamento</option>
                        {dDepto.map(o => <option key={o.code} value={o.code}>{o.code} — {o.name}</option>)}
                      </select>
                    </div>

                    {/* SUSTENTO */}
                    <div>
                      <select
                        value={ln.IdSustentoTributario}
                        onChange={e => updateRow(i, { IdSustentoTributario: e.target.value })}
                        disabled={isLock || readOnlyTotal}
                      >
                        {SUSTENTO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>

                    {/* ✅ GASTO */}
                    {clase === "SERVICIO" && (
                      <div>
                        <select
                          value={ln.ConceptoGasto}
                          onChange={(e) => handleSelectGasto(i, e.target.value)}
                          disabled={
                            !gastos.length ||
                            readOnlyTotal ||
                            (!isLock && !canEditGasto)
                          }
                        >
                          <option value="">
                            {gastos.length ? "Seleccione concepto de gasto" : "Cargando..."}
                          </option>
                          {gastos.map((g) => {
                            const code = g.gasto ?? g.Name;
                            const label = g.concepto ?? g.U_SYP_CONCEPTO;
                            return (
                              <option key={g.code ?? g.Code ?? code} value={code}>
                                {code} — {label}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}

                    <div className={styles.num}>{total.toFixed(2)}</div>

                    <div>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => removeRow(i)}
                        aria-label={`Eliminar línea ${i + 1}`}
                        disabled={isLock || readOnlyTotal}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}

              {clase !== 'ARTICULO' && (
                <div className={`${styles.trow} ${styles.addRow}`}>
                  <div className={styles.addRowBtnWrap}>
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={addRow}
                      disabled={isLock || readOnlyTotal}
                    >
                      + Agregar línea de servicio
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {msg && <div className={msg.type === 'ok' ? styles.alertOk : styles.alertErr}>{msg.text}</div>}
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
            <button className={styles.secondary} onClick={onClose} disabled={sending}>Cerrar</button>

            {clase === 'ARTICULO' && (
              <button
                className={styles.primaryOutline}
                onClick={enviarCorreoArticulo}
                disabled={sending || isLock || readOnlyTotal}
              >
                {sending ? 'Enviando…' : 'Notificar creación de ítem'}
              </button>
            )}

            {/* ✅ Guardar borrador: si ya guardó gasto => NO se permite */}
            <button
              className={styles.primary}
              onClick={guardarBorrador}
              disabled={sending || readOnlyTotal}
              title={readOnlyTotal ? "Este borrador ya tiene gasto guardado" : ""}
            >
              {sending ? 'Guardando…' : (readOnlyTotal ? 'Solo lectura' : 'Guardar borrador')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
