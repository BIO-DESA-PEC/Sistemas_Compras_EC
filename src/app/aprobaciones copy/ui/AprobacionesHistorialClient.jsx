"use client";

import { useState } from "react";
import { Eye } from "lucide-react";

import styles from "../aprobaciones.module.css";
import { getApprovedApprovalDetail } from "@/app/lib/backend";
import SolicitudDetalleModal from "./SolicitudDetalleModal";

function formatDate(value) {
  if (!value) return "--";

  const normalized =
    typeof value === "string"
      ? value.replace(" ", "T")
      : value;

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default function AprobacionesHistorialClient({
  initial = [],
  userId,
}) {
  const rows = Array.isArray(initial) ? initial : [];

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailData, setDetailData] = useState(null);

  async function openDetail(row) {
    const solicitudId = row.IdSolicitud;

    if (!solicitudId) {
      alert("No se encontró el número de solicitud.");
      return;
    }

    try {
      setDetailOpen(true);
      setDetailLoading(true);
      setDetailError("");
      setDetailData(null);

      const data = await getApprovedApprovalDetail(
        userId,
        solicitudId
      );

      setDetailData(data);
    } catch (error) {
      console.error(error);

      setDetailError(
        error?.message ||
          "No se pudo consultar el detalle de la solicitud."
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetailOpen(false);
    setDetailLoading(false);
    setDetailError("");
    setDetailData(null);
  }

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <span className={styles.cardEyebrow}>
              Historial
            </span>

            <h2 className={styles.cardTitle}>
              Solicitudes aprobadas
            </h2>

            <p className={styles.cardDescription}>
              Consulta las solicitudes que aprobaste y revisa todo
              su contenido.
            </p>
          </div>

          <div className={styles.resultCount}>
            {rows.length}{" "}
            {rows.length === 1 ? "solicitud" : "solicitudes"}
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th># Solicitud</th>
                <th>Solicitado por</th>
                <th>Departamento</th>
                <th>Nivel</th>
                <th>Fecha de aprobación</th>
                <th>Renglones</th>
                <th>Comentario</th>
                <th className={styles.actionsHeader}>
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.empty}>
                    No tienes solicitudes aprobadas.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.IdAprobacion}>
                    <td>
                      <span className={styles.requestNumber}>
                        {row.Codigo || `#${row.IdSolicitud}`}
                      </span>
                    </td>

                    <td>
                      <div className={styles.personCell}>
                        <div className={styles.personAvatar}>
                          {String(
                            row.SolicitadoPor ||
                              row.Solicitante ||
                              "S"
                          )
                            .trim()
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>
                            {row.SolicitadoPor ||
                              row.Solicitante ||
                              "--"}
                          </strong>

                          {row.CorreoSolicitante ? (
                            <span>{row.CorreoSolicitante}</span>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    <td>
                      {row.Departamento || row.Depto || "--"}
                    </td>

                    <td>
                      <span className={styles.levelBadge}>
                        {row.Nivel || "--"}
                      </span>
                    </td>

                    <td>{formatDate(row.FechaDecision)}</td>

                    <td>
                      <span className={styles.linesBadge}>
                        {Number(row.Renglones || 0)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={styles.commentText}
                        title={row.Comentario || ""}
                      >
                        {row.Comentario || "--"}
                      </span>
                    </td>

                    <td>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={styles.btnView}
                          onClick={() => openDetail(row)}
                          title="Ver detalle completo"
                        >
                          <Eye size={17} />
                          Ver detalle
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SolicitudDetalleModal
        open={detailOpen}
        loading={detailLoading}
        error={detailError}
        data={detailData}
        onClose={closeDetail}
      />
    </>
  );
}