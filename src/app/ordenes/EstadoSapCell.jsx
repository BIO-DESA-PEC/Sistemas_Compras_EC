"use client";

import { useState } from "react";
import styles from "./ordenes.module.css";

export default function EstadoSapCell({
  idOC,
  estadoInicial,
  comentarioInicial,
  canEdit,
  userEmail,
}) {
  const [estado, setEstado] = useState(estadoInicial || "PENDIENTE");
  const [comentario, setComentario] = useState(comentarioInicial || "");
  const [saving, setSaving] = useState(false);

  const esProcesado = (estadoInicial || "").toUpperCase() === "PROCESADO";

  const guardar = async () => {
    if (estado === "RECHAZADO" && !comentario.trim()) {
      alert("Debe ingresar un comentario SAP para rechazar.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/oc/${idOC}/estado-sap`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-User-Email": userEmail,
          },
          body: JSON.stringify({
            EstadoSAP: estado,
            ComentarioSAP: comentario,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "No se pudo actualizar Estado SAP");
      }

      alert("Estado SAP actualizado correctamente.");
      window.location.reload();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit || esProcesado) {
    return (
      <>
        <div>
          <span
            className={`${styles.badge} ${
              estado === "PROCESADO"
                ? styles.sapBadgeProcesado
                : estado === "RECHAZADO"
                ? styles.sapBadgeRechazado
                : styles.sapBadgePendiente
            }`}
          >
            {estado}
          </span>
        </div>

        <div title={comentario || ""}>{comentario || "—"}</div>
      </>
    );
  }

  return (
    <>
      <div className={styles.sapBox}>
        <select
          className={styles.sapSelect}
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          disabled={saving}
        >
          <option value="PENDIENTE">PENDIENTE</option>
          <option value="RECHAZADO">RECHAZADO</option>
        </select>

        <button
          type="button"
          className={styles.sapBtn}
          onClick={guardar}
          disabled={saving}
        >
          {saving ? "..." : "✓"}
        </button>
      </div>

      <div>
        <input
          className={styles.sapComment}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Comentario SAP"
          disabled={saving}
        />
      </div>
    </>
  );
}