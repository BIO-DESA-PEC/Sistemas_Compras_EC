"use client";

import { useEffect, useState } from "react";
import styles from "./anticipos.module.css";
import ProveedorPicker from "@/components/SupplierSelect";
import { useSession } from "next-auth/react";

const API = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function AnticipoModal({ onClose, onSuccess, idSolicitud }) {
  const [loading, setLoading] = useState(false);
  const [proveedor, setProveedor] = useState(null);
  const [identificacion, setIdentificacion] = useState("");
  const [numeroAnticipo, setNumeroAnticipo] = useState("");
  const { data: session } = useSession();
  const token = session?.accessToken; // o session?.user?.accessToken (depende cómo lo guardaste)

  // ✅ al abrir modal: pedir numero generado
  useEffect(() => {
  if (!session) return; // 👈 espera sesión

  let alive = true;

  (async () => {
    try {
      const email =
        session?.user?.email ||
        session?.email ||
        session?.user?.preferred_username ||
        "";

      const res = await fetch(`${API}/api/api/anticipos/next-numero`, {
        headers: {
          Authorization: session?.accessToken ? `Bearer ${session.accessToken}` : "",
          "X-User-Email": email,
        },
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      if (alive) setNumeroAnticipo(data?.numeroAnticipo || "");
    } catch (e) {
      console.error("No se pudo obtener número de anticipo:", e);
    }
  })();

  return () => { alive = false; };
}, [session, API]);

  function handleProveedorSelected(nombre, prov) {
    setProveedor(prov || null);

    if (!prov) {
      setIdentificacion("");
      return;
    }

    const codigo = prov.CodigoSAP || "";
    if (!codigo) alert("Este proveedor no tiene Código SAP configurado.");
    setIdentificacion(codigo);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const formEl = e.target;
    const detalleGasto = formEl.detalleGasto.value.trim();
    const valor = parseFloat(formEl.valor.value || "0");
    const fechaPago = formEl.fechaPago.value;
    const estadoAnticipo = formEl.estadoAnticipo.value;
    const file = formEl.file.files[0];
    const retencion = formEl.retencion.checked;

    if (!numeroAnticipo) return alert("No se pudo generar el número de anticipo.");
    if (!proveedor) return alert("Debes seleccionar un proveedor.");
    if (!identificacion) return alert("No se pudo obtener el RUC del proveedor.");
    if (!file) return alert("Debes seleccionar un archivo PDF");

    try {
      setLoading(true);

      // 1) subir archivo a SharePoint
      const fd = new FormData();
      fd.append("numeroAnticipo", numeroAnticipo);
      fd.append("file", file);

      const uploadRes = await fetch(`${API}/api/anticipos/upload`, {
        method: "POST",
        body: fd,
      });

      if (!uploadRes.ok) throw new Error(await uploadRes.text());
      const uploadJson = await uploadRes.json();
      const adjuntoUrl = uploadJson.url;

      // 2) crear anticipo
      const body = {
        numeroAnticipo,
        detalleGasto,
        valor,
        fechaPago,
        estadoAnticipo,
        identificacion,
        adjuntoUrl,
        retencion,
        IdSolicitud: idSolicitud || null,
      };

      const res = await fetch(`${API}/api/anticipos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(await res.text());

      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      alert("Ocurrió un error creando el anticipo. Revisa consola.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.modalBg}>
      <div className={styles.modal}>
        <h2>Nuevo anticipo</h2>

        {idSolicitud ? (
          <div className={styles.note} style={{ marginBottom: 10 }}>
            Vinculado a Solicitud: <b>#{idSolicitud}</b>
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          {/* ✅ mostrar número generado */}
          <label>Número de anticipo (generado)</label>
          <input value={numeroAnticipo} readOnly placeholder="Generando..." />

          <div className={styles.row2}>
            <div className={styles.col}>
              <label>Proveedor</label>
              <ProveedorPicker
                value={proveedor?.NombreProveedor || ""}
                onChange={handleProveedorSelected}
                disabled={loading}
              />
            </div>

            <div className={styles.col}>
              <label>RUC o cédula del proveedor</label>
              <input
                value={identificacion}
                readOnly
                placeholder="Seleccione un proveedor"
              />
            </div>
          </div>

          <label>Fecha de pago</label>
          <input type="date" name="fechaPago" required />

          <label>Detalle del gasto</label>
          <input name="detalleGasto" required />

          <label>Valor</label>
          <input name="valor" type="number" step="0.01" min="0" required />

          <label>Estado del anticipo</label>
          <select name="estadoAnticipo" defaultValue="Pendiente" required>
            <option value="Pendiente">Pendiente</option>
            <option value="Pagado">Pagado</option>
            <option value="Anulado">Anulado</option>
          </select>

          <label className={styles.checkRow}>
            <input type="checkbox" name="retencion" />
            <span>Aplica retención</span>
          </label>

          <label>Adjunto (PDF)</label>
          <input type="file" name="file" accept="application/pdf" required />

          <div className={styles.modalButtons}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? "Guardando..." : "Guardar anticipo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
