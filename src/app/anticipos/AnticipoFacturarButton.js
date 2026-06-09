"use client";

import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { crearOCDesdeAnticipo } from "@/app/lib/backend";
import styles from "./anticipos.module.css";

export default function AnticipoFacturarButton({ idAnticipo, idOC, userId }) {
  const router = useRouter();

  async function handleClick() {
    try {
      let finalIdOC = idOC;

      if (!finalIdOC) {
        const resp = await crearOCDesdeAnticipo(idAnticipo, userId);
        finalIdOC = resp.IdOC;
      }

      router.push(`/ordenes/${finalIdOC}?facturar=1&anticipoId=${idAnticipo}`);
    } catch (e) {
      alert(e?.message || "No se pudo crear/facturar el anticipo.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Crear OC y facturar anticipo"
      className={`${styles.actionBtn} ${styles.actiongreen}`}
    >
      <FileText size={17} />
    </button>
  );
}