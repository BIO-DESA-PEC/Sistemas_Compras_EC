"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./preordenes.module.css";
import { createPreOCDirect } from "@/app/lib/backend";

function NiceModal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>{title}</div>
          <button className={styles.modalX} onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}

export default function CreatePreOCModalButton({ userId, departamentoId }) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState("ARTICULO");
  const [comentario, setComentario] = useState("");
  const [loading, setLoading] = useState(false);

  const [err, setErr] = useState("");

  async function crear() {
    setErr("");

    if (!userId) {
      setErr("No se detectó el usuario. Vuelve a iniciar sesión.");
      return;
    }

    setLoading(true);
    try {
      const r = await createPreOCDirect({
        userId,
        departamentoId: departamentoId ?? undefined,
        tipo,
        comentario,
      });

      setOpen(false);
      // ✅ ir directo al editor
      router.push(`/preordenes/${r.IdPreOC}`);
    } catch (e) {
      setErr(e?.message || "No se pudo crear la Pre-Orden.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        className={styles.primary}
        type="button"
        onClick={() => setOpen(true)}
        title="Crear una Pre-Orden desde cero"
      >
        + Nueva Pre-Orden
      </button>

      <NiceModal open={open} title="Nueva Pre-Orden" onClose={() => !loading && setOpen(false)}>
        <div className={styles.modalGrid}>
          <label className={styles.modalLabel}>
            <span>Tipo</span>
            <select
              className={styles.modalSelect}
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              disabled={loading}
            >
              <option value="ARTICULO">ARTÍCULO</option>
              <option value="SERVICIO">SERVICIO</option>
            </select>
          </label>

          <label className={styles.modalLabel}>
            <span>Comentario (opcional)</span>
            <textarea
              className={styles.modalTextarea}
              rows={4}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Escribe un comentario si deseas…"
              disabled={loading}
            />
          </label>

          {err && <div className={styles.modalError}>{err}</div>}

          <div className={styles.modalFooter}>
            <button
              className={styles.secondary}
              type="button"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </button>

            <button
              className={styles.primary}
              type="button"
              onClick={crear}
              disabled={loading}
            >
              {loading ? "Creando…" : "Crear Pre-Orden"}
            </button>
          </div>

          <p className={styles.modalHint}>
            * Se crea una Solicitud BORRADOR interna para mantener el flujo compatible.
          </p>
        </div>
      </NiceModal>
    </>
  );
}
