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
      const res = await fetch(`${API_BASE}/api/anticipos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          IdUsuario: user.IdUsuario,
          DepartamentoId: user.DepartamentoId || null,
          Fecha: form.Fecha,
          Monto: Number(form.Monto),
          Moneda: form.Moneda,
          BeneficiarioCheque: form.BeneficiarioCheque,
          CiDniRuc: form.CiDniRuc,
          Motivo1: form.Motivo1,
          Motivo2: form.Motivo2,
          FechaMaximaLiquidacion: form.FechaMaximaLiquidacion,
          Observacion: form.Observacion,
        }),
      });

      const data = await res.json();

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