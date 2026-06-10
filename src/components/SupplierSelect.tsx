"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CountryDropdown } from "react-country-region-selector";
import styles from "./supplier.module.css";

/* ========= Tipos ========= */
export interface Proveedor {
  CodigoSAP?: string;
  IdProveedor: string;
  NombreProveedor: string;
  EmailAddress?: string | null;
  Phone1?: string | null;
  Address?: string | null;
  Country?: string | null;
  GroupCode?: number;
  PriceListNum?: number;
  SalesPersonCode?: number;
  U_SYP_BPTD?: string;
  U_SYP_CONTABILIDAD?: string;
  U_SYP_PARTREL?: string;
  U_SYP_TCONTRIB?: string;
  U_SYP_ORIGEN_INGRESO?: string;
  U_SYP_TIPOPAGO?: string;
  U_SYP_FPAGO?: string;
  U_SYP_PAISPAGO?: string;
  PayTermsGrpCode?: number;
  TipoFacturacion?: string;
  DiasCredito?: number;
  Comentarios?: string;

  // bancarios
  BankCode?: string;
  BankAccountNo?: string;
  BankAccountName?: string;
  BankIdType?: string;
}

interface ProveedorPickerProps {
  value?: string;
  onChange?: (nombre: string, proveedor?: Proveedor) => void;
  disabled?: boolean;
  title?: string;
}

const API_URL = "https://compras-back-ec-prod.onrender.com/api/proveedores";

/* ========= Type guards ========= */
function isProveedor(obj: unknown): obj is Proveedor {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return typeof o.IdProveedor === "string" && typeof o.NombreProveedor === "string";
}

function isProveedorArray(obj: unknown): obj is Proveedor[] {
  return Array.isArray(obj) && obj.every(isProveedor);
}

function normalizeProveedorList(raw: unknown): Proveedor[] {
  if (isProveedorArray(raw)) return raw;

  if (
    typeof raw === "object" &&
    raw !== null &&
    "items" in raw &&
    isProveedorArray((raw as { items: unknown }).items)
  ) {
    return (raw as { items: Proveedor[] }).items;
  }

  return [];
}

/* ========= Portal simple ========= */
function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

