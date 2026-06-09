"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../../solicitudes/list.module.css";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function EstadoAnticipoForm({ id }) {
  const router = useRouter();

  const [estado, setEstado] = useState("PAGADO");
  const [observacion, setObservacion] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const guardar = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/anticipos/${id}/estado`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Estado: estado,
          Observacion: observacion,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "No se pudo cambiar el estado.");
      }

      router.push("/anticipos");
      router.refresh();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>Cambiar estado del anticipo</h1>

        <div className={styles.filters}>
          <a className={styles.chip} href="/anticipos">
            Volver
          </a>
        </div>
      </div>

      <div className={styles.card} style={{ padding: 24 }}>
        <form onSubmit={guardar}>
          <label style={{ display: "block", marginBottom: 14 }}>
            <b>Estado</b>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              style={{
                width: "100%",
                marginTop: 8,
                padding: 12,
                borderRadius: 10,
                border: "1px solid #cbd5e1",
              }}
            >
              <option value="PAGADO">PAGADO</option>
              <option value="ANULADA">ANULADA</option>
            </select>
          </label>

          <label style={{ display: "block", marginBottom: 14 }}>
            <b>Observación</b>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Ingrese una observación..."
              style={{
                width: "100%",
                minHeight: 110,
                marginTop: 8,
                padding: 12,
                borderRadius: 10,
                border: "1px solid #cbd5e1",
              }}
            />
          </label>

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? "Guardando..." : "Guardar estado"}
          </button>

          {msg && (
            <div style={{ marginTop: 14, color: "red", fontWeight: 600 }}>
              {msg}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}