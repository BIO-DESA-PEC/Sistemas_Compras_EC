'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  replaceOCDetail,
  updateOCState,
  requestOCApproval,
  getOCApprovalStatus,
  previewPrefacturaOC,
  updatePagoOC,
  getUserByEmail,
  uploadFacturaAdjuntoOC,
  listFacturaAdjuntosOC,
  downloadFacturaAdjuntoOC,
  getFacturaInfoOC,
  saveFacturaInfoOC,
  persistFacturaSnapshotOC,
  getProveedorSapByCardCode,
  validarFacturaDuplicadaOC,
  createOCDirecta,
  crearDraftNotaVentaOC
} from "@/app/lib/backend";
import { useSession } from "next-auth/react";
import ProveedorInfoModal from "@/components/ProveedorInfoModal";
import styles from "../orden.module.css";
import ProveedorPicker from "@/components/SupplierSelect";

const FacturaPreviewModal = dynamic(
  () => import('@/components/FacturaPreviewModal'),
  { ssr: false }
);

const IVA_PCT_DEFAULT = 15;

const EMPTY_ROW = {
  NumeroArticulo: "",
  Proveedor: "",
  ProveedorCardCode: "",
  FechaNecesaria: "",
  Cantidad: 0,
  Precio: 0,
  Descuento: 0,
  IvaPct: IVA_PCT_DEFAULT,
  Iva: 0,
  Total: 0,
  DiasPago: 0,
};

function num(v) {
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
}

function recalcRow(row) {
  if (row.__summary || row.__provLocked || row.__lockTotals) {
    const ivaPct = row.IvaPct === "" || row.IvaPct == null ? IVA_PCT_DEFAULT : num(row.IvaPct);
    const base = num(row.__base) || 0;
    const iva = num(row.Iva) || 0;
    const total = num(row.Total) || 0;
    return { ...row, IvaPct: ivaPct, __base: base, Iva: iva, Total: total };
  }

  const cant = num(row.Cantidad);
  const precio = num(row.Precio);
  const desc = num(row.Descuento);
  const base = Math.max(0, cant * precio - desc);
  const ivaPct = row.IvaPct === "" || row.IvaPct == null ? IVA_PCT_DEFAULT : num(row.IvaPct);
  const iva = +(base * (ivaPct / 100)).toFixed(2);
  const total = +(base + iva).toFixed(2);
  return { ...row, IvaPct: ivaPct, Iva: iva, Total: total, __base: +base.toFixed(2) };
}

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

export default function OCEditor({ oc, detalleInicial, modoDirecto = false }) {
  const router = useRouter();

  const ocId = oc?.IdOC ?? oc?.IdOc ?? oc?.idOc ?? null;
  const esOCDirecta = modoDirecto === true || String(oc?.Comentario || "").toUpperCase().includes("OC DIRECTA");
  const esAnticipo =
  String(oc?.Comentario || "").toUpperCase().includes("ANTICIPO") ||
  String(oc?.TipoOrigen || "").toUpperCase().includes("ANTICIPO") ||
  String(oc?.Origen || "").toUpperCase().includes("ANTICIPO");
  const tipoOC = useMemo(() => (oc?.Tipo || "").trim().toUpperCase(), [oc?.Tipo]);
  const isServicio = tipoOC === "SERVICIO";
  const isArticulo = tipoOC === "ARTICULO";

  const esMensual = useMemo(() => {
    return (
      String(oc?.EsMensual || "N").toUpperCase() === "Y" ||
      !!oc?.IdPlantillaMensual ||
      String(oc?.Comentario || "").toUpperCase().includes("CONSOLIDADA DESDE MENSUALES")
    );
  }, [oc]);

  const [factCardCode, setFactCardCode] = useState("");
  const [factProveedorNom, setFactProveedorNom] = useState("");
  const [provInfo, setProvInfo] = useState(null);
  const [detalle, setDetalle] = useState(
    (detalleInicial || []).map((d) =>
      recalcRow({
        ...d,
        ProveedorCardCode:
          d.ProveedorCardCode ??
          d.CodigoSAP ??
          d.CardCode ??
          "",
      })
    )
  );
  const [estado, setEstado] = useState(oc.Estado);

  const [showUploadFactura, setShowUploadFactura] = useState(false);
  const [adjuntosFactura, setAdjuntosFactura] = useState([]);
  const [upEst, setUpEst] = useState("");
  const [upPto, setUpPto] = useState("");
  const [upSec, setUpSec] = useState("");
  const [upFile, setUpFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [ocAprob, setOcAprob] = useState({
    existe: false,
    estado: null,
    nivel_actual: null,
    nivel_max: null,
    aprobadorId: null,
    aprobadorNombre: "",
    puedeFacturar: false,
  });

  const { data: session } = useSession();
  const [user, setUser] = useState(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [diasPago, setDiasPago] = useState(oc.DiasPago ?? 0);

  const [facturaCabecera, setFacturaCabecera] = useState(oc?.facturaCabecera || null);
  const [facturaDetalle, setFacturaDetalle] = useState(
    Array.isArray(oc?.facturaDetalle) ? oc.facturaDetalle : []
  );

  const [factTipo, setFactTipo] = useState(null);

  const editable = !(
    estado === "PROCESADA" ||
    estado === "ANULADA" ||
    (ocAprob?.existe && (ocAprob.estado === "PENDIENTE" || ocAprob.estado === "APROBADA"))
  );

  const enAprobacion = ocAprob?.existe && ocAprob.estado === "PENDIENTE";
  const aprobadaTotal = ocAprob?.existe && ocAprob.estado === "APROBADA";
  const estadoUI = enAprobacion
    ? "EN_APROBACION"
    : estado === "GENERADA" && aprobadaTotal
      ? "PENDIENTE_FACTURAR"
      : estado;

  const [priceMode, setPriceMode] = useState("LINEA");
  const [provTotalTarget, setProvTotalTarget] = useState("");
  const [provTotalMonto, setProvTotalMonto] = useState("");
  const [sort, setSort] = useState({ field: null, dir: "asc" });

  const [showFacturaForm, setShowFacturaForm] = useState(false);
  const [factMode, setFactMode] = useState("NORMAL");
  const [factEstable, setFactEstable] = useState("");
  const [factPtoEmi, setFactPtoEmi] = useState("");
  const [factSecu, setFactSecu] = useState("");
  const [sending, setSending] = useState(false);

  const refreshApprovalStatus = useCallback(async () => {
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
          puedeFacturar: !!st.puedeFacturar,
        });
      } else {
        setOcAprob({
          existe: false,
          estado: null,
          nivel_actual: null,
          nivel_max: null,
          aprobadorId: null,
          aprobadorNombre: "",
          puedeFacturar: st?.puedeFacturar ?? true,
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
        puedeFacturar: true,
      });
    }
  }, [oc.IdOC]);

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

  useEffect(() => {
    setDetalle(
      (detalleInicial || []).map((d) =>
        recalcRow({
          ...d,
          ProveedorCardCode:
            d.ProveedorCardCode ??
            d.CodigoSAP ??
            d.CardCode ??
            "",
        })
      )
    );

    setEstado(oc.Estado);
    setDiasPago(oc.DiasPago ?? 0);

    setFacturaCabecera(oc?.facturaCabecera || null);
    setFacturaDetalle(Array.isArray(oc?.facturaDetalle) ? oc.facturaDetalle : []);

    setPreviewOpen(false);
    setPreviewData(null);
    setShowFacturaForm(false);
    setFactTipo(null);

    setShowUploadFactura(false);
    setUpEst("");
    setUpPto("");
    setUpSec("");
    setUpFile(null);
    setAdjuntosFactura([]);

    refreshApprovalStatus();

    (async () => {
      try {
        if (!oc?.IdOC) return;
        const r = await getFacturaInfoOC(oc.IdOC);
        const info = r?.data || null;

        if (info) {
          setFactEstable(info.Establecimiento || "");
          setFactPtoEmi(info.PuntoEmision || "");
          setFactSecu(info.Secuencial || "");
          setFactCardCode(info.ProveedorCardCode || "");

          setUpEst(info.Establecimiento || "");
          setUpPto(info.PuntoEmision || "");
          setUpSec(info.Secuencial || "");
        }
      } catch (e) {
        console.warn("No pude cargar factura-info", e);
      }
    })();
  }, [oc?.IdOC, oc, detalleInicial, refreshApprovalStatus]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!oc?.IdOC) return;
        const a = await listFacturaAdjuntosOC(oc.IdOC);
        if (!alive) return;
        setAdjuntosFactura(Array.isArray(a) ? a : []);
      } catch (e) {
        if (!alive) return;
        setAdjuntosFactura([]);
      }
    })();
    return () => { alive = false; };
  }, [oc?.IdOC]);

  const totals = useMemo(() => {
    const sub = detalle.reduce((s, r) => s + num(r.__base), 0);
    const iva = detalle.reduce((s, r) => s + num(r.Iva), 0);
    const tot = detalle.reduce((s, r) => s + num(r.Total), 0);
    return { sub: +sub.toFixed(2), iva: +iva.toFixed(2), tot: +tot.toFixed(2) };
  }, [detalle]);

  const onChangeCell = useCallback((idx, field, value) => {
    setDetalle((prev) => {
      const rows = [...prev];
      const next = { ...rows[idx], [field]: value };
      if (["Cantidad", "Precio", "Descuento", "IvaPct"].includes(field)) {
        next[field] = value === "" ? 0 : num(value);
      }
      rows[idx] = recalcRow(next);
      return rows;
    });
  }, []);

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

  const sortBy = useCallback((field) => {
    if (!detalle.length) return;
    setDetalle((d) => {
      const dir = sort.field === field && sort.dir === "asc" ? "desc" : "asc";
      setSort({ field, dir });
      const factor = dir === "asc" ? 1 : -1;
      const norm = (v) => (v ?? "").toString().toUpperCase();
      return [...d].sort((a, b) => norm(a[field]).localeCompare(norm(b[field])) * factor);
    });
  }, [detalle.length, sort.field, sort.dir]);

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

      const idxs = rows
        .map((r, idx) => ({ r, idx }))
        .filter((x) => (x.r.Proveedor || "") === prov && !x.r.__summary)
        .map((x) => x.idx);

      const ivaSeed =
        (idxs.length ? rows[idxs.find((i) => rows[i].IvaPct != null)]?.IvaPct : undefined) ?? IVA_PCT_DEFAULT;
      const fechaSeed =
        (idxs.length
          ? rows[idxs.find((i) => (rows[i].FechaNecesaria || "").trim())]?.FechaNecesaria
          : undefined) || "";

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

      const sumIdx = rows.findIndex((r) => r.__summary && (r.Proveedor || "") === prov);
      const summary = makeSummaryRow({ proveedor: prov, total, ivaPct: ivaSeed, fecha: fechaSeed });
      if (sumIdx >= 0) rows[sumIdx] = summary;
      else rows.push(summary);

      return rows;
    });
  }, [editable, provTotalMonto, provTotalTarget]);

  const saveDetail = useCallback(async ({ autoApprove = false, tipoAprobacion = "JEFE" } = {}) => {
  try {
    if (esOCDirecta) {
  const usuarioId = user?.Id || user?.id || user?.IdUsuario || null;
  const correoUsuario = session?.user?.email || "";

  if (!usuarioId && !correoUsuario) {
    throw new Error("No se pudo identificar el usuario logueado.");
  }

  const resp = await createOCDirecta({
    IdUsuario: usuarioId,
    CorreoUsuario: correoUsuario,
    DepartamentoId: user?.DepartamentoId || null,
    Tipo: oc?.Tipo || "SERVICIO",
    FormaPago: oc?.FormaPago || "20",
    DiasPago: diasPago || 0,
    Comentario: "OC DIRECTA",
    detalle,
  });

  alert("OC directa creada correctamente.");
  router.push(`/ordenes/${resp.IdOC}`);
  return;
}

    await replaceOCDetail(oc.IdOC, detalle);

    const autoApproveFinal = esMensual ? true : autoApprove;

    const payload = autoApproveFinal
      ? { autoApprove: true }
      : { autoApprove: false, tipoAprobacion };

    const r = await requestOCApproval(oc.IdOC, payload);

    await refreshApprovalStatus();

    if (r?.estado === "APROBADA") {
      alert(
        autoApproveFinal
          ? "Detalle guardado. La OC quedó lista para facturar."
          : "Detalle guardado y OC aprobada."
      );
    } else if (r?.estado === "PENDIENTE") {
      alert(
        tipoAprobacion === "CEO"
          ? "Detalle guardado. Enviado a aprobación de CEO."
          : "Detalle guardado. Enviado a aprobación del Jefe."
      );
    } else {
      alert("Detalle guardado.");
    }

  } catch (e) {
    console.error(e);
    alert("Error guardando detalle: " + (e?.message || e));
  }
}, [
  detalle,
  oc.IdOC,
  oc?.Tipo,
  oc?.FormaPago,
  diasPago,
  refreshApprovalStatus,
  esMensual,
  esOCDirecta,
  user?.Id,
  user?.DepartamentoId,
  router
]);
  const getProveedorPrincipal = useCallback(() => {
    const fila = (detalle || []).find((x) => (x?.Proveedor || "").trim());
    return {
      nombre: fila?.Proveedor || "",
      cardCode: fila?.ProveedorCardCode || "",
    };
  }, [detalle]);

  const mandarAFacturar = useCallback(async (modo = "NORMAL") => {
    try {
      const st = await getOCApprovalStatus(oc.IdOC);

      if (st?.existe && st.estado !== "APROBADA") {
        alert("Para facturar, la OC debe estar aprobada.");
        return;
      }
    } catch {}

    setFactMode(modo);

    const t = String(oc?.Tipo || "").trim().toUpperCase();
    if (t !== "SERVICIO" && t !== "ARTICULO") {
      alert("La OC no tiene Tipo válido (SERVICIO/ARTICULO).");
      return;
    }

    setFactTipo(t);

    const prov = getProveedorPrincipal();

    if (!factProveedorNom && prov?.nombre) {
      setFactProveedorNom(prov.nombre);
    }
    if (!factCardCode && prov?.cardCode) {
      setFactCardCode(prov.cardCode);
    }

    const est = (factEstable || "").trim();
    const pto = (factPtoEmi || "").trim();
    const sec = (factSecu || "").trim();
    const card = (factCardCode || prov?.cardCode || "").trim();

    if (est && pto && sec) {
        const dup = await validarFacturaDuplicadaOC({
          establecimiento: est,
          puntoEmision: pto,
          secuencial: sec,
          excludeIdOC: oc.IdOC,
        });

        if (dup?.existe) {
          alert(dup?.mensaje || `La factura ${est}-${pto}-${sec} ya está registrada en otra OC.`);
          return;
        }
      setSending(true);
      try {
        const prev = await previewPrefacturaOC(oc.IdOC, {
          Establecimiento: est,
          PuntoEmision: pto,
          Secuencial: sec,
          CardCode: card || "",
        });

        if (prev && prev.error) throw new Error(prev.error);

        if (!prev || !prev.encontrado) {
          alert((prev && prev.mensaje) || "No se encontró el borrador en SAP.");
          return;
        }

        setPreviewData(prev);
        setFacturaCabecera(prev?.Cabecera || null);
        setFacturaDetalle(Array.isArray(prev?.Lineas) ? prev.Lineas : []);
        setPreviewOpen(true);
      } catch (e) {
        alert("Error en preview: " + (e?.message || e));
      } finally {
        setSending(false);
      }
      return;
    }

    setShowFacturaForm(true);
  }, [oc.IdOC, oc?.Tipo, factEstable, factPtoEmi, factSecu, factCardCode, factProveedorNom, getProveedorPrincipal]);

  const guardarPagoEncabezado = useCallback(async () => {
    try {
      await updatePagoOC(oc.IdOC, { DiasPago: diasPago });
      alert("Días de crédito (global) guardados.");
    } catch (e) {
      console.error(e);
      alert("Error guardando días de crédito.");
    }
  }, [diasPago, oc.IdOC]);

  const confirmarPrefactura = useCallback(async () => {
    const est = (factEstable || "").trim();
    const pto = (factPtoEmi || "").trim();
    const sec = (factSecu || "").trim();

    const prov = getProveedorPrincipal();
    const card = (factCardCode || prov?.cardCode || "").trim();
    const provNom = (factProveedorNom || prov?.nombre || "").trim();

    if (!est || !pto || !sec) {
      alert("Completa Establecimiento, Punto de Emisión y Secuencial.");
      return;
    }

    setSending(true);
    try {
      setShowFacturaForm(false);
      const dup = await validarFacturaDuplicadaOC({
        establecimiento: est,
        puntoEmision: pto,
        secuencial: sec,
        excludeIdOC: oc.IdOC,
      });

      if (dup?.existe) {
        alert(dup?.mensaje || `La factura ${est}-${pto}-${sec} ya está registrada en otra OC.`);
        return;
      }
      await saveFacturaInfoOC(oc.IdOC, {
        Establecimiento: est,
        PuntoEmision: pto,
        Secuencial: sec,
        ProveedorCardCode: card || "",
      });

      const prev = await previewPrefacturaOC(oc.IdOC, {
        Establecimiento: est,
        PuntoEmision: pto,
        Secuencial: sec,
        CardCode: card || "",
      });

      if (prev && prev.error) throw new Error(prev.error);

      if (!prev || !prev.encontrado) {
        alert((prev && prev.mensaje) || "No se encontró el borrador en SAP.");
        return;
      }

      setFactCardCode(prev?.Cabecera?.CardCode || card || "");
      setFactProveedorNom(prev?.Cabecera?.CardName || provNom || "");
      setPreviewData(prev);
      setFacturaCabecera(prev?.Cabecera || null);
      setFacturaDetalle(Array.isArray(prev?.Lineas) ? prev.Lineas : []);
      setPreviewOpen(true);
    } catch (e) {
      alert("Error en preview: " + (e && e.message ? e.message : String(e)));
    } finally {
      setSending(false);
    }
  }, [factEstable, factPtoEmi, factSecu, factCardCode, factProveedorNom, getProveedorPrincipal, oc.IdOC]);

  const handleUseDraft = useCallback(async () => {
  try {
    const docEntry = previewData?.DocEntry;
    const cab = previewData?.Cabecera;
    const lineas = previewData?.Lineas || [];

    if (!docEntry || !cab) {
      alert("No existe información del borrador para guardar.");
      return;
    }

    // 1) Guardar identificación de factura
    if (factEstable && factPtoEmi && factSecu) {
      await saveFacturaInfoOC(oc.IdOC, {
        Establecimiento: factEstable,
        PuntoEmision: factPtoEmi,
        Secuencial: factSecu,
        ProveedorCardCode: factCardCode || "",
      });
    }

    // 2) Persistir snapshot completo en HANA
    await persistFacturaSnapshotOC(oc.IdOC, docEntry, {
      Cabecera: cab,
      Lineas: lineas,
    });

    // 3) Marcar OC como procesada
    if (estado !== "PROCESADA") {
      await updateOCState(oc.IdOC, { estado: "PROCESADA" });
      setEstado("PROCESADA");
    }

    // 4) Reflejar en UI
    setFacturaCabecera(cab);
    setFacturaDetalle(lineas);

    alert("OC PROCESADA y factura asociada guardada correctamente.");
  } catch (e) {
    alert("Se encontró el borrador, pero hubo error al guardar: " + (e?.message || e));
  } finally {
    setPreviewOpen(false);
    setPreviewData(null);
  }
}, [estado, oc.IdOC, factEstable, factPtoEmi, factSecu, factCardCode, previewData]);

  const cancelarPrefactura = useCallback(() => {
    setShowFacturaForm(false);
    setFactTipo(null);
  }, []);

  const openUploadFactura = useCallback(() => {
    setUpEst((factEstable || "").trim());
    setUpPto((factPtoEmi || "").trim());
    setUpSec((factSecu || "").trim());
    setUpFile(null);
    setShowUploadFactura(true);
  }, [factEstable, factPtoEmi, factSecu]);

  const subirFactura = useCallback(async () => {
    if (!oc?.IdOC) return;

    const est = (upEst || "").trim();
    const pto = (upPto || "").trim();
    const sec = (upSec || "").trim();

    if (!est || !pto || !sec) {
      alert("Completa Establecimiento, Punto de Emisión y Secuencial.");
      return;
    }
    if (!upFile) {
      alert("Selecciona un archivo (PDF/XML).");
      return;
    }

    setUploading(true);
    try {
      const userEmail = session?.user?.email;

      await uploadFacturaAdjuntoOC(
        oc.IdOC,
        { Establecimiento: est, PuntoEmision: pto, Secuencial: sec, file: upFile },
        userEmail
      );

      alert("Factura subida a SharePoint ✅");

      setShowUploadFactura(false);
      setUpFile(null);

      const a = await listFacturaAdjuntosOC(oc.IdOC);
      setAdjuntosFactura(Array.isArray(a) ? a : []);
    } catch (e) {
      alert("Error subiendo factura: " + (e?.message || e));
    } finally {
      setUploading(false);
    }
  }, [oc?.IdOC, upEst, upPto, upSec, upFile, session?.user?.email]);

  const anularOC = useCallback(async () => {
    const motivo = prompt("Motivo de anulación (requerido):", "");
    if (!motivo) return;
    await updateOCState(oc.IdOC, { estado: "ANULADA", comentario: motivo });
    alert("OC anulada. La solicitud fue reabierta.");
    router.push("/solicitudes");
  }, [oc.IdOC, router]);

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
  }, [mandarAFacturar]);
