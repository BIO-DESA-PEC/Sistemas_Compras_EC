"use client";

import { useState } from "react";
import styles from "./ordenes.module.css";

export default function NumeroOrdenCompraCell({
  idOC,
  value,
  canEdit,
  userEmail,
}) {
  const [numero, setNumero] = useState(value || "");
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    try {
      setSaving(true);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/oc/${idOC}/numero-orden-compra`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-User-Email": userEmail,
            },
          body: JSON.stringify({
            NumeroOrdenCompra: numero,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "No se pudo guardar");
        return;
      }

      alert("Guardado correctamente");
    } catch (error) {
      alert("Error guardando número de orden");
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return <span>{numero || "—"}</span>;
  }

  return (
    <div className={styles.numeroOcBox}>
      <input
        className={styles.numeroOcInput}
        value={numero}
        onChange={(e) => setNumero(e.target.value)}
        placeholder="N° Orden"
      />

      <button
  type="button"
  className={styles.numeroOcBtn}
  onClick={guardar}
  disabled={saving}
  title="Guardar"
>
  {saving ? "..." : "✓"}
</button>
    </div>
  );
}