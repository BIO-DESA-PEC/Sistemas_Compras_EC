"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Check,
  Eye,
  X,
} from "lucide-react";

import styles from "../aprobaciones.module.css";

import {
  postApprovalsDecide,
  getPendingApprovalDetail,
} from "@/app/lib/backend";

import AprobacionesClient from "../ui/AprobacionesClient";

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

export default function AprobacionesClient({
  initial = [],
  userId,
  pageSize = 15,
}) {
  const [rows, setRows] = useState(
    Array.isArray(initial) ? initial : []
  );

  const [selected, setSelected] = useState(
    () => new Set()
  );

  const [busyId, setBusyId] = useState(null);
  const [busyBulk, setBusyBulk] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] =
    useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailData, setDetailData] = useState(null);

  const [page, setPage] = useState(1);

  const totalPages = Math.max(
    1,
    Math.ceil(rows.length / pageSize)
  );

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;

    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function getApprovalId(row) {
    return (
      row.IdAprobacion ??
      row.ApprovalId ??
      row.Id
    );
  }

  function getSolicitudId(row) {
    return (
      row.IdSolicitud ??
      row.SolicitudId ??
      row.Id
    );
  }

  function getTotal(row) {
    return (
      row.Total ??
      row.MontoTotal ??
      row.total ??
      0
    );
  }

  function getDepto(row) {
    return (
      row.Departamento ??
      row.Depto ??
      "--"
    );
  }

  function getSolicitante(row) {
    return (
      row.SolicitadoPor ??
      row.Solicitante ??
      row.SolicitanteNombre ??
      "--"
    );
  }

  function getRenglones(row) {
    return (
      row.Renglones ??
      row.NumRenglones ??
      0
    );
  }

  function getCreacion(row) {
    return (
      row.FechaCreacionSoli ??
      row.FechaCreacion ??
      row.Creacion ??
      row.createdAt ??
      null
    );
  }

  function toggleSelect(row) {
    const approvalId = getApprovalId(row);

    if (!approvalId) return;

    setSelected((current) => {
      const next = new Set(current);

      if (next.has(approvalId)) {
        next.delete(approvalId);
      } else {
        next.add(approvalId);
      }

      return next;
    });
  }

  function toggleSelectPage() {
    const pageIds = pageRows
      .map(getApprovalId)
      .filter(Boolean);

    const allSelected =
      pageIds.length > 0 &&
      pageIds.every((id) => selected.has(id));

    setSelected((current) => {
      const next = new Set(current);

      pageIds.forEach((id) => {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });

      return next;
    });
  }

  async function openDetail(row) {
    const approvalId = getApprovalId(row);

    if (!approvalId) {
      alert("No se encontró el identificador de aprobación.");
      return;
    }

    try {
      setDetailOpen(true);
      setDetailLoading(true);
      setDetailError("");
      setDetailData(null);

      const data = await getPendingApprovalDetail(
        userId,
        approvalId
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

  async function decideOne(row, action) {
    const approvalId = getApprovalId(row);

    if (!approvalId) return;

    let comentario = "";

    if (action === "REJECT") {
      comentario =
        window.prompt(
          "Escribe el motivo del rechazo:",
          ""
        ) || "";

      if (!comentario.trim()) {
        alert(
          "Debes ingresar un comentario para rechazar la solicitud."
        );
        return;
      }
    }

    const message =
      action === "APPROVE"
        ? "¿Estás seguro de aprobar esta solicitud?"
        : "¿Estás seguro de rechazar esta solicitud?";

    if (!window.confirm(message)) return;

    try {
      setBusyId(approvalId);

      await postApprovalsDecide(
        userId,
        [approvalId],
        action,
        comentario
      );

      setRows((current) =>
        current.filter(
          (item) =>
            getApprovalId(item) !== approvalId
        )
      );

      setSelected((current) => {
        const next = new Set(current);
        next.delete(approvalId);
        return next;
      });
    } catch (error) {
      console.error(error);

      alert(
        error?.message ||
          "No se pudo completar la acción."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function decideSelected(action) {
    const ids = Array.from(selected);

    if (ids.length === 0) {
      alert("Selecciona al menos una solicitud.");
      return;
    }

    let comentario = "";

    if (action === "REJECT") {
      comentario =
        window.prompt(
          "Escribe el motivo del rechazo para las solicitudes seleccionadas:",
          ""
        ) || "";

      if (!comentario.trim()) {
        alert(
          "Debes ingresar un comentario para rechazar."
        );
        return;
      }
    }

    const message =
      action === "APPROVE"
        ? `¿Aprobar las ${ids.length} solicitudes seleccionadas?`
        : `¿Rechazar las ${ids.length} solicitudes seleccionadas?`;

    if (!window.confirm(message)) return;

    try {
      setBusyBulk(true);

      await postApprovalsDecide(
        userId,
        ids,
        action,
        comentario
      );

      setRows((current) =>
        current.filter(
          (item) =>
            !selected.has(getApprovalId(item))
        )
      );

      setSelected(new Set());
    } catch (error) {
      console.error(error);

      alert(
        error?.message ||
          "No se pudo completar la acción masiva."
      );
    } finally {
      setBusyBulk(false);
    }
  }

  const currentPageIds = pageRows
    .map(getApprovalId)
    .filter(Boolean);

  const allPageSelected =
    currentPageIds.length > 0 &&
    currentPageIds.every((id) =>
      selected.has(id)
    );

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <span className={styles.cardEyebrow}>
              Aprobaciones
            </span>

            <h2 className={styles.cardTitle}>
              Solicitudes pendientes
            </h2>

            <p className={styles.cardDescription}>
              Revisa todo el detalle antes de aprobar o
              rechazar una solicitud.
            </p>
          </div>

          <div className={styles.resultCount}>
            {rows.length} pendientes
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.selectedInfo}>
            {selected.size > 0
              ? `${selected.size} seleccionada${
                  selected.size === 1 ? "" : "s"
                }`
              : "Selecciona solicitudes para acciones masivas"}
          </div>

          <div className={styles.toolbarActions}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() =>
                decideSelected("APPROVE")
              }
              disabled={
                busyBulk || selected.size === 0
              }
            >
              <Check size={17} />

              {busyBulk
                ? "Procesando..."
                : "Aprobar seleccionadas"}
            </button>

            <button
              type="button"
              className={styles.btnDanger}
              onClick={() =>
                decideSelected("REJECT")
              }
              disabled={
                busyBulk || selected.size === 0
              }
            >
              <X size={17} />

              {busyBulk
                ? "Procesando..."
                : "Rechazar seleccionadas"}
            </button>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.checkboxColumn}>
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectPage}
                    aria-label="Seleccionar página"
                  />
                </th>

                <th># Solicitud</th>
                <th>Solicitado por</th>
                <th>Departamento</th>
                <th>Creación</th>
                <th>Renglones</th>
                <th>Total</th>

                <th className={styles.actionsHeader}>
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className={styles.empty}
                  >
                    No hay aprobaciones pendientes.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => {
                  const approvalId =
                    getApprovalId(row);

                  const solicitudId =
                    getSolicitudId(row);

                  const isBusy =
                    busyId === approvalId ||
                    busyBulk;

                  const isChecked =
                    selected.has(approvalId);

                  const solicitante =
                    getSolicitante(row);

                  return (
                    <tr
                      key={
                        approvalId ??
                        solicitudId
                      }
                    >
                      <td
                        className={
                          styles.checkboxColumn
                        }
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() =>
                            toggleSelect(row)
                          }
                          disabled={isBusy}
                          aria-label={`Seleccionar solicitud ${solicitudId}`}
                        />
                      </td>

                      <td>
                        <span
                          className={
                            styles.requestNumber
                          }
                        >
                          #{solicitudId}
                        </span>
                      </td>

                      <td>
                        <div
                          className={
                            styles.personCell
                          }
                        >
                          <div
                            className={
                              styles.personAvatar
                            }
                          >
                            {String(
                              solicitante || "S"
                            )
                              .trim()
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <strong>
                            {solicitante}
                          </strong>
                        </div>
                      </td>

                      <td>{getDepto(row)}</td>

                      <td>
                        {formatDate(
                          getCreacion(row)
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            styles.linesBadge
                          }
                        >
                          {getRenglones(row)}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {formatMoney(
                            getTotal(row)
                          )}
                        </strong>
                      </td>

                      <td>
                        <div
                          className={
                            styles.rowActions
                          }
                        >
                          <button
                            type="button"
                            className={
                              styles.btnViewIcon
                            }
                            onClick={() =>
                              openDetail(row)
                            }
                            disabled={isBusy}
                            title="Ver detalle"
                          >
                            <Eye size={18} />
                          </button>

                          <button
                            type="button"
                            className={
                              styles.btnApproveSmall
                            }
                            onClick={() =>
                              decideOne(
                                row,
                                "APPROVE"
                              )
                            }
                            disabled={isBusy}
                          >
                            <Check size={17} />
                            {isBusy
                              ? "..."
                              : "Aprobar"}
                          </button>

                          <button
                            type="button"
                            className={
                              styles.btnRejectSmall
                            }
                            onClick={() =>
                              decideOne(
                                row,
                                "REJECT"
                              )
                            }
                            disabled={isBusy}
                          >
                            <X size={17} />
                            {isBusy
                              ? "..."
                              : "Rechazar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            Página {page} de {totalPages}
          </span>

          <div className={styles.paginationButtons}>
            <button
              type="button"
              onClick={() =>
                setPage((current) =>
                  Math.max(1, current - 1)
                )
              }
              disabled={page <= 1}
            >
              ‹
            </button>

            <button
              type="button"
              onClick={() =>
                setPage((current) =>
                  Math.min(
                    totalPages,
                    current + 1
                  )
                )
              }
              disabled={page >= totalPages}
            >
              ›
            </button>
          </div>
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