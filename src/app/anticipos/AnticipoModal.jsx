"use client";

import { useState } from "react";
import styles from "./anticipos.module.css";
import ProveedorPicker from "@/components/SupplierSelect"; // <-- misma que usas en Pre-OC

const API = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function AnticipoModal({ onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [proveedor, setProveedor] = useState(null);
  const [identificacion, setIdentificacion] = useState("");

  // Cuando seleccionas proveedor en el picker
  function handleProveedorSelected(nombre, prov) {
  console.log("Proveedor seleccionado en AnticipoModal:", nombre, prov);
  setProveedor(prov || null);

  if (!prov) {
    setIdentificacion("");
    return;
  }

  // 👇 Aquí usamos el CodigoSAP que viene de la vista PROVEEDORES_COMPRAS
  const codigo = prov.CodigoSAP || "";

  if (!codigo) {
    alert("Este proveedor no tiene Código SAP configurado.");
  }

  setIdentificacion(codigo); // aquí va el PL...
}



  async function handleSubmit(e) {
    e.preventDefault();

    const formEl = e.target;
    const numeroAnticipo = formEl.numeroAnticipo.value.trim();
    const detalleGasto = formEl.detalleGasto.value.trim();
    const valor = parseFloat(formEl.valor.value || "0");
    const fechaPago = formEl.fechaPago.value;
    const estadoAnticipo = formEl.estadoAnticipo.value;
    const file = formEl.file.files[0];

    // Validaciones extras
    if (!proveedor) {
      alert("Debes seleccionar un proveedor.");
      return;
    }

    if (!identificacion) {
      alert("No se pudo obtener el RUC del proveedor.");
      return;
    }

    if (!file) {
      alert("Debes seleccionar un archivo PDF");
      return;
    }

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

      if (!uploadRes.ok) {
        const t = await uploadRes.text();
        throw new Error("Error al subir archivo: " + t);
      }

      const uploadJson = await uploadRes.json();
      const adjuntoUrl = uploadJson.url;

      // 2) crear anticipo (OJO: identificacion viene del estado, NO del input manual)
      const body = {
        numeroAnticipo,
        detalleGasto,
        valor,
        fechaPago,
        estadoAnticipo,
        identificacion, // <-- aquí va el RUC / LicTradNum
        adjuntoUrl,
      };

      const res = await fetch(`${API}/api/anticipos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error("Error al crear anticipo: " + t);
      }

      onSuccess();
      onClose();
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

        <form onSubmit={handleSubmit}>
          {/* Número de anticipo */}
          <label>Número de anticipo</label>
          <input name="numeroAnticipo" required />

          {/* Proveedor + RUC */}
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

          {/* Fecha */}
          <label>Fecha de pago</label>
          <input type="date" name="fechaPago" required />

          {/* Detalle */}
          <label>Detalle del gasto</label>
          <input name="detalleGasto" required />

          {/* Valor */}
          <label>Valor</label>
          <input
            name="valor"
            type="number"
            step="0.01"
            min="0"
            required
          />

          {/* Estado */}
          <label>Estado del anticipo</label>
          <select name="estadoAnticipo" defaultValue="Pendiente" required>
            <option value="Pendiente">Pendiente</option>
            <option value="Pagado">Pagado</option>
            <option value="Anulado">Anulado</option>
          </select>

          {/* Archivo */}
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