const cargarProveedor = useCallback(async (cardCode) => {
  try {
    if (!cardCode) {
      alert("Esta línea no tiene código SAP.");
      return;
    }

    const data = await getProveedorSapByCardCode(cardCode);
    setProvInfo(data);
  } catch (e) {
    console.error("Error cargando proveedor SAP:", e);
    alert(`No se pudo cargar la información del proveedor: ${e?.message || e}`);
  }
}, []);
const yaFacturada =
  estado === "PROCESADA" ||
  !!facturaCabecera ||
  !!(facturaCabecera?.DocEntry);

const puedeFacturar =
  !yaFacturada &&
  (
    (!ocAprob?.existe) ||
    (ocAprob?.estado === "APROBADA")
  );

  const mandarAFacturarNotaVenta = useCallback(async () => {
  try {
    const st = await getOCApprovalStatus(oc.IdOC);

    if (st?.existe && st.estado !== "APROBADA") {
      alert("Para facturar, la OC debe estar aprobada.");
      return;
    }
  } catch {}

  setFactTipo("NOTA_VENTA");
  setFactMode("NOTA_VENTA");

  setPreviewData({
    IdOC: ocId,
    OcId: ocId,
    DocEntry: null,
    TipoOC: "SERVICIO",
    EsNotaVenta: true,
    Cabecera: {
      CardCode: "",
      CardName: "",
      DocDate: "",
      DocDueDate: "",
      Serie: "",
      PtoEmi: "",
      Secuencial: "",
      NumAtCard: "",
      NroAutorizacion: "",
      FechaAutorizacion: "",
      TipoDoc: "02",
      TipoEmision: "P",
      FormaPago: "20",
      TipoPago: "01",
      Comments: "BORRADOR NOTA DE VENTA",
      TotalDiscount: 0,
      DiscountPercent: 0,
    },
    Lineas: [
      {
        ItemDescription: "",
        Quantity: 1,
        UnitPrice: 0,
        DiscountPercent: 0,
        TaxCode: "",
        AccountCode: "",
        DatoAdicional: "",
        CostingCode: "",
        CostingCode2: "",
        CostingCode3: "",
        IdSustentoTributario: "01",
        ConceptoGasto: "",
      },
    ],
  });

  setPreviewOpen(true);
}, [oc.IdOC]);

  return (
    <div className={`${styles.ocTheme} ${styles.card}`}>
      <div className={styles.topSection}>
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
  {esOCDirecta && (
    <span className={`${styles.chip} ${styles.chipWarn}`}>
      OC DIRECTA
    </span>
  )}
  {esAnticipo && (
  <>
    <span className={`${styles.chip} ${styles.chipWarn}`}>
      ANTICIPO
    </span>

    <span className={`${styles.chip} ${styles.chipMuted}`}>
      ESP
    </span>
  </>
)}

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

              {ocAprob?.estado === "APROBADA" && ocAprob?.existe && (
                <span className={styles.chip}>
                  Aprobada (nivel {ocAprob.nivel_max})
                </span>
              )}

              {!ocAprob?.existe && (
  <span className={styles.chip}>
    {esMensual ? "Mensual autoaprobada" : "Sin aprobación"}
  </span>
)}
            </div>
          </div>

          <div className={styles.topRowRight}>
            {editable ? (
  <>
    <button className={styles.secondary} onClick={addRow}>
      Agregar línea
    </button>

    {esMensual ? (
      <button
        className={styles.primary}
        onClick={() => saveDetail({ autoApprove: true })}
        title="OC mensual: no requiere aprobación de Jefe ni CEO"
      >
        Guardar detalle
      </button>
    ) : (
      <>
        <button
          className={styles.primary}
          onClick={() => saveDetail({ autoApprove: false, tipoAprobacion: "JEFE" })}
        >
          Guardar detalle (enviar a Jefe)
        </button>

        <button
          className={styles.secondary}
          onClick={() => saveDetail({ autoApprove: false, tipoAprobacion: "CEO" })}
          title="Enviar a aprobación de CEO"
        >
          Enviar a CEO
        </button>

<button
  className={styles.secondary}
  onClick={() => saveDetail({ autoApprove: true })}
  title={
    esOCDirecta
      ? "OC directa: crea solicitud, preorden y OC"
      : "Sin aprobación, queda lista para facturar"
  }
>
  {esOCDirecta ? "Guardar OC directa" : "Guardar detalle (sin aprobación)"}
</button>      </>
    )}
  </>
) : (
  <span className={styles.muted}>Edición bloqueada</span>
)}

            {estado === "PROCESADA" && (
              <button
                className={styles.primary}
                onClick={openUploadFactura}
                title="Subir PDF/XML de la factura a SharePoint"
              >
                Subir factura
              </button>
            )}

            <button className={styles.warn} onClick={anularOC}>
              Anular
            </button>

            {puedeFacturar && (
  <>
    <button
      className={styles.ok}
      onClick={() => mandarAFacturar("NORMAL")}
      title="Buscar factura/preliminar existente en SAP"
    >
      Facturar
    </button>

    <button
      className={styles.secondary}
      onClick={mandarAFacturarNotaVenta}
      title="Crear borrador desde nota de venta"
    >
      Facturar nota de venta
    </button>
  </>
)}
          </div>
        </div>
      </div>

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
              <tr key={i} className={r.__summary ? styles.summaryRow : undefined}>
                <td className={styles.colArticulo}>
                  {r.__summary ? (
                    <span className={styles.inputReadonly}>{r.NumeroArticulo}</span>
                  ) : (
                    <input
                      disabled={!editable}
                      className={styles.input}
                      value={r.NumeroArticulo || ""}
                      onChange={(e) => onChangeCell(i, "NumeroArticulo", e.target.value)}
                      placeholder="Artículo..."
                    />
                  )}
                </td>

                <td className={styles.colProveedor}>
                {r.__summary || r.__provLocked ? (
                  <span className={styles.inputReadonly}>{r.Proveedor || "—"}</span>
                ) : (
                  <div className={styles.proveedorWrapper}>
                    <div style={{ width: "100%" }}>
                      <ProveedorPicker
                        disabled={!editable}
                        value={r.Proveedor || ""}
                        onChange={(nombre, proveedor) => {
                          setDetalle((prev) => {
                            const rows = [...prev];
                            rows[i] = recalcRow({
                              ...rows[i],
                              Proveedor: nombre || "",
                              ProveedorCardCode: proveedor?.CodigoSAP || "",
                              DiasPago:
                                typeof proveedor?.DiasCredito === "number"
                                  ? proveedor.DiasCredito
                                  : (rows[i]?.DiasPago ?? 0),
                            });
                            return rows;
                          });
                        }}
                      />
                    </div>

                    <button
                      className={styles.viewInfoBtn}
                      type="button"
                      title="Ver información del proveedor"
                      onClick={() => cargarProveedor(r.ProveedorCardCode)}
                    >
                      <span className={styles.eyeIcon}>👁️</span>
                    </button>
                  </div>
                )}
              </td>

                <td className={styles.colFecha}>
                  {r.__summary ? (
                    <span className={styles.inputReadonly}>{r.FechaNecesaria || "—"}</span>
                  ) : (
                    <input
                      disabled={!editable}
                      className={styles.input}
                      type="date"
                      value={r.FechaNecesaria || ""}
                      onChange={(e) => onChangeCell(i, "FechaNecesaria", e.target.value)}
                    />
                  )}
                </td>

                <td className={`${styles.colCant} ${styles.num}`}>
                  {r.__summary ? (
                    <span className={styles.inputReadonly}>—</span>
                  ) : (
                    <input
                      disabled={!editable}
                      className={`${styles.input} ${styles.inputNum}`}
                      type="number"
                      value={r.Cantidad ?? 0}
                      onChange={(e) => onChangeCell(i, "Cantidad", e.target.value)}
                    />
                  )}
                </td>

                <td className={`${styles.colPrecio} ${styles.num}`}>
                  {r.__summary || r.__provLocked ? (
                    <span className={styles.inputReadonly}>—</span>
                  ) : (
                    <input
                      disabled={!editable || priceMode === "TOTAL_X_PROV"}
                      className={`${styles.input} ${styles.inputNum}`}
                      type="number"
                      value={r.Precio ?? 0}
                      onChange={(e) => onChangeCell(i, "Precio", e.target.value)}
                      title={
                        priceMode === "TOTAL_X_PROV"
                          ? "Bloqueado por 'Total por proveedor'"
                          : ""
                      }
                    />
                  )}
                </td>

                <td className={`${styles.colDesc} ${styles.num}`}>
                  {r.__summary || r.__provLocked ? (
                    <span className={styles.inputReadonly}>—</span>
                  ) : (
                    <input
                      disabled={!editable}
                      className={`${styles.input} ${styles.inputNum}`}
                      type="number"
                      value={r.Descuento ?? 0}
                      onChange={(e) => onChangeCell(i, "Descuento", e.target.value)}
                    />
                  )}
                </td>

                <td className={`${styles.colIvaPct} ${styles.num}`}>
                  {r.__summary || r.__provLocked ? (
                    <span className={styles.inputReadonly}>—</span>
                  ) : (
                    <input
                      disabled={!editable}
                      className={`${styles.input} ${styles.inputNum}`}
                      type="number"
                      value={r.IvaPct ?? IVA_PCT_DEFAULT}
                      onChange={(e) => onChangeCell(i, "IvaPct", e.target.value)}
                    />
                  )}
                </td>

                <td className={`${styles.colDias} ${styles.num}`}>
                  {r.__summary ? (
                    <span className={styles.inputReadonly}>—</span>
                  ) : (
                    <input
                    disabled={true}
                    readOnly
                    className={`${styles.input} ${styles.inputNum}`}
                    type="number"
                    min={0}
                    value={r.DiasPago ?? 0}
                    title="Días de crédito tomados del proveedor"
                  />
                  )}
                </td>

                <td className={`${styles.colIva} ${styles.num}`}>
                  {r.__provLocked ? "—" : Number(r.Iva || 0).toFixed(2)}
                </td>

                <td className={`${styles.colTotal} ${styles.num}`}>
                  {r.__provLocked ? "—" : Number(r.Total || 0).toFixed(2)}
                </td>

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

      {facturaCabecera && (
        <div className={styles.card} style={{ marginTop: 14 }}>
          <div className={styles.sectionTitle}>Factura SAP asociada</div>

          <div className={styles.formGrid}>
            <div>
              <strong>Proveedor:</strong><br />
              <span>{facturaCabecera.CardName || "—"}</span>
            </div>

            <div>
              <strong>CardCode:</strong><br />
              <span>{facturaCabecera.CardCode || "—"}</span>
            </div>

            <div>
              <strong>Serie:</strong><br />
              <span>{facturaCabecera.Serie || "—"}</span>
            </div>

            <div>
              <strong>Punto emisión:</strong><br />
              <span>{facturaCabecera.PtoEmi || "—"}</span>
            </div>

            <div>
              <strong>Secuencial:</strong><br />
              <span>{facturaCabecera.Secuencial || "—"}</span>
            </div>

            <div>
              <strong>NumAtCard:</strong><br />
              <span>{facturaCabecera.NumAtCard || "—"}</span>
            </div>

            <div>
              <strong>Fecha documento:</strong><br />
              <span>{facturaCabecera.DocDate || "—"}</span>
            </div>

            <div>
              <strong>Fecha vencimiento:</strong><br />
              <span>{facturaCabecera.DocDueDate || "—"}</span>
            </div>

            <div>
              <strong>Autorización:</strong><br />
              <span>{facturaCabecera.NroAutorizacion || "—"}</span>
            </div>

            <div>
              <strong>Forma pago:</strong><br />
              <span>{facturaCabecera.FormaPago || "—"}</span>
            </div>

            <div>
              <strong>Tipo pago:</strong><br />
              <span>{facturaCabecera.TipoPago || "—"}</span>
            </div>

            <div>
              <strong>Total SAP:</strong><br />
              <span>
                {Number(facturaCabecera.DocTotal || 0).toLocaleString("es-EC", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            <div className={styles.gridFull}>
              <strong>Comentarios:</strong><br />
              <span>{facturaCabecera.Comments || "—"}</span>
            </div>
          </div>

          {!!facturaDetalle?.length && (
            <div className={styles.tableWrapper} style={{ marginTop: 12 }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Línea</th>
                    <th>Item</th>
                    <th>Descripción</th>
                    <th className={styles.num}>Cant.</th>
                    <th className={styles.num}>Precio</th>
                    <th className={styles.num}>Desc.</th>
                    <th>Impuesto</th>
                    <th>Gasto</th>
                    <th>Dato adicional</th>
                    <th className={styles.num}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {facturaDetalle.map((r, i) => (
                    <tr key={i}>
                      <td>{r.LineNum ?? i}</td>
                      <td>{r.ItemCode || "—"}</td>
                      <td>{r.ItemDescription || "—"}</td>
                      <td className={styles.num}>{Number(r.Quantity || 0).toFixed(2)}</td>
                      <td className={styles.num}>{Number(r.UnitPrice || 0).toFixed(2)}</td>
                      <td className={styles.num}>{Number(r.DiscountPercent || 0).toFixed(2)}</td>
                      <td>{r.TaxCode || "—"}</td>
                      <td>{r.ConceptoGasto || "—"}</td>
                      <td>{r.DatoAdicional || "—"}</td>
                      <td className={styles.num}>{Number(r.LineTotal || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className={styles.card} style={{ marginTop: 14 }}>
        <div className={styles.sectionTitle}>Adjuntos de factura</div>

        {!adjuntosFactura?.length ? (
          <p className={styles.muted}>No hay adjuntos cargados.</p>
        ) : (
          <div className={styles.attachList}>
            {adjuntosFactura.map((a) => (
              <div key={a.Id} className={styles.attachRow}>
                <div>
                  <div className={styles.attachName}>{a.FileName}</div>
                  <div className={styles.attachMeta}>
                    {a.CreatedAt ? `Subido: ${a.CreatedAt}` : ""}
                    {a.CreatedBy ? ` · por ${a.CreatedBy}` : ""}
                  </div>
                </div>

                <a
                  className={styles.ok}
                  href={downloadFacturaAdjuntoOC(oc.IdOC, a.Id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Descargar
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

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

      {ocAprob?.estado === "APROBADA" && ocAprob?.existe && (
        <p className={styles.note}>
          * Aprobada (nivel {ocAprob.nivel_max}/{ocAprob.nivel_max}). Ya no se puede modificar el detalle; puedes Facturar o Anular.
        </p>
      )}

      {!ocAprob?.existe && (
  <p className={styles.note}>
    {esMensual
      ? "* Esta OC proviene de una solicitud mensual, por lo tanto no requiere aprobación de Jefe ni CEO. Puedes facturar directamente."
      : "* Esta OC no tiene flujo de aprobación. Puedes facturar directamente."}
  </p>
)}

      {showUploadFactura && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalBox}>
            <h3 className={styles.modalTitle}>Subir factura (SharePoint)</h3>

            <div className={styles.formGrid}>
              <label>
                <span>Establecimiento</span>
                <input
                  value={upEst}
                  onChange={(e) => setUpEst(e.target.value)}
                  placeholder="001"
                  maxLength={10}
                />
              </label>

              <label>
                <span>Punto de emisión</span>
                <input
                  value={upPto}
                  onChange={(e) => setUpPto(e.target.value)}
                  placeholder="002"
                  maxLength={10}
                />
              </label>

              <label className={styles.gridFull}>
                <span>Secuencial</span>
                <input
                  value={upSec}
                  onChange={(e) => setUpSec(e.target.value)}
                  placeholder="00001234"
                  maxLength={20}
                />
              </label>

              <label className={styles.gridFull}>
                <span>Archivo (PDF/XML)</span>
                <input
                  type="file"
                  accept=".pdf,.xml,application/pdf,text/xml,application/xml"
                  onChange={(e) => setUpFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.secondary}
                onClick={() => setShowUploadFactura(false)}
                disabled={uploading}
              >
                Cancelar
              </button>
              <button
                className={styles.primary}
                onClick={subirFactura}
                disabled={uploading}
              >
                {uploading ? "Subiendo..." : "Subir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFacturaForm && factTipo === "SERVICIO" && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalBox}>
            <h3 className={styles.modalTitle}>
              {factMode === "SIN_APROB"
                ? "Facturar (sin aprobación) — SERVICIO"
                : "Datos para facturar — SERVICIO"}
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

      {showFacturaForm && factTipo === "ARTICULO" && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalBox}>
            <h3 className={styles.modalTitle}>
              {factMode === "SIN_APROB"
                ? "Facturar (sin aprobación) — ARTÍCULO"
                : "Datos para facturar — ARTÍCULO"}
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

      <FacturaPreviewModal
        open={previewOpen}
        data={previewData ? { ...previewData, IdOC: ocId, OcId: ocId, Tipo: tipoOC } : null}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewData(null);
        }}
        onUse={handleUseDraft}
        rolNombre={user?.RolNombre}
        rolId={user?.RolId}
        modo="ordenes"
      />
      {provInfo && (
        <ProveedorInfoModal
          proveedor={provInfo}
          onClose={() => setProvInfo(null)}
        />
      )}
    </div>
  );
}