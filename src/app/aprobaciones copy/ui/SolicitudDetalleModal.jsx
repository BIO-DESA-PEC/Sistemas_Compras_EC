"use client";

import {
  X,
  UserRound,
  Building2,
  CalendarDays,
  FileText,
  PackageSearch,
  Paperclip,
  History,
  ExternalLink,
} from "lucide-react";

import styles from "../aprobaciones.module.css";

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

function formatMoney(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(number);
}

function getStatusClass(status) {
  const normalized = String(status || "").trim().toUpperCase();

  if (normalized === "APROBADA") return styles.statusApproved;
  if (normalized === "RECHAZADA") return styles.statusRejected;
  if (normalized === "OMITIDA") return styles.statusOmitted;

  return styles.statusPending;
}

export default function SolicitudDetalleModal({
  open,
  loading,
  error,
  data,
  onClose,
}) {
  if (!open) return null;

  const cabecera = data?.cabecera || {};
  const aprobacion = cabecera?.Aprobacion || {};
  const detalle = Array.isArray(data?.detalle) ? data.detalle : [];
  const adjuntos = Array.isArray(data?.adjuntos) ? data.adjuntos : [];
  const historial = Array.isArray(data?.historial) ? data.historial : [];

  return (
    <div
      className={styles.modalOverlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <span className={styles.modalEyebrow}>
              Detalle de solicitud
            </span>

            <h2 className={styles.modalTitle}>
              {cabecera?.Codigo || `#${cabecera?.IdSolicitud || ""}`}
            </h2>
          </div>

          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Cerrar detalle"
          >
            <X size={21} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {loading ? (
            <div className={styles.detailLoading}>
              <div className={styles.spinner} />
              <p>Cargando detalle de la solicitud...</p>
            </div>
          ) : error ? (
            <div className={styles.detailError}>
              <strong>No se pudo cargar el detalle</strong>
              <span>{error}</span>
            </div>
          ) : (
            <>
              <section className={styles.summaryGrid}>
                <article className={styles.summaryItem}>
                  <div className={styles.summaryIcon}>
                    <UserRound size={19} />
                  </div>

                  <div>
                    <span>Solicitado por</span>
                    <strong>
                      {cabecera?.SolicitadoPor || "--"}
                    </strong>

                    {cabecera?.CorreoSolicitante ? (
                      <small>{cabecera.CorreoSolicitante}</small>
                    ) : null}
                  </div>
                </article>

                <article className={styles.summaryItem}>
                  <div className={styles.summaryIcon}>
                    <Building2 size={19} />
                  </div>

                  <div>
                    <span>Departamento</span>
                    <strong>
                      {cabecera?.Departamento || "--"}
                    </strong>
                  </div>
                </article>

                <article className={styles.summaryItem}>
                  <div className={styles.summaryIcon}>
                    <CalendarDays size={19} />
                  </div>

                  <div>
                    <span>Fecha de creación</span>
                    <strong>
                      {formatDate(cabecera?.FechaCreacion)}
                    </strong>
                  </div>
                </article>

                <article className={styles.summaryItem}>
                  <div className={styles.summaryIcon}>
                    <FileText size={19} />
                  </div>

                  <div>
                    <span>Tipo</span>
                    <strong>{cabecera?.Tipo || "--"}</strong>
                  </div>
                </article>
              </section>

              <section className={styles.detailSection}>
                <div className={styles.sectionHeader}>
                  <div>
                    <span className={styles.sectionEyebrow}>
                      Información general
                    </span>
                    <h3>Estado de la solicitud</h3>
                  </div>

                  <span
                    className={`${styles.statusBadge} ${getStatusClass(
                      cabecera?.Estado || aprobacion?.Decision
                    )}`}
                  >
                    {cabecera?.Estado ||
                      aprobacion?.Decision ||
                      "PENDIENTE"}
                  </span>
                </div>

                <div className={styles.generalInfo}>
                  <div>
                    <span>Nivel de aprobación</span>
                    <strong>{aprobacion?.Nivel || "--"}</strong>
                  </div>

                  <div>
                    <span>Fecha de decisión</span>
                    <strong>
                      {formatDate(aprobacion?.FechaDecision)}
                    </strong>
                  </div>

                  <div>
                    <span>Renglones</span>
                    <strong>{detalle.length}</strong>
                  </div>
                </div>

                <div className={styles.commentBox}>
                  <span>Comentario de la solicitud</span>
                  <p>
                    {cabecera?.ComentariosSolicitud ||
                      "La solicitud no registra comentarios."}
                  </p>
                </div>

                {aprobacion?.Comentario ? (
                  <div className={styles.commentBox}>
                    <span>Comentario de aprobación</span>
                    <p>{aprobacion.Comentario}</p>
                  </div>
                ) : null}
              </section>

              <section className={styles.detailSection}>
                <div className={styles.sectionHeader}>
                  <div>
                    <span className={styles.sectionEyebrow}>
                      Artículos o servicios
                    </span>

                    <h3>
                      <PackageSearch size={19} />
                      Detalle solicitado
                    </h3>
                  </div>

                  <span className={styles.countBadge}>
                    {detalle.length}{" "}
                    {detalle.length === 1 ? "renglón" : "renglones"}
                  </span>
                </div>

                <div className={styles.detailTableWrap}>
                  <table className={styles.detailTable}>
                    <thead>
                      <tr>
                        <th>Artículo</th>
                        <th>Descripción</th>
                        <th>Proveedor</th>
                        <th>Fecha necesaria</th>
                        <th className={styles.numericCell}>
                          Cantidad
                        </th>
                        <th className={styles.numericCell}>
                          Precio
                        </th>
                        <th className={styles.numericCell}>
                          IVA
                        </th>
                        <th className={styles.numericCell}>
                          Total
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {detalle.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className={styles.emptyDetail}
                          >
                            La solicitud no tiene renglones.
                          </td>
                        </tr>
                      ) : (
                        detalle.map((item, index) => (
                          <tr
                            key={
                              item.IdDetalle ||
                              `${item.NumeroArticulo}-${index}`
                            }
                          >
                            <td>
                              <strong>
                                {item.NumeroArticulo || "--"}
                              </strong>
                            </td>

                            <td>{item.Descripcion || "--"}</td>
                            <td>{item.Proveedor || "--"}</td>

                            <td>
                              {formatDate(item.FechaNecesaria)}
                            </td>

                            <td className={styles.numericCell}>
                              {Number(item.Cantidad || 0)}
                            </td>

                            <td className={styles.numericCell}>
                              {formatMoney(item.Precio)}
                            </td>

                            <td className={styles.numericCell}>
                              {formatMoney(item.Iva)}
                            </td>

                            <td className={styles.numericCell}>
                              <strong>
                                {formatMoney(item.Total)}
                              </strong>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={styles.detailSection}>
                <div className={styles.sectionHeader}>
                  <div>
                    <span className={styles.sectionEyebrow}>
                      Documentos
                    </span>

                    <h3>
                      <Paperclip size={19} />
                      Archivos adjuntos
                    </h3>
                  </div>

                  <span className={styles.countBadge}>
                    {adjuntos.length}
                  </span>
                </div>

                {adjuntos.length === 0 ? (
                  <div className={styles.noContent}>
                    No se cargaron archivos adjuntos.
                  </div>
                ) : (
                  <div className={styles.attachmentsGrid}>
                    {adjuntos.map((archivo) => (
                      <a
                        key={archivo.IdAdjunto}
                        href={archivo.WebUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.attachmentCard}
                        onClick={(event) => {
                          if (!archivo.WebUrl) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <div className={styles.attachmentIcon}>
                          <FileText size={21} />
                        </div>

                        <div className={styles.attachmentInfo}>
                          <strong>
                            {archivo.NombreArchivo || "Archivo"}
                          </strong>

                          <span>
                            {formatDate(archivo.FechaCarga)}
                          </span>
                        </div>

                        {archivo.WebUrl ? (
                          <ExternalLink size={18} />
                        ) : null}
                      </a>
                    ))}
                  </div>
                )}
              </section>

              <section className={styles.detailSection}>
                <div className={styles.sectionHeader}>
                  <div>
                    <span className={styles.sectionEyebrow}>
                      Flujo
                    </span>

                    <h3>
                      <History size={19} />
                      Historial de aprobación
                    </h3>
                  </div>
                </div>

                {historial.length === 0 ? (
                  <div className={styles.noContent}>
                    No existe historial de aprobación.
                  </div>
                ) : (
                  <div className={styles.timeline}>
                    {historial.map((item) => (
                      <div
                        key={item.IdAprobacion}
                        className={styles.timelineItem}
                      >
                        <div
                          className={`${styles.timelineDot} ${getStatusClass(
                            item.Decision
                          )}`}
                        />

                        <div className={styles.timelineContent}>
                          <div className={styles.timelineTop}>
                            <div>
                              <strong>
                                {item.Aprobador || "Sin asignar"}
                              </strong>
                              <span>{item.Nivel || "--"}</span>
                            </div>

                            <span
                              className={`${styles.statusBadge} ${getStatusClass(
                                item.Decision
                              )}`}
                            >
                              {item.Decision || "PENDIENTE"}
                            </span>
                          </div>

                          <small>
                            {formatDate(item.FechaDecision)}
                          </small>

                          {item.Comentario ? (
                            <p>{item.Comentario}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}