"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { decidirSolicitudCompras } from "@/app/lib/backend";
import styles from "./list.module.css";

export default function DecisionCompraButtons({ idSolicitud, userId }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const decidir = async (estado) => {
    const label = estado === "APROBADA" ? "aprobar" : "rechazar";
    if (!window.confirm(`¿Confirmas ${label} esta solicitud?`)) return;

    setLoading(true);
    try {
      await decidirSolicitudCompras(idSolicitud, { estado, usuarioId: userId });
      router.refresh();
    } catch (e) {
      alert(e?.message || "No se pudo registrar la decisión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`${styles.iconBtn} ${styles.iconApprove}`}
        disabled={loading}
        title="Aprobar"
        onClick={() => decidir("APROBADA")}
      >
        <Check size={17} />
      </button>

      <button
        type="button"
        className={`${styles.iconBtn} ${styles.iconReject}`}
        disabled={loading}
        title="Rechazar"
        onClick={() => decidir("RECHAZADA")}
      >
        <X size={17} />
      </button>
    </>
  );
}
