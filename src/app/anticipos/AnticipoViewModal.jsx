"use client";

import styles from "./anticipos.module.css";

export default function AnticipoViewModal({ anticipo, onClose }) {
  if (!anticipo) return null;

  const {
    numeroAnticipo,
    detalleGasto,
    identificacion,
    fechaPago,
    estadoAnticipo,
    valor,
    adjuntoUrl,
  } = anticipo;

  const fecha = fechaPago ? fechaPago.substring(0, 10) : "";

  function handleOpen() {
    if (!adjuntoUrl) return;
    window.open(adjuntoUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className={styles.modalBg}>
      <div className={styles.modal}>
        <h2>Detalle de anticipo</h2>

        <div className={styles.detailGrid}>
          <div>
            <div className={styles.detailLabel}># Anticipo</div>
            <div className={styles.detailValue}>{numeroAnticipo}</div>
          </div>

          <div>
            <div className={styles.detailLabel}>Identificación</div>
            <div className={styles.detailValue}>{identificacion}</div>
          </div>

          <div>
            <div className={styles.detailLabel}>Detalle gasto</div>
            <div className={styles.detailValue}>{detalleGasto}</div>
          </div>

          <div>
            <div className={styles.detailLabel}>Fecha pago</div>
            <div className={styles.detailValue}>{fecha}</div>
          </div>

          <div>
            <div className={styles.detailLabel}>Estado</div>
            <div className={styles.detailValue}>{estadoAnticipo}</div>
          </div>

          <div>
            <div className={styles.detailLabel}>Valor</div>
            <div className={styles.detailValue}>{valor}</div>
          </div>
        </div>

        <div className={styles.modalButtons}>
          {adjuntoUrl && (
            <>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleOpen}
              >
                Ver adjunto
              </button>
              <a
  className={styles.btnSecondary}
  href={adjuntoUrl}
  target="_blank"
  rel="noopener noreferrer"
>
  Descargar
</a>

            </>
          )}

          <button
            type="button"
            className={styles.btnPrimary}
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