/* ========= Componente principal: Selector Proveedor ========= */
export default function ProveedorPicker({ value, onChange, disabled, title }: ProveedorPickerProps) {
  const [open, setOpen] = useState(false);

  const [q, setQ] = useState("");
  const [items, setItems] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);

  const wrapRef = useRef<HTMLDivElement | null>(null);

  // ✅ fetch con debounce
  useEffect(() => {
    let alive = true;

    const t = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const url = q.trim().length > 0 ? `${API_URL}?q=${encodeURIComponent(q.trim())}` : API_URL;

        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const raw: unknown = await res.json();
        const list = normalizeProveedorList(raw);

        if (alive) setItems(list);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error desconocido";
        if (alive) {
          setItems([]);
          setError(msg);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }, 200);

    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [q]);

  // ✅ cerrar con ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const selectedLabel = useMemo(() => value ?? "", [value]);

  const pick = (it: Proveedor) => {
    onChange?.(it.NombreProveedor, it);
    setOpen(false);
  };

  return (
    <div className={styles.combo} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.input} ${styles.comboToggle}`}
        disabled={disabled}
        onClick={() => setOpen(true)}
        title={title || "Seleccionar proveedor"}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {selectedLabel || "Seleccionar proveedor"}
        <span className={styles.chev} aria-hidden>
          ▾
        </span>
      </button>

      {/* ✅ MODAL SELECTOR */}
      {open && (
        <ModalPortal>
          <div
            className={styles.pickerOverlay}
            role="dialog"
            aria-modal="true"
            onMouseDown={() => setOpen(false)}
          >
            <div className={styles.pickerModal} onMouseDown={(e) => e.stopPropagation()}>
              <div className={styles.pickerHeader}>
                <div>
                  <div className={styles.pickerTitle}>Seleccionar proveedor</div>
                  <div className={styles.pickerSub}>Busca por nombre, RUC o código SAP</div>
                </div>

                <button
                  type="button"
                  className={styles.pickerClose}
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  title="Cerrar"
                >
                  ✕
                </button>
              </div>

              <div className={styles.pickerSearchWrap}>
                <input
                  autoFocus
                  className={styles.pickerSearch}
                  placeholder="Buscar proveedor…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <div className={styles.pickerList}>
                {loading && <div className={styles.state}>Cargando…</div>}

                {!loading && error && (
                  <div className={styles.state}>Error al cargar proveedores ({error})</div>
                )}

                {!loading && !error && items.length === 0 && (
                  <div className={styles.state}>Sin resultados</div>
                )}

                {!loading &&
                  !error &&
                  items.map((it) => (
                    <button
                      type="button"
                      key={`${it.CodigoSAP ?? ""}-${it.IdProveedor}`}
                      className={styles.pickerItem}
                      onClick={() => {
                        pick(it);
                        setQ("");
                      }}
                    >
                      <div className={styles.pickerMain}>
                        <div className={styles.pickerName}>{it.NombreProveedor}</div>
                        <div className={styles.pickerMeta}>
                          <span>{it.IdProveedor}</span>
                          <span className={styles.dot}>•</span>
                          <span>{it.CodigoSAP || "—"}</span>
                        </div>
                      </div>

                      <div className={styles.pickerSide}>{it.EmailAddress || "—"}</div>
                    </button>
                  ))}
              </div>

              <div className={styles.pickerFooter}>
                <button type="button" className={styles.btnGhost} onClick={() => setOpen(false)}>
                  Cancelar
                </button>

                <button
  type="button"
  className={styles.btnPrimary}
  onClick={() => {
    setOpen(false);
    setShowCreate(true);
  }}
>
  <span aria-hidden>➕</span>
  Nuevo proveedor
</button>

              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ✅ Modal crear proveedor (tu mismo, intacto) */}
      {showCreate && (
        <CreateProveedorModal
          onClose={() => setShowCreate(false)}
          onCreated={(nombre) => {
            onChange?.(nombre);
            setShowCreate(false);
            setQ("");
          }}
        />
      )}
    </div>
  );
}

/* ========= Modal de creación ========= */

type CreateForm = Required<
  Pick<
    Proveedor,
    | "NombreProveedor"
    | "IdProveedor"
    | "EmailAddress"
    | "Phone1"
    | "Address"
    | "Country"
    | "GroupCode"
    | "PriceListNum"
    | "SalesPersonCode"
    | "U_SYP_BPTD"
    | "U_SYP_CONTABILIDAD"
    | "U_SYP_PARTREL"
    | "U_SYP_TCONTRIB"
    | "U_SYP_ORIGEN_INGRESO"
    | "U_SYP_TIPOPAGO"
    | "U_SYP_FPAGO"
    | "U_SYP_PAISPAGO"
  >
> & {
  TipoFacturacion: string;
  DiasCredito: string;
  Comentarios: string;
  PayTermsGrpCode: string;

  BankCode: string;
  BankAccountNo: string;
  BankAccountName: string;
  BankIdType: string;
};

interface CreateProveedorModalProps {
  onClose: () => void;
  onCreated?: (nombre: string) => void;
}

function CreateProveedorModal({ onClose, onCreated }: CreateProveedorModalProps) {
  const [form, setForm] = useState<CreateForm>({
    NombreProveedor: "",
    IdProveedor: "",
    EmailAddress: "",
    Phone1: "",
    Address: "",
    Country: "EC",
    GroupCode: 101,
    PriceListNum: 1,
    SalesPersonCode: 5,
    U_SYP_BPTD: "C",
    U_SYP_CONTABILIDAD: "SI",
    U_SYP_PARTREL: "NO",
    U_SYP_TCONTRIB: "10",
    U_SYP_ORIGEN_INGRESO: "NA",
    U_SYP_TIPOPAGO: "01",
    U_SYP_FPAGO: "20",
    U_SYP_PAISPAGO: "NA",

    TipoFacturacion: "CONTADO",
    DiasCredito: "0",
    Comentarios: "",
    PayTermsGrpCode: "",

    BankCode: "",
    BankAccountNo: "",
    BankAccountName: "",
    BankIdType: "CEDULA",
  });

  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [isPassport, setIsPassport] = useState(false);

  type PaymentTerm = { GroupNum: number; PymntGroup: string; ExtraDays: number };
  const [terms, setTerms] = useState<PaymentTerm[]>([]);
  const [termsError, setTermsError] = useState<string | null>(null);

  type BankOption = { BankCode: string; BankName: string; Country: string | null };
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [bankError, setBankError] = useState<string | null>(null);

  const [certFile, setCertFile] = useState<File | null>(null);

  useEffect(() => {
    const loadTerms = async () => {
      try {
        setTermsError(null);
        const res = await fetch(`${API_URL}/condiciones-pago`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: PaymentTerm[] = await res.json();
        setTerms(json || []);
      } catch (e) {
        console.error("[Proveedor] error cargando OCTG", e);
        setTermsError("No se pudieron cargar las condiciones de pago");
      }
    };
    loadTerms();
  }, []);

  useEffect(() => {
    const loadBanks = async () => {
      try {
        setBankError(null);
        const res = await fetch(`${API_URL}/bancos`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: BankOption[] = await res.json();
        setBanks(json || []);
      } catch (e) {
        console.error("[Proveedor] error cargando bancos", e);
        setBankError("No se pudieron cargar los bancos");
      }
    };
    loadBanks();
  }, []);

  const set = <K extends keyof CreateForm>(k: K, v: CreateForm[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  // 🔥 Valida CI/RUC y autollenar nombre (si NO es pasaporte)
  const handleIdProveedor = async (value: string) => {
  set("IdProveedor", value);
  setErr("");

  if (!value.trim()) {
    set("NombreProveedor", "");
    return;
  }

  if (isPassport) {
    set("U_SYP_BPTD", "P");
    return;
  }

  const num = value.trim();
  let tipoDoc: "C" | "R" | null = null;

  if (/^\d{10}$/.test(num)) {
    tipoDoc = "C";
  } else if (/^\d{13}$/.test(num)) {
    tipoDoc = "R";
  } else {
    return;
  }

  try {
    const url = `${API_URL}/validar-id?numero=${encodeURIComponent(num)}&tipo=${tipoDoc}`;
    const res = await fetch(url);
    const json: any = await res.json().catch(() => null);

    if (!res.ok || !json) {
      const msg =
        (json && typeof json.error === "string" && json.error) ||
        `Error al validar identificación (HTTP ${res.status})`;
      setErr(msg);
      return;
    }

    const root = "ok" in json ? json.data : json;

    if (!root) {
      setErr("No se recibió información de la identificación");
      return;
    }

    let nombreDetectado = "";

    if (tipoDoc === "C") {
      const r =
        root?.data?.response ||
        root?.response ||
        root?.data?.data?.response ||
        null;

      if (r) {
        const nombreCompleto =
          (r.nombreCompleto as string) ||
          `${r.nombres || ""} ${r.apellidos || ""}`.trim();

        nombreDetectado = (nombreCompleto || "").trim();
      }
    } else {
      const mainArr =
        root?.data?.data?.main ||
        root?.data?.main ||
        root?.main ||
        [];

      const main = Array.isArray(mainArr) ? mainArr[0] : mainArr;

      if (main) {
        nombreDetectado =
          (main.razonSocial as string) ||
          (main.razon_social as string) ||
          (main.nombreFantasiaComercial as string) ||
          (main.nombre_fantasia_comercial as string) ||
          "";

        nombreDetectado = (nombreDetectado || "").trim();
      }
    }

    if (nombreDetectado) {
      set("NombreProveedor", nombreDetectado);
      set("U_SYP_BPTD", tipoDoc);
      setErr("");
    } else {
      setErr("No se pudo obtener el nombre desde la API");
    }
  } catch (e) {
    console.error("[Proveedor] error validar-id", e);
    setErr("Error al validar identificación");
  }
};

  const submit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setErr("");

    if (!form.NombreProveedor.trim() || !form.IdProveedor.trim()) {
      setErr("Nombre y RUC/CI son obligatorios");
      return;
    }

    const payload: Proveedor = {
      ...form,
      GroupCode: form.GroupCode === 102 ? 102 : 101,
      PriceListNum: Number(form.PriceListNum) || 1,
      SalesPersonCode: Number(form.SalesPersonCode) || 5,
      TipoFacturacion: form.TipoFacturacion || undefined,
      DiasCredito: form.DiasCredito.trim() === "" ? undefined : Number(form.DiasCredito),
      Comentarios: form.Comentarios || undefined,
      PayTermsGrpCode: form.PayTermsGrpCode.trim() === "" ? undefined : Number(form.PayTermsGrpCode),
      BankCode: form.BankCode || undefined,
      BankAccountNo: form.BankAccountNo || undefined,
      BankAccountName: form.BankAccountName || undefined,
      BankIdType: form.BankIdType || undefined,
    };

    setSending(true);
    try {
      let res: Response;

      if (certFile) {
        const fd = new FormData();
        fd.append("data", JSON.stringify(payload));
        fd.append("bank_cert", certFile);

        res = await fetch(API_URL, { method: "POST", body: fd });
      } else {
        res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const raw: unknown = await res.json();

      if (!res.ok) {
        const msg =
          typeof raw === "object" &&
          raw !== null &&
          "error" in raw &&
          typeof (raw as { error: unknown }).error === "string"
            ? (raw as { error: string }).error
            : `Error ${res.status} al crear proveedor`;
        throw new Error(msg);
      }

      const created = isProveedor(raw) ? raw : undefined;
      const nombre = created?.NombreProveedor ?? form.NombreProveedor;
      onCreated?.(nombre);
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : "Error al crear proveedor";
      setErr(msg);
    } finally {
      setSending(false);
    }
  };

  const stop = (e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation();

  const TCONTRIB_OPTIONS = [
    { value: "01", label: "01 - Agente de retención" },
    { value: "02", label: "02 - Artesano" },
    { value: "03", label: "03 - Contribuyente" },
    { value: "04", label: "04 - Contribuyente (Exportador habitual)" },
    { value: "05", label: "05 - Contribuyente especial" },
    { value: "06", label: "06 - Empresa Pública" },
    { value: "07", label: "07 - Extranjero" },
    { value: "08", label: "08 - Fundación sin Fines de Lucro" },
    { value: "09", label: "09 - (Otro)" },
    { value: "99", label: "99 - Ninguno" },
    { value: "10", label: "10 - Local" },
    { value: "11", label: "11 - MicroEmpresa" },
    { value: "12", label: "12 - Persona Natural (NO obligada a llevar contabilidad)" },
    { value: "13", label: "13 - Persona Natural (Obligada a llevar contabilidad)" },
    { value: "14", label: "14 - PN NO obligada (Arriendo Inmuebles)" },
    { value: "15", label: "15 - PN NO obligada (Hon. Profesionales)" },
    { value: "16", label: "16 - PN NO obligada (Liq. Compra o Servicio)" },
    { value: "17", label: "17 - RIMPE (Emprendedores)" },
    { value: "18", label: "18 - RIMPE Negocio Popular" },
    { value: "19", label: "19 - RISE" },
  ];

  const FPAGO_OPTIONS = [
    { value: "01", label: "01 - SIN UTILIZ. DEL SISTEMA FINAN" },
    { value: "02", label: "02 - CHEQUE PROPIO" },
    { value: "03", label: "03 - CHEQUE CERTIFICADO" },
    { value: "04", label: "04 - CHEQUE DE GERENCIA" },
    { value: "05", label: "05 - CHEQUE DEL EXTERIOR" },
    { value: "06", label: "06 - DÉBITO DE CUENTA" },
    { value: "07", label: "07 - TRANSFERENCIA PROPIO BANCO" },
    { value: "08", label: "08 - TRANSF. OTRO BCO NACIONAL" },
    { value: "09", label: "09 - TRANSFERENCIA  BANCO EXTERIOR" },
    { value: "10", label: "10 - TARJETA DE CRÉDITO NACIONAL" },
    { value: "11", label: "11 - TARJETA DE CRÉDITO INTERNAC." },
    { value: "12", label: "12 - GIRO" },
    { value: "13", label: "13 - DEP EN CTA (CORRIENTE/AHORROS)" },
    { value: "14", label: "14 - ENDOSO DE INVERSIÓN" },
    { value: "15", label: "15 - COMPENSACIÓN DE DEUDAS" },
    { value: "16", label: "16 - TARJETA DE DÉBITO" },
    { value: "17", label: "17 - DINERO ELECTRÓNICO" },
    { value: "18", label: "18 - TARJETA PREPAGO" },
    { value: "19", label: "19 - TARJETA DE CRÉDITO" },
    { value: "20", label: "20 - OTROS CON UTILIZ DE SIST FINAN" },
  ];

  return (
    <ModalPortal>
      <div className={styles.modalOverlay} onMouseDown={onClose} role="dialog" aria-modal="true">
        <div className={styles.modal} onMouseDown={stop}>
          <div className={styles.modalHeader}>
            <div className={styles.hTitle}>Nuevo proveedor</div>
            <div className={styles.hSub}>
              Completa los campos marcados con <span className={styles.req}>*</span>
            </div>
          </div>

          <form onSubmit={submit} className={styles.formGrid}>
            <div className={styles.sectionTitle}>Identificación</div>

            <label className={styles.field}>
              <span className={styles.label}>
                Nombre<span className={styles.req}>*</span>
              </span>
              <input
                className={styles.input}
                value={form.NombreProveedor}
                onChange={(e) => set("NombreProveedor", e.target.value)}
                required
                placeholder="Razón social / Nombre"
              />
            </label>

            <label className={styles.field}>
              <div className={styles.labelRow}>
                <span className={styles.label}>
                  RUC/CI<span className={styles.req}>*</span>
                </span>

                <label className={styles.inlineCheck}>
                  <input
                    type="checkbox"
                    checked={isPassport}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsPassport(checked);
                      if (checked) {
                        set("U_SYP_BPTD", "P");
                        setErr("");
                      } else {
                        set("U_SYP_BPTD", "C");
                      }
                    }}
                  />
                  <span>Documento pasaporte</span>
                </label>
              </div>

              <input
                className={styles.input}
                value={form.IdProveedor}
                onChange={(e) => handleIdProveedor(e.target.value)}
                required
                placeholder={isPassport ? "Número de pasaporte" : "Ej. 1790012345001"}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Email</span>
              <input
                type="email"
                className={styles.input}
                value={form.EmailAddress}
                onChange={(e) => set("EmailAddress", e.target.value)}
                placeholder="contacto@empresa.com"
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Teléfono</span>
              <input
                className={styles.input}
                value={form.Phone1}
                onChange={(e) => set("Phone1", e.target.value)}
                placeholder="+593 99 999 9999"
              />
            </label>

            <label className={`${styles.field} ${styles.span2}`}>
              <span className={styles.label}>Dirección</span>
              <input
                className={styles.input}
                value={form.Address}
                onChange={(e) => set("Address", e.target.value)}
                placeholder="Calle / Nro / Referencia"
              />
            </label>

            <div className={styles.sectionTitle}>Ubicación y grupo</div>

            <label className={styles.field}>
              <span className={styles.label}>País</span>
              <CountryDropdown
                value={form.Country ?? ""}
                onChange={(v) => set("Country", (v || "EC").toString().toUpperCase())}
                valueType="short"
                className={styles.input}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Grupo</span>
              <select
                className={styles.input}
                value={form.GroupCode === 102 ? "2" : "1"}
                onChange={(e) => set("GroupCode", e.target.value === "2" ? 102 : 101)}
              >
                <option value="1">1. Locales</option>
                <option value="2">2. Exterior</option>
              </select>
            </label>

            <div className={styles.sectionTitle}>Condiciones</div>

            <label className={styles.field}>
              <span className={styles.label}>Lista de precios</span>
              <input type="text" className={`${styles.input} ${styles.inputReadonly}`} value="L.DEFAULT ORIGINAL" readOnly />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Encargado de Compras</span>
              <input
                type="text"
                className={`${styles.input} ${styles.inputReadonly}`}
                value="BIOCELLS DISCOVERIES INTERNACIONAL"
                readOnly
              />
              <small className={styles.hint}>Se enviará el código 5 al backend</small>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Condiciones de pago</span>
              <select
                className={styles.input}
                value={form.PayTermsGrpCode}
                onChange={(e) => {
                  const code = e.target.value;
                  set("PayTermsGrpCode", code);

                  const term = terms.find((t) => String(t.GroupNum) === String(code));
                  if (term) {
                    set("TipoFacturacion", term.PymntGroup || "");
                    set("DiasCredito", String(term.ExtraDays ?? 0));
                  } else {
                    set("TipoFacturacion", "");
                    set("DiasCredito", "0");
                  }
                }}
              >
                <option value="">Seleccione condición de pago</option>
                {terms.map((t) => (
                  <option key={t.GroupNum} value={t.GroupNum}>
                    {t.PymntGroup}
                  </option>
                ))}
              </select>
              {termsError && <small className={styles.errorInline}>{termsError}</small>}
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Días de crédito</span>
              <input type="number" min={0} className={`${styles.input} ${styles.inputReadonly}`} value={form.DiasCredito} readOnly />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Forma de Pago</span>
              <select
                className={styles.input}
                value={form.U_SYP_FPAGO ?? "20"}
                onChange={(e) => set("U_SYP_FPAGO", e.target.value.padStart(2, "0"))}
                required
              >
                {FPAGO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.sectionTitle}>Datos bancarios</div>

            <label className={styles.field}>
              <span className={styles.label}>Banco (opcional)</span>
              <select className={styles.input} value={form.BankCode} onChange={(e) => set("BankCode", e.target.value)}>
                <option value="">Seleccione banco</option>
                {banks.map((b) => (
                  <option key={b.BankCode} value={b.BankCode}>
                    {b.BankName}
                  </option>
                ))}
              </select>
              {bankError && <small className={styles.errorInline}>{bankError}</small>}
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Número de cuenta (opcional)</span>
              <input
                className={styles.input}
                value={form.BankAccountNo}
                onChange={(e) => set("BankAccountNo", e.target.value)}
                placeholder="Ej. 22041892323"
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Nombre de la cuenta (opcional)</span>
              <input
                className={styles.input}
                value={form.BankAccountName}
                onChange={(e) => set("BankAccountName", e.target.value)}
                placeholder="Ej. MICHELLE TEST"
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Tipo identificación de la cuenta</span>
              <select className={styles.input} value={form.BankIdType} onChange={(e) => set("BankIdType", e.target.value)}>
                <option value="CEDULA">Cédula</option>
                <option value="RUC">RUC</option>
                <option value="PASAPORTE">Pasaporte</option>
                <option value="OTRO">Otro</option>
              </select>
              <small className={styles.hint}>Se enviará al campo UserNo1 de la cuenta bancaria del proveedor.</small>
            </label>

            <div className={styles.sectionTitle}>Tributario</div>

            <label className={styles.field}>
              <span className={styles.label}>Tipo de Documento</span>
              <select className={styles.input} value={form.U_SYP_BPTD ?? ""} onChange={(e) => set("U_SYP_BPTD", e.target.value.toUpperCase())}>
                <option value="">-</option>
                <option value="C">C - CÉDULA</option>
                <option value="R">R - RUC</option>
                <option value="P">P - PASAPORTE</option>
                <option value="F">F - CONSUMIDOR FINAL</option>
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>¿Maneja Contabilidad?</span>
              <select className={styles.input} value={form.U_SYP_CONTABILIDAD ?? "SI"} onChange={(e) => set("U_SYP_CONTABILIDAD", e.target.value)}>
                <option value="SI">SI</option>
                <option value="NO">NO</option>
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Tipo de Contribuyente</span>
              <select className={styles.input} value={form.U_SYP_TCONTRIB ?? "10"} onChange={(e) => set("U_SYP_TCONTRIB", e.target.value)} required>
                {TCONTRIB_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Certificado bancario (PDF)</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setCertFile(f);
                }}
              />
              <small className={styles.hint}>Se adjuntará al proveedor en SAP y se subirá a SharePoint.</small>
            </label>

            {err && <div className={`${styles.alertError} ${styles.span2}`}>{err}</div>}

            <div className={`${styles.modalActions} ${styles.span2}`}>
              <button type="button" className={styles.btnGhost} onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className={styles.btn} disabled={sending}>
                {sending ? "Creando…" : "Crear"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
