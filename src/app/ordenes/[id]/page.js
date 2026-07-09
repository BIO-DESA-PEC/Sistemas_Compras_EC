// src/app/ordenes/[id]/page.js
import { auth } from "@/auth";
import { getOC } from "@/app/lib/backend";
import OCEditor from "./ui/OCEditor";
import styles from "./orden.module.css";

export default async function OCDetailPage({ params }) {
  await auth();

  const id = params.id;
  const data = await getOC(id);

  const { cabecera, detalle, facturaCabecera, facturaDetalle } = data;

  const ocCompleta = {
    ...cabecera,
    facturaCabecera,
    facturaDetalle,
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeadLeft}>
          <h1 className={styles.pageTitle}>OC #{cabecera.IdOC}</h1>

          <div className={styles.meta}>
            <span className={styles.metaItem}>
              <strong>Solicitud:</strong> #{cabecera.IdSolicitud}
            </span>
            <span className={styles.dot}>•</span>
            <span className={styles.metaItem}>
              <strong>Fecha:</strong>{" "}
              {cabecera.FechaCreacion?.substring(0, 19).replace("T", " ")}
            </span>
          </div>
        </div>

        <div className={styles.pageHeadRight}>
          <span
            className={`${styles.badge} ${
              cabecera.Estado === "PROCESADA"
                ? styles.badgeProc
                : cabecera.Estado === "ANULADA"
                ? styles.badgeAnu
                : cabecera.Estado === "GENERADA"
                ? styles.badgeGen
                : styles.badgeMut
            }`}
          >
            {cabecera.Estado}
          </span>
        </div>
      </div>

      <OCEditor oc={ocCompleta} detalleInicial={detalle} />
    </div>
  );
}