"use client";

import { useState } from "react";
import styles from "./anticipoNew.module.css";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function AnticipoForm({ user }) {
  const [form, setForm] = useState({
    Fecha: "",
    Monto: "",
    Moneda: "USD",
    BeneficiarioCheque: "",
    CiDniRuc: "",
    Motivo1: "",
    Motivo2: "",
    FechaMaximaLiquidacion: "",
    Observacion: "",
  });

  const [loading, setLoading] = useState(false);
  const [archivoPdf, setArchivoPdf] = useState(null);
  const [msg, setMsg] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const guardar = async (e) => {
    e.preventDefault();
    setMsg("");

    if (!user?.IdUsuario) {
      setMsg("No se pudo obtener el usuario.");
      return;
    }

    setLoading(true);

    try {
      const fd = new FormData();

      fd.append("IdUsuario", user.IdUsuario);
      fd.append("DepartamentoId", user.DepartamentoId || "");
      fd.append("Fecha", form.Fecha);
      fd.append("Monto", Number(form.Monto));
      fd.append("Moneda", form.Moneda);
      fd.append("BeneficiarioCheque", form.BeneficiarioCheque);
      fd.append("CiDniRuc", form.CiDniRuc);
      fd.append("Motivo1", form.Motivo1);
      fd.append("Motivo2", form.Motivo2);
      fd.append("FechaMaximaLiquidacion", form.FechaMaximaLiquidacion);
      fd.append("Observacion", form.Observacion);

      if (archivoPdf) {
        fd.append("ArchivoPdf", archivoPdf);
      }

      const res = await fetch(`${API_BASE}/api/anticipos`, {
        method: "POST",
        body: fd,
      });

      const text = await res.text();

      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || "El backend no devolvió JSON.");
      }

      if (!res.ok) {
        throw new Error(data?.error || "Error al crear la solicitud.");
      }

      if (!res.ok) {
        throw new Error(data?.error || "Error al crear la solicitud.");
      }

      setMsg(`Solicitud creada correctamente: ${data.Codigo}`);

      setForm({
        Fecha: "",
        Monto: "",
        Moneda: "USD",
        BeneficiarioCheque: "",
        CiDniRuc: "",
        Motivo1: "",
        Motivo2: "",
        FechaMaximaLiquidacion: "",
        Observacion: "",
      });

      setArchivoPdf(null);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1>Solicitud de anticipo</h1>

        <p className={styles.subtitle}>
          Completa la información para enviar la solicitud a Compras.
        </p>

        <div className={styles.userBox}>
          <strong>Solicitado por:</strong> {user?.Nombre || "—"}
          <br />
          <strong>Correo:</strong> {user?.Correo || "—"}
        </div>

        <form onSubmit={guardar} className={styles.form}>
          <label>
            Fecha
            <input
              name="Fecha"
              type="date"
              value={form.Fecha}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Monto
            <input
              name="Monto"
              type="number"
              step="0.01"
              value={form.Monto}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Moneda
            <select name="Moneda" value={form.Moneda} onChange={handleChange}>
              <option value="USD">USD</option>
            </select>
          </label>

          <label>
            Beneficiario del cheque
            <input
              name="BeneficiarioCheque"
              value={form.BeneficiarioCheque}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            CI/DNI/RUC
            <input
              name="CiDniRuc"
              value={form.CiDniRuc}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Motivo N°1 del cheque
            <input
              name="Motivo1"
              value={form.Motivo1}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Motivo N°2 del cheque
            <input
              name="Motivo2"
              value={form.Motivo2}
              onChange={handleChange}
            />
          </label>

          <label>
            Fecha máxima de liquidación
            <input
              name="FechaMaximaLiquidacion"
              type="date"
              value={form.FechaMaximaLiquidacion}
              onChange={handleChange}
              required
            />
          </label>

          <label className={styles.full}>
            Documento PDF adicional
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];

                if (!file) {
                  setArchivoPdf(null);
                  return;
                }

                if (file.type !== "application/pdf") {
                  setMsg("Solo se permite subir archivos PDF.");
                  e.target.value = "";
                  setArchivoPdf(null);
                  return;
                }

                setArchivoPdf(file);
              }}
            />
          </label>

          <label className={styles.full}>
            Observación
            <textarea
              name="Observacion"
              value={form.Observacion}
              onChange={handleChange}
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Enviando..." : "Enviar solicitud"}
          </button>

          {msg && <div className={styles.message}>{msg}</div>}
        </form>
      </div>
    </main>
  );
}