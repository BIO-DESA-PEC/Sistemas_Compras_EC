"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./Proveedor.module.css";

function asIntOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function ProveedorEditModal({
  open,
  onClose,
  proveedor,
  condiciones = [],
  formasPago = [],
  onSave,
  saving = false,
  error = "",
}) {
  const [EmailAddress, setEmail] = useState("");
  const [Phone1, setPhone1] = useState("");
  const [Phone2, setPhone2] = useState("");
  // ✅ Ahora guardamos el GroupNum directamente (PayTermsGrpCode en SAP)
  const [PayTermsGrpCode, setPayTerms] = useState("");
  const [U_SYP_FPAGO, setFpago] = useState("");
  const [bankCert, setBankCert] = useState(null);
  const condById = useMemo(() => {
    const m = new Map();
    condiciones.forEach((c) => m.set(Number(c.GroupNum), c));
    return m;
  }, [condiciones]);

  useEffect(() => {
    if (!proveedor) return;

    setEmail(proveedor.EmailAddress || "");
    setPhone1(proveedor.Phone1 || "");
    setPhone2(proveedor.Phone2 || "");
    setFpago(proveedor.U_SYP_FPAGO || "");
    setBankCert(null);
    const dias = proveedor.DiasCredito;
    if (dias === null || dias === undefined || dias === "") {
      setPayTerms("");
    } else {
      const found = condiciones.find((c) => Number(c.ExtraDays) === Number(dias));
      setPayTerms(found ? String(found.GroupNum) : "");
    }
  }, [proveedor, condiciones]);

  if (!open) return null;

  const condSelected = PayTermsGrpCode
    ? condById.get(Number(PayTermsGrpCode))
    : null;

  function submit() {
    const payload = {
      EmailAddress: EmailAddress.trim(),
      Phone1: Phone1.trim(),
      Phone2: Phone2.trim(),
      U_SYP_FPAGO: U_SYP_FPAGO.trim(),
      PayTermsGrpCode: asIntOrNull(PayTermsGrpCode),
      bank_cert: bankCert,
    };

    onSave?.(payload);
  }

  return (
    <div className={styles.modalOverlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>Editar proveedor</div>
            <div className={styles.modalSub}>
              <span className={styles.badge}>{proveedor?.CodigoSAP || ""}</span>{" "}
              {proveedor?.NombreProveedor || ""}
            </div>
          </div>

          <button className={styles.btnClose} onClick={onClose} title="Cerrar" disabled={saving}>
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label>Email</label>
              <input
                value={EmailAddress}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@proveedor.com"
                disabled={saving}
              />
            </div>

            <div className={styles.field}>
              <label>Forma de pago (U_SYP_FPAGO)</label>
              <select
  value={U_SYP_FPAGO}
  onChange={(e) => setFpago(e.target.value)}
>
  <option value="">-- Seleccione --</option>
  {formasPago.map((fp) => (
    <option key={fp.Code} value={fp.Code}>
      {fp.Code} - {fp.Name}
    </option>
  ))}
</select>

{U_SYP_FPAGO ? (
  <div className={styles.help}>
    ✅ Seleccionado:{" "}
    <b>
      {formasPago.find((x) => x.Code === U_SYP_FPAGO)?.Name || U_SYP_FPAGO}
    </b>
    {" "}• código <b>{U_SYP_FPAGO}</b>
  </div>
) : (
  <div className={styles.help}>
    Tip: esto se guarda en SAP en el UDF <b>U_SYP_FPAGO</b>.
  </div>
)}

            </div>

            <div className={styles.field}>
              <label>Teléfono 1</label>
              <input
                value={Phone1}
                onChange={(e) => setPhone1(e.target.value)}
                placeholder="0999999999"
                disabled={saving}
              />
            </div>

            <div className={styles.field}>
              <label>Teléfono 2</label>
              <input
                value={Phone2}
                onChange={(e) => setPhone2(e.target.value)}
                placeholder="022222222"
                disabled={saving}
              />
            </div>

            <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
            <label>Condición de pago (Días crédito)</label>

            <select
              value={PayTermsGrpCode}
              onChange={(e) => setPayTerms(e.target.value)}
              disabled={saving}
            >
              <option value="">-- Seleccione --</option>
              {condiciones.map((c) => (
                <option key={c.GroupNum} value={c.GroupNum}>
                  {c.PymntGroup} ({c.ExtraDays} días)
                </option>
              ))}
            </select>

            {condSelected ? (
              <div className={styles.help}>
                ✅ Seleccionado: <b>{condSelected.PymntGroup}</b> • {condSelected.ExtraDays} días
              </div>
            ) : (
              <div className={styles.help}>Tip: aquí controlas los días de crédito (OCTG).</div>
            )}
          </div>

          <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
            <label>Certificado bancario</label>

            {proveedor?.BankCertUrl ? (
              <div className={styles.help}>
                Certificado actual:{" "}
                <a href={proveedor.BankCertUrl} target="_blank" rel="noopener noreferrer">
                  Ver / Descargar
                </a>
              </div>
            ) : (
              <div className={styles.help}>
                Este proveedor no tiene certificado bancario cargado.
              </div>
            )}

            <input
              type="file"
              accept="application/pdf,image/*"
              disabled={saving}
              onChange={(e) => setBankCert(e.target.files?.[0] || null)}
            />

            {bankCert ? (
              <div className={styles.help}>
                Nuevo archivo seleccionado: <b>{bankCert.name}</b>
              </div>
            ) : null}
          </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnGhost} onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className={styles.btnBlue} onClick={submit} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
