'use client';

import { useState, useMemo, useEffect } from 'react';
import styles from './FacturaPreviewModal.module.css';
import SearchSelect from '@/components/SearchSelect';
import {
  persistFacturaSnapshotOC,
  updateFacturaSapDraft,
  updateOCState,
  crearDraftNotaVentaOC,
  updateComentarioDraftOC,
  crearBorradorManualOC
} from '@/app/lib/backend';
import ProveedorPicker from "@/components/SupplierSelect";

const IVA_OPTS = [
  { value: 'IVA_15', label: 'IVA 15%' },
  { value: 'IVA_0', label: 'IVA 0%' },
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

function str(v) {
  return (v ?? '').toString();
}

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
  const [borradorGuardadoOk, setBorradorGuardadoOk] = useState(false);
  const [finalizado, setFinalizado] = useState(false);
  const [yaTeniaGastoAlAbrir, setYaTeniaGastoAlAbrir] = useState(false);
  const [tipoVisual, setTipoVisual] = useState('SERVICIO');
  const esNotaVenta = !!data?.EsNotaVenta;
  const [puedeCrearBorradorManual, setPuedeCrearBorradorManual] = useState(false);
  const [payloadPendiente, setPayloadPendiente] = useState(null);
  const soloComentario = !!data?.SoloComentario;

const readOnlyTotal =
  ((modo === "facturas_sap") && (finalizado || yaTeniaGastoAlAbrir)) ||
  soloComentario;

const isLock = (modo === "facturas_sap") && !!lockSoloGasto && !readOnlyTotal;
  
  

  /* ===== DIMENSIONES ===== */
  const [dLinea, setDLinea] = useState([]);
  const [dRegion, setDRegion] = useState([]);
  const [correoAutoEnviado, setCorreoAutoEnviado] = useState(false);
  const [deptosCache, setDeptosCache] = useState({});

  /* ===== CABECERA ===== */
  const COMENTARIO_NV = "BORRADOR NOTA DE VENTA";
function normalizarComentarioNotaVenta(value = "") {
  const txt = String(value || "");

  const extra = txt
    .replace(COMENTARIO_NV, "")
    .replace(/^[-|:\s]+/, "")
    .trim();

  return extra ? `${COMENTARIO_NV} - ${extra}` : COMENTARIO_NV;
}
function construirReferencia(serie, ptoEmi, secuencial) {
  const s = String(serie || "").trim();
  const p = String(ptoEmi || "").trim();
  const sec = String(secuencial || "").trim();

  if (!s && !p && !sec) return "";
  return `${s}-${p}-${sec}`;
}
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
      BIO_FechaP: normDate(c.BIO_FechaP || c.U_BIO_FechaP || c.FechaPago || c.DocDueDate),
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
      DiscountPercent: Number(c.DiscountPercent ?? 0),
      TotalDiscount: Number(c.TotalDiscount ?? 0),
    };
  };

  const [cabecera, setCabecera] = useState(() => buildCabecera(data));
  const [empleadosCompras, setEmpleadosCompras] = useState([]);
  const [salesPersonCode, setSalesPersonCode] = useState("");
  const [descuentoTotalFactura, setDescuentoTotalFactura] = useState("");
  const [descuentoDistribuidoInfo, setDescuentoDistribuidoInfo] = useState(null);

  function limpiarComentarioDescuento(txt = "") {
    return String(txt || "")
      .replace(/\s*\|\s*Descuento total factura:\s*\$?\s*[\d.,]+/gi, "")
      .replace(/\n?Descuento total factura:\s*\$?\s*[\d.,]+/gi, "")
      .trim();
  }

  function normalizarComentarioBase(txt = "") {
    return limpiarComentarioDescuento(txt).trim();
  }


  function construirComentarioConDescuento(baseComments, monto) {
    const comentario = normalizarComentarioBase(baseComments || "");
    const valor = Number(monto || 0);

    return valor > 0
      ? `${comentario} | Descuento total factura: $${valor.toFixed(2)}`
      : comentario;
  }

  function setComentarioConDescuento(valor) {
    setCabecera((prev) => ({
      ...prev,
      Comments: construirComentarioConDescuento(prev.Comments, valor, clase),
    }));
  }

  function aplicarDescuentoTotalFactura(valorIngresado, opts = {}) {
    if (readOnlyTotal || isLock) return;

    const descuentoTotal = Math.max(0, n2(valorIngresado));
    const silent = !!opts.silent;

    const subtotalBase = rows.reduce(
      (acc, r) => acc + Math.max(0, n2(r.Cantidad) * n2(r.Precio)),
      0
    );

    if (subtotalBase <= 0) {
      setMsg({
        type: "err",
        text: "Debes ingresar cantidades y precios válidos antes de aplicar descuento total.",
      });
      return;
    }

    if (descuentoTotal > subtotalBase) {
      setMsg({
        type: "err",
        text: `El descuento no puede ser mayor al subtotal ($${subtotalBase.toFixed(2)})`,
      });
      return;
    }

    const pctCabecera =
      subtotalBase > 0 ? (descuentoTotal / subtotalBase) * 100 : 0;

    setDescuentoTotalFactura(descuentoTotal ? String(descuentoTotal) : "");

    // si el descuento va en cabecera, las líneas quedan en 0
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        Descuento: 0,
      }))
    );

    setCabecera((prev) => ({
      ...prev,
      TotalDiscount: +descuentoTotal.toFixed(2),
      DiscountPercent: +pctCabecera.toFixed(6),
      Comments: construirComentarioConDescuento(prev.Comments, descuentoTotal, clase),
    }));

    if (descuentoTotal > 0) {
      setDescuentoDistribuidoInfo({
        descuentoAplicado: +descuentoTotal.toFixed(2),
        lineasAfectadas: rows.length,
        subtotalBase,
      });
    } else {
      setDescuentoDistribuidoInfo(null);
    }

    if (!silent) {
      setMsg({
        type: "ok",
        text:
          descuentoTotal > 0
            ? `Descuento total en cabecera aplicado: $${descuentoTotal.toFixed(2)}`
            : "Se eliminó el descuento total de la factura.",
      });
    }
  }

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
    if (soloComentario && k !== "Comments") return;
    if (isLock || (readOnlyTotal && k !== "Comments")) return;

    setCabecera((p) => {
      const next = { ...p, [k]: v };

      if (["Serie", "PtoEmi", "Secuencial"].includes(k)) {
        next.NumAtCard = construirReferencia(
          next.Serie,
          next.PtoEmi,
          next.Secuencial
        );
      }

      return next;
    });
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

    const base = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://compras-back-ec-prod.onrender.com';
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

  const datoBase = String(rows[0]?.DatoAdicional || "").trim();

  setRows(prev => ([
    ...prev,
    {
      ItemCode: '',
      Descripcion: '',
      Cuenta: '',
      Cantidad: 1,
      Precio: 0,
      DatoAdicional: datoBase,
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

  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(id);
  }, [msg]);

  const removeRow = (ix) => {
    if (readOnlyTotal || isLock) return;
    setRows(prev => prev.filter((_, i) => i !== ix));
  };
  useEffect(() => {
  if (!open) return;

  const base =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "https://compras-back-ec-prod.onrender.com";

  fetch(`${base}/api/sap/empleados-compras`)
    .then(r => r.json())
    .then(data => {
      setEmpleadosCompras(Array.isArray(data) ? data : []);
    })
    .catch(console.error);
}, [open]);

  function handleSelectGasto(i, value) {
    const g = gastos.find(x =>
      x.gasto === value || x.Name === value || x.code === value || x.Code === value
    );

    if (!g) {
      updateRow(i, { ConceptoGasto: value });
      applyToEmpty("ConceptoGasto", value);
      return;
    }

    let concepto = g.concepto ?? g.U_SYP_CONCEPTO ?? '';
    if (!concepto) {
      const raw = String(g.gasto ?? g.Name ?? '');
      
      // extraer texto después del —
      const parts = raw.split('—');
      concepto = parts.length > 1 ? parts[1].trim() : raw;
    }

    let cuenta = g.cuenta ?? g.U_SYP_CUENTA ?? '';

      if (!cuenta) {
        const raw = String(g.gasto ?? g.Name ?? '');
        const match = raw.match(/(\d{6,})/);
        cuenta = match ? match[1] : '';
      }
    const gastoCod = g.gasto ?? g.Name ?? '';

    if (isLock) {
      updateRow(i, { ConceptoGasto: gastoCod });
      applyToEmpty("ConceptoGasto", gastoCod);
      return;
    }

    updateRow(i, { 
    ConceptoGasto: gastoCod, 
    Descripcion: concepto, 
    Cuenta: cuenta 
    });

  applyToEmpty("ConceptoGasto", gastoCod);
  applyToEmpty("Cuenta", cuenta);
  applyToEmpty("Descripcion", concepto);
  }

  /* =========================================================
     Effects
  ========================================================= */
  useEffect(() => {
  if (!open || !data) return;

  const tipo = (data?.TipoOC || '').toString().trim().toUpperCase();

  // Solo mostrar arriba como artículo si viene así,
  // pero internamente el modal sigue trabajando como SERVICIO
  if (tipo === 'ARTICULO' || tipo === 'ARTÍCULO') {
    setTipoVisual('ARTICULO');
  } else {
    setTipoVisual('SERVICIO');
  }

  // SIEMPRE mantener la lógica interna como SERVICIO
  setClase('SERVICIO');

  // NO enviar correo automático
  setCorreoAutoEnviado(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, data?.TipoOC]);

  useEffect(() => {
    if (!open) return;
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://compras-back-ec-prod.onrender.com';

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
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://compras-back-ec-prod.onrender.com';

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
        ln.U_SYP_CODIDTRD || data?.Cabecera?.IdSustentoTributario || '01'
      ),
      ConceptoGasto: String(ln.ConceptoGasto || ''),
    })));

    const totalDesc = Number(data?.Cabecera?.TotalDiscount ?? 0);
    const comentarioInicial = construirComentarioConDescuento(
      data?.Cabecera?.Comments || '',
      totalDesc,
      (data?.TipoOC || '').toString().trim().toUpperCase() === 'ARTICULO' ? 'ARTICULO' : 'SERVICIO'
    );

    setCabecera((prev) => ({
      ...prev,
      ...buildCabecera(data),
      DiscountPercent: Number(data?.Cabecera?.DiscountPercent ?? 0),
      TotalDiscount: totalDesc,
      NumAtCard: construirReferencia(
      buildCabecera(data).Serie,
      buildCabecera(data).PtoEmi,
      buildCabecera(data).Secuencial
    ),
    Comments: data?.Cabecera?.Comments || "",
        }));

    setFinalizado(false);
    setDescuentoTotalFactura(totalDesc > 0 ? String(totalDesc) : "");
    setDescuentoDistribuidoInfo(null);
  }, [data?.DocEntry]);

  useEffect(() => {
    if (!open || readOnlyTotal || isLock) return;

    const descuento = n2(descuentoTotalFactura);
    if (descuento < 0) return;

    const subtotalBase = rows.reduce(
      (acc, r) => acc + Math.max(0, n2(r.Cantidad) * n2(r.Precio)),
      0
    );

    if (subtotalBase <= 0) {
      setCabecera((prev) => ({
        ...prev,
        TotalDiscount: 0,
        DiscountPercent: 0,
      }));
      return;
    }

    if (descuento > subtotalBase) return;

    const pctCabecera =
      subtotalBase > 0 ? (descuento / subtotalBase) * 100 : 0;

    setCabecera((prev) => ({
      ...prev,
      TotalDiscount: +descuento.toFixed(2),
      DiscountPercent: +pctCabecera.toFixed(6),
    }));
  }, [
    open,
    readOnlyTotal,
    isLock,
    descuentoTotalFactura,
    rows.map(r => `${n2(r.Cantidad)}|${n2(r.Precio)}`).join("||")
  ]);

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

  const subtotalBrutoActual = useMemo(() => {
    return rows.reduce((acc, r) => {
      return acc + Math.max(0, n2(r.Cantidad) * n2(r.Precio));
    }, 0);
  }, [rows]);

  /* ===== TOTALES ===== */
  const resumen = useMemo(() => {
    let subtotalBruto = 0;
    let ivaBaseBruta = 0;

    for (const r of rows) {
      const base = Math.max(0, n2(r.Cantidad) * n2(r.Precio));
      subtotalBruto += base;
      if ((r.TaxCode || 'IVA_15') !== 'IVA_0') ivaBaseBruta += base;
    }

    const descuentoCabecera = n2(cabecera.TotalDiscount);
    const sub = Math.max(0, subtotalBruto - descuentoCabecera);

    const proporcionIva =
      subtotalBruto > 0 ? ivaBaseBruta / subtotalBruto : 0;

    const ivaBaseNeta = sub * proporcionIva;

    const iva = esNotaVenta
      ? 0
      : +(ivaBaseNeta * 0.15).toFixed(2);

    const total = esNotaVenta
      ? +sub.toFixed(2)
      : +(sub + iva).toFixed(2);

    return {
      sub: +sub.toFixed(2),
      iva,
      total,
    };
  }, [rows, cabecera.TotalDiscount]);

  async function enviarCorreoArticulo() {
    try {
      setSending(true);
      setMsg(null);

      const base = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://compras-back-ec-prod.onrender.com';
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
  if (sending) return;

  try {
    setSending(true);
    setMsg(null);

    const idOC = Number(data?.IdOC || data?.OcId || data?.idOC || 0);
    const docEntry = Number(data?.DocEntry || 0);

    if (!idOC) {
      throw new Error("No se encontró IdOC.");
    }

    const esCrearManual = !!data?.ModoCrearManual || !!data?.EsCrearManual;

    if (!esNotaVenta && !docEntry && !esCrearManual) {
      throw new Error("No se encontró DocEntry del borrador.");
    }

    const comentarioLimpio = String(cabecera.Comments || "").trim();
    if (!comentarioLimpio) {
      throw new Error("El comentario es obligatorio.");
    }


    const rowsActuales = (rows || []).map((r) => ({
      ...r,
      Cantidad: n2(r.Cantidad ?? r.Quantity ?? 1),
      Precio: n2(r.Precio ?? r.UnitPrice ?? 0),
      Descuento: n2(r.Descuento ?? r.DiscountPercent ?? 0),
      TaxCode: String(r.TaxCode || "IVA_15"),
      Cuenta: String(r.Cuenta || r.AccountCode || "").trim(),
      ItemCode: String(r.ItemCode || "").trim(),
      Descripcion: String(r.Descripcion || r.ItemDescription || "").trim(),
      DatoAdicional: String(r.DatoAdicional || "").trim(),
      CostingCode: String(r.CostingCode || "").trim(),
      CostingCode2: String(r.CostingCode2 || "").trim(),
      CostingCode3: String(r.CostingCode3 || "").trim(),
      IdSustentoTributario: String(r.IdSustentoTributario || "").trim(),
      ConceptoGasto: String(r.ConceptoGasto || "").trim(),
      LineNum: r.LineNum ?? null,
    }));

    if (!rowsActuales.length) {
      throw new Error("Debes tener al menos una línea.");
    }
    if (esNotaVenta) {
  const cardCode = String(cabecera.CardCode || "").trim().toUpperCase();
  const cardName = String(cabecera.CardName || "").trim();

  if (!cardCode) throw new Error("Ingresa el RUC/CardCode del proveedor.");
  if (!cardCode.startsWith("PL") && !cardCode.startsWith("PE")) {
    throw new Error("El CardCode debe iniciar con PL o PE + RUC.");
  }
  if (!cardName) throw new Error("Ingresa el nombre del proveedor.");

  const payloadNV = {
    Cabecera: {
      CardCode: cardCode,
      CardName: cardName,
      Comments: comentarioLimpio,
      DocDate: cabecera.DocDate || "",
      DocDueDate: cabecera.DocDueDate || cabecera.DocDate || "",
      BIO_FechaP: cabecera.BIO_FechaP || cabecera.DocDueDate || cabecera.DocDate || "",
      Serie: String(cabecera.Serie || "").trim(),
      PtoEmi: String(cabecera.PtoEmi || "").trim(),
      Secuencial: String(cabecera.Secuencial || "").trim(),
      NumAtCard: String(
        cabecera.NumAtCard ||
        `${cabecera.Serie}-${cabecera.PtoEmi}-${cabecera.Secuencial}`
      ).trim(),
      SalesPersonCode: Number(salesPersonCode || -1),
      TipoDoc: "02",
      TipoEmision: "P",
      FormaPago: String(cabecera.FormaPago || "20").trim(),
      TipoPago: String(cabecera.TipoPago || "01").trim(),
      DiscountPercent: 0,
      TotalDiscount: 0,
    },
    Lineas: rowsActuales.map((r) => {
    const cantidad = Math.max(1, n2(r.Cantidad));
    const precioUnitario = n2(r.Precio);
    const precioTotalLinea = +(cantidad * precioUnitario).toFixed(2);

    return {
      Descripcion: String(r.Descripcion || "SERVICIO").trim(),
      Cantidad: 1,
      Precio: precioTotalLinea,
      Descuento: n2(r.Descuento),
      DatoAdicional: String(r.DatoAdicional || "").trim(),
    };
  }),
  };

  const resp = await crearDraftNotaVentaOC(idOC, payloadNV);
  const docEntryNV = Number(resp.DocEntry);

await persistFacturaSnapshotOC(idOC, docEntryNV, {
  Cabecera: {
    ...payloadNV.Cabecera,
    DocEntry: docEntryNV,
    DocTotal: resumen.sub,
  },
  Lineas: payloadNV.Lineas.map((l, idx) => ({
    LineNum: idx,
    ItemCode: "",
    ItemDescription: l.Descripcion,
    Descripcion: l.Descripcion,
    Quantity: l.Cantidad,
    Cantidad: l.Cantidad,
    UnitPrice: l.Precio,
    Precio: l.Precio,
    DiscountPercent: 0,
    Descuento: 0,
    TaxCode: "IVA_0",
    AccountCode: "",
    Cuenta: "",
    DatoAdicional: l.DatoAdicional || "",
  })),
});
    if (!resp?.ok) {
      throw new Error(resp?.error || "No se pudo crear el borrador de nota de venta.");
    }

    await updateOCState(idOC, {
      estado: "PROCESADA",
      comentario: payloadNV.Cabecera.Comments,
    });

    alert(`✅ Nota de venta creada correctamente en SAP. Draft #${resp.DocEntry}`);

    if (typeof onClose === "function") onClose();
    window.location.reload();
    return;
}
    const subtotalBase = rowsActuales.reduce(
      (acc, r) => acc + Math.max(0, n2(r.Cantidad) * n2(r.Precio)),
      0
    );

    const totalDiscountNow = Math.max(0, n2(descuentoTotalFactura));

    if (totalDiscountNow > subtotalBase) {
      throw new Error(
        `El descuento no puede ser mayor al subtotal ($${subtotalBase.toFixed(2)}).`
      );
    }

    const discountPercentNow =
      subtotalBase > 0 ? (totalDiscountNow / subtotalBase) * 100 : 0;

    const commentsNow = construirComentarioConDescuento(
      cabecera.Comments,
      totalDiscountNow,
      clase
    );

    const hayDescuentoCabecera = totalDiscountNow > 0 || discountPercentNow > 0;

    const payload = {
      Cabecera: {
        CardCode: String(cabecera.CardCode || "").trim(),
        CardName: String(cabecera.CardName || "").trim(),
        Comments: commentsNow,
        DocDate: cabecera.DocDate || "",
        DocDueDate: cabecera.DocDueDate || "",
        FechaPago: cabecera.BIO_FechaP || cabecera.DocDueDate || cabecera.DocDate || "",
        BIO_FechaP: cabecera.BIO_FechaP || cabecera.DocDueDate || cabecera.DocDate || "",
        U_BIO_FechaP: cabecera.BIO_FechaP || cabecera.DocDueDate || cabecera.DocDate || "",
        Serie: String(cabecera.Serie || "").trim(),
        PtoEmi: String(cabecera.PtoEmi || "").trim(),
        Secuencial: String(cabecera.Secuencial || "").trim(),
        NumAtCard: String(cabecera.NumAtCard || "").trim(),
        SalesPersonCode: Number(salesPersonCode || -1),
        TipoDoc: String(cabecera.TipoDoc || "01").trim(),
        TipoEmision: String(cabecera.TipoEmision || "E").trim(),
        NroAutorizacion: String(cabecera.NroAutorizacion || "").trim(),
        FechaAutorizacion: cabecera.FechaAutorizacion || "",
        FormaPago: String(cabecera.FormaPago || "20").trim(),
        TipoPago: String(cabecera.TipoPago || "01").trim(),
        IdSustentoTributario: String(cabecera.IdSustentoTributario || "01").trim(),
        DiscountPercent: +discountPercentNow.toFixed(6),
        TotalDiscount: +totalDiscountNow.toFixed(2),
      },
      Lineas: rowsActuales.map((r, idx) => {
        const qty = Math.max(1, n2(r.Cantidad));
        const precio = n2(r.Precio);
        const descuentoLinea = hayDescuentoCabecera ? 0 : n2(r.Descuento);

        const baseLn = {
          LineNum: r.LineNum ?? idx,
          Descripcion: r.Descripcion || (clase === "ARTICULO" ? r.ItemCode : "SERVICIO"),
          ItemDescription: r.Descripcion || (clase === "ARTICULO" ? r.ItemCode : "SERVICIO"),
          Quantity: qty,
          Cantidad: qty,
          Precio: precio,
          UnitPrice: precio,
          DatoAdicional: r.DatoAdicional,
          Descuento: descuentoLinea,
          DiscountPercent: descuentoLinea,
          TaxCode: r.TaxCode || (precio === 0 ? "IVA_0" : "IVA_15"),
          CostingCode: r.CostingCode,
          CostingCode2: r.CostingCode2,
          CostingCode3: r.CostingCode3,
          IdSustentoTributario:
            r.IdSustentoTributario ||
            String(cabecera.IdSustentoTributario || "01").trim(),
          ConceptoGasto: r.ConceptoGasto,
        };

        if (clase === "SERVICIO") {
          return {
            ...baseLn,
            Cuenta: r.Cuenta,
            AccountCode: r.Cuenta,
            ItemCode: "",
          };
        }

        return {
          ...baseLn,
          Cuenta: "",
          AccountCode: "",
          ItemCode: "",
          ConceptoGasto: "",
        };
      }),
    };

    console.log("===== GUARDAR BORRADOR =====");
    console.log("idOC =", idOC);
    console.log("docEntry =", docEntry);
    console.log("payload =", JSON.parse(JSON.stringify(payload)));
    if (esCrearManual) {
      await crearNuevoBorradorManual(payload);
      return;
    }
    const sapResp = await updateFacturaSapDraft(idOC, docEntry, payload);
    console.log("RESPUESTA UPDATE SAP =", sapResp);

    const snapshotResp = await persistFacturaSnapshotOC(idOC, docEntry, payload);
    console.log("RESPUESTA SNAPSHOT =", snapshotResp);

    const estadoResp = await updateOCState(idOC, {
      estado: "PROCESADA",
      comentario: commentsNow,
    });
    console.log("RESPUESTA UPDATE ESTADO OC =", estadoResp);

    setCabecera((prev) => ({
      ...prev,
      Comments: commentsNow,
      DiscountPercent: +discountPercentNow.toFixed(6),
      TotalDiscount: +totalDiscountNow.toFixed(2),
    }));

    setRows((prev) =>
      prev.map((r, idx) => ({
        ...r,
        Descuento: hayDescuentoCabecera ? 0 : n2(r.Descuento),
        LineNum: r.LineNum ?? idx,
      }))
    );

    setBorradorGuardadoOk(true);
    setFinalizado(true);

    alert("✅ Borrador actualizado correctamente en SAP y OC procesada");

    setTimeout(() => {
      if (typeof onClose === "function") {
        onClose();
      }

      window.location.reload();
    }, 800);

    } catch (e) {
    console.error("ERROR guardarBorrador:", e);

    const textoError = String(e?.message || e || "").toLowerCase();

    const borradorNoExiste =
      textoError.includes("no existe") ||
      textoError.includes("not found") ||
      textoError.includes("404") ||
      textoError.includes("este preliminar ya no existe") ||
      textoError.includes("draft");

    if (borradorNoExiste) {
      setPayloadPendiente(payload);
      setPuedeCrearBorradorManual(true);

      setMsg({
        type: "err",
        text: "El borrador ya no existe en SAP. Puedes crear uno nuevo con los mismos datos del preview.",
      });
      return;
    }

    setMsg({
      type: "err",
      text: e?.message || "No se pudo guardar el borrador.",
    });
  } finally {
    setSending(false);
  }
}
async function crearNuevoBorradorManual(payloadManual = null) {
  if (sending) return;

  try {
    setSending(true);
    setMsg(null);

    const idOC = Number(data?.IdOC || data?.OcId || data?.idOC || 0);
    const payloadUsar = payloadManual || payloadPendiente;

    if (!idOC) throw new Error("No se encontró IdOC.");
    if (!payloadUsar) throw new Error("No hay datos para crear el nuevo borrador.");

    const resp = await crearBorradorManualOC(idOC, payloadUsar);

    const nuevoDocEntry = Number(resp?.DocEntry || 0);
    if (!nuevoDocEntry) {
      throw new Error("SAP creó el borrador pero no devolvió DocEntry.");
    }

    await persistFacturaSnapshotOC(idOC, nuevoDocEntry, {
      ...payloadUsar,
      Cabecera: {
        ...payloadUsar.Cabecera,
        DocEntry: nuevoDocEntry,
      },
    });

    await updateOCState(idOC, {
      estado: "PROCESADA",
      comentario: payloadUsar?.Cabecera?.Comments || "",
    });

    alert(`✅ Nuevo borrador creado correctamente en SAP. Draft #${nuevoDocEntry}`);

    setPuedeCrearBorradorManual(false);
    setPayloadPendiente(null);
    setBorradorGuardadoOk(true);
    setFinalizado(true);

    if (typeof onClose === "function") onClose();
    window.location.reload();

  } catch (e) {
    console.error("ERROR crearNuevoBorradorManual:", e);
    setMsg({
      type: "err",
      text: e?.message || "No se pudo crear el nuevo borrador.",
    });
  } finally {
    setSending(false);
  }
}
async function handleCerrar() {
  try {
    if (!borradorGuardadoOk) {
      if (typeof onClose === "function") {
        onClose();
      }
      return;
    }

    const confirmado = window.confirm(
      "¿Estás segura de que ya actualizaste todo en la factura? Si aceptas, la OC cambiará a PROCESADA."
    );

    if (!confirmado) {
      return;
    }

    const idOC = Number(data?.IdOC || data?.idOC || 0);
    if (!idOC) {
      throw new Error("No se encontró la OC.");
    }

    const comentario = String(cabecera?.Comments || "").trim();

    await updateOCState(idOC, {
      estado: "PROCESADA",
      comentario,
    });
    setBorradorGuardadoOk(true);
alert("✅ Borrador actualizado correctamente en SAP y OC procesada");

    setMsg({
      type: "ok",
      text: "OC marcada como PROCESADA.",
    });

    if (typeof onClose === "function") {
      onClose();
    }
  } catch (e) {
    console.error("ERROR handleCerrar:", e);
    setMsg({
      type: "err",
      text: e?.message || "No se pudo actualizar el estado al cerrar.",
    });
  }
}

  if (!open || !data) return null;


const rowTypeClass = clase === 'ARTICULO' ? styles.articleRow : styles.serviceRow;
async function actualizarSoloComentario() {
  try {
    setSending(true);
    setMsg(null);

    const idOC = Number(data?.IdOC || data?.OcId || data?.idOC || 0);
    const docEntry = Number(data?.DocEntry || data?.Cabecera?.DocEntry || 0);
    const comentario = String(cabecera.Comments || "").trim();

    if (!idOC) throw new Error("No se encontró IdOC.");
    if (!docEntry) throw new Error("No se encontró DocEntry del preliminar.");
    if (!comentario) throw new Error("El comentario es obligatorio.");

    await updateComentarioDraftOC(idOC, docEntry, comentario);

    alert("✅ Comentario actualizado correctamente en el preliminar SAP.");
    window.location.reload();

  } catch (e) {
    alert(e?.message || "No se pudo actualizar el comentario.");
  } finally {
    setSending(false);
  }
}
if (esNotaVenta) {
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalBox}>
        <div className={styles.modalHeader}>
          <div className={styles.titleRow}>
            <h3 className={styles.modalTitle}>
              Nota de venta · Crear preliminar
            </h3>

            <button
              type="button"
              className={styles.closeX}
              onClick={handleCerrar}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          <div className={styles.inlineBar}>
            <label className={styles.inlineField}>
              <span>Clase</span>
              <select value="SERVICIO" className={styles.select} disabled>
                <option value="SERVICIO">SERVICIO</option>
              </select>
            </label>
          </div>
        </div>

        <div className={styles.modalContent}>
          <div className={styles.section}>
            <h4>Cabecera</h4>

            <div className={styles.alertInfo}>
              Si el proveedor no existe en SAP, se creará con el CardCode ingresado.
              Debe ser <b>PL o PE + RUC</b>.
            </div>

            <div className={styles.formGrid}>
              <label>
  <span>Proveedor</span>

  <ProveedorPicker
    value={
      cabecera.CardCode
        ? `${cabecera.CardCode} - ${cabecera.CardName || "Proveedor"}`
        : ""
    }
    onChange={(nombre, proveedor) => {
      setCab("CardCode", proveedor?.CodigoSAP || `PL${proveedor?.IdProveedor || ""}`);
      setCab("CardName", proveedor?.NombreProveedor || nombre || "");
    }}
    title="Seleccionar proveedor"
  />
</label>
              <label>
  <span>Empleado de compras</span>

  <select
    value={salesPersonCode}
    onChange={(e) => setSalesPersonCode(e.target.value)}
  >
    <option value="">Seleccione...</option>

    {empleadosCompras.map(emp => (
      <option
        key={emp.SalesEmployeeCode}
        value={emp.SalesEmployeeCode}
      >
        {emp.SalesEmployeeName}
      </option>
    ))}
  </select>
</label>
              <label>
                <span>Fecha documento</span>
                <input
                  type="date"
                  value={cabecera.DocDate}
                  onChange={(e) => setCab("DocDate", e.target.value)}
                />
              </label>

              <label>
                <span>Fecha vencimiento</span>
                <input
                  type="date"
                  value={cabecera.DocDueDate}
                  onChange={(e) => setCab("DocDueDate", e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Fecha de pago</span>
                <input
                  type="date"
                  value={cabecera.BIO_FechaP}
                  onChange={e => setCab('BIO_FechaP', e.target.value)}
                  disabled={isLock || readOnlyTotal}
                  title={t(cabecera.BIO_FechaP)}
                />
              </label>

              <label>
                <span>Establecimiento</span>
                <input
                  value={cabecera.Serie}
                  onChange={(e) => setCab("Serie", e.target.value)}
                  placeholder="001"
                />
              </label>

              <label>
                <span>Punto emisión</span>
                <input
                  value={cabecera.PtoEmi}
                  onChange={(e) => setCab("PtoEmi", e.target.value)}
                  placeholder="001"
                />
              </label>

              <label>
                <span>Secuencial</span>
                <input
                  value={cabecera.Secuencial}
                  onChange={(e) => setCab("Secuencial", e.target.value)}
                  placeholder="000001383"
                />
              </label>

              <label>
                <span>Número referencia</span>
                <input
                  value={construirReferencia(cabecera.Serie, cabecera.PtoEmi, cabecera.Secuencial)}
                  readOnly
                  placeholder="001-001-000001383"
                />
              </label>

              <label>
                <span>Tipo emisión</span>
                <input value="P" disabled />
              </label>

              <label className={styles.gridFull}>
                <span>Comentario</span>
                <textarea
                  value={cabecera.Comments}
                  onChange={(e) => setCab("Comments", e.target.value)}
                  required
                />
              </label>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <h4>Detalle</h4>

              <button
                type="button"
                className={styles.secondary}
                onClick={addRow}
              >
                + Línea
              </button>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Cantidad</th>
                    <th>Precio</th>
                    <th>Desc.</th>
                    <th>Dato adicional</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          value={r.Descripcion}
                          onChange={(e) =>
                            updateRow(i, { Descripcion: e.target.value })
                          }
                          placeholder="Descripción"
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          min="1"
                          value={r.Cantidad}
                          onChange={(e) =>
                            updateRow(i, { Cantidad: e.target.value })
                          }
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={r.Precio}
                          onChange={(e) =>
                            updateRow(i, { Precio: e.target.value })
                          }
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={r.Descuento}
                          onChange={(e) =>
                            updateRow(i, { Descuento: e.target.value })
                          }
                        />
                      </td>

                      <td>
                        <input
                          value={r.DatoAdicional}
                          onChange={(e) =>
                            updateRow(i, { DatoAdicional: e.target.value })
                          }
                          placeholder="Dato adicional"
                        />
                      </td>

                      <td>
                        <button
                          type="button"
                          className={styles.danger}
                          onClick={() => removeRow(i)}
                          disabled={rows.length <= 1}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className={styles.footerTotals}>
          <div>Subtotal: <b>${resumen.sub.toFixed(2)}</b></div>
          <div>IVA: <b>$0.00</b></div>
          <div>Total: <b>${resumen.sub.toFixed(2)}</b></div>
        </div>

        {msg && (
          <div className={msg.type === "err" ? styles.alertError : styles.alertOk}>
            {msg.text}
          </div>
        )}

        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={handleCerrar}
            disabled={sending}
          >
            Cancelar
          </button>

          <button
            type="button"
            className={styles.primary}
            onClick={guardarBorrador}
            disabled={sending}
          >
            {sending ? "Guardando..." : "Crear preliminar nota de venta"}
          </button>
        </div>
      </div>
    </div>
  );
}

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
              onClick={handleCerrar}
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

            <label className={styles.inlineField}>
              <span>Descuento total factura</span>

              <div className={styles.discountBox}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={descuentoTotalFactura}
                  onChange={(e) => setDescuentoTotalFactura(e.target.value)}
                  disabled={readOnlyTotal || isLock}
                  className={styles.discountInput}
                  placeholder="0.00"
                  title="Ingrese el descuento total de la factura"
                />

                <button
                  type="button"
                  className={styles.discountApplyBtn}
                  onClick={() => aplicarDescuentoTotalFactura(descuentoTotalFactura)}
                  disabled={readOnlyTotal || isLock}
                  title="Aplicar descuento total en cabecera"
                >
                  Aplicar
                </button>
              </div>

              {descuentoDistribuidoInfo && (
                <small className={styles.discountHelp}>
                  Se aplicó ${descuentoDistribuidoInfo.descuentoAplicado.toFixed(2)} en cabecera sobre {descuentoDistribuidoInfo.lineasAfectadas} línea{descuentoDistribuidoInfo.lineasAfectadas === 1 ? "" : "s"}.
                </small>
              )}

              <small className={styles.discountSubnote}>
                Máximo permitido según subtotal actual: ${subtotalBrutoActual.toFixed(2)}
              </small>
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
            <span>Empleado de compras</span>

            <select
              value={salesPersonCode}
              onChange={(e) => setSalesPersonCode(e.target.value)}
            >
              <option value="">Seleccione...</option>

              {empleadosCompras.map((emp) => (
                <option
                  key={emp.SalesEmployeeCode}
                  value={emp.SalesEmployeeCode}
                >
                  {emp.SalesEmployeeName}
                </option>
              ))}
            </select>
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
              <span>Fecha de pago</span>
              <input
                type="date"
                value={cabecera.BIO_FechaP}
                onChange={e => setCab('BIO_FechaP', e.target.value)}
                disabled={isLock || readOnlyTotal}
                title={t(cabecera.BIO_FechaP)}
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
                disabled={isLock}
              />
            </label>
          </div>

          {gastosError && <div className={styles.alertErr}>{gastosError}</div>}

          <div className={styles.tableCard}>
            <div className={styles.tscroll}>
              <div className={styles.tableGrid}>
                <div className={`${styles.theadRow} ${rowTypeClass}`}>
                  <div className={`${styles.idx} ${styles.stickyHead}`}>#</div>

                  {false ? (
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

                      {tipoVisual === 'ARTICULO' ? (
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
                          step="0.000001"
                          className={styles.numInp}
                          value={ln.Descuento}
                          onChange={e => updateRow(i, { Descuento: e.target.value })}
                          disabled={isLock || readOnlyTotal || Number(cabecera.TotalDiscount || 0) > 0}
                          title={
                            Number(cabecera.TotalDiscount || 0) > 0
                              ? 'Con descuento total en cabecera, el descuento por línea queda en 0'
                              : t(ln.Descuento)
                          }
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
                      title={tipoVisual === 'ARTICULO'
                        ? 'Agregar una nueva línea de artículo'
                        : 'Agregar una nueva línea de servicio'}
                    >
                      {tipoVisual === 'ARTICULO'
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
    onClick={handleCerrar}
    disabled={sending}
  >
    Cerrar
  </button>

  {soloComentario ? (
  <button
    className={styles.primary}
    onClick={actualizarSoloComentario}
    disabled={sending}
  >
    {sending ? "Actualizando..." : "Actualizar comentario"}
  </button>
) : (
  <>
    <button
      className={styles.primary}
      onClick={guardarBorrador}
      disabled={sending || readOnlyTotal}
    >
      {sending ? "Guardando…" : (readOnlyTotal ? "Solo lectura" : "Guardar borrador")}
    </button>

    {puedeCrearBorradorManual && (
      <button
        className={styles.primary}
        onClick={crearNuevoBorradorManual}
        disabled={sending}
      >
        {sending ? "Creando…" : "Crear nuevo borrador"}
      </button>
    )}
  </>
)}
</div>
        </div>
      </div>
    </div>
  );
}