"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./reportes.module.css";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "https://compras-back-ec-prod.onrender.com";

export default function ReportesClient() {
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState("");

  const [catalogos, setCatalogos] = useState({
    departamentos: [],
    usuarios: [],
    tipos: [],
  });

  const [filtros, setFiltros] = useState({
    tipo: "flujo",
    fechaDesde: "",
    fechaHasta: "",
    departamentoId: "",
    usuarioId: "",
    estado: "",
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [data, setData] = useState({
    kpis: {},
    items: [],
    totalRows: 0,
    totalPages: 1,
  });

  async function loadCatalogos() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/reportes/filtros`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "No se pudieron cargar filtros");
      }

      setCatalogos(json);
    } catch (e) {
      setError(e.message || "Error cargando filtros");
    } finally {
      setLoading(false);
    }
  }

  async function loadData(
    currentFilters = filtros,
    currentPage = page,
    currentPageSize = pageSize
  ) {
    setLoadingData(true);
    setError("");

    try {
      const qs = new URLSearchParams();

      Object.entries(currentFilters).forEach(([k, v]) => {
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          qs.set(k, v);
        }
      });

      qs.set("page", currentPage);
      qs.set("pageSize", currentPageSize);

      const endpoint =
        currentFilters.tipo === "flujo"
          ? "/api/reportes/flujo"
          : "/api/reportes";

      const res = await fetch(`${API_BASE}${endpoint}?${qs.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "No se pudo cargar reporte");
      }

      setData(json);
    } catch (e) {
      setError(e.message || "Error cargando reporte");
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    loadCatalogos();
  }, []);

  useEffect(() => {
    loadData(filtros, page, pageSize);
  }, [page, pageSize]);

  function handleChange(e) {
    const { name, value } = e.target;
    setFiltros((prev) => ({ ...prev, [name]: value }));
  }

  function aplicarFiltros() {
    setPage(1);
    loadData(filtros, 1, pageSize);
  }

  function limpiarFiltros() {
    const clean = {
      tipo: "flujo",
      fechaDesde: "",
      fechaHasta: "",
      departamentoId: "",
      usuarioId: "",
      estado: "",
    };

    setFiltros(clean);
    setPage(1);
    loadData(clean, 1, pageSize);
  }

  function buildQueryString() {
    const qs = new URLSearchParams();

    Object.entries(filtros).forEach(([k, v]) => {
      if (v !== null && v !== undefined && String(v).trim() !== "") {
        qs.set(k, v);
      }
    });

    return qs.toString();
  }

  function descargarPDF() {
  const qs = buildQueryString();
  window.open(`${API_BASE}/api/reportes/flujo/pdf?${qs}`, "_blank");
}

function descargarExcel() {
  const qs = buildQueryString();
  window.open(`${API_BASE}/api/reportes/flujo/excel?${qs}`, "_blank");
}

  function formatKpiLabel(key) {
    const labels = {
      totalFlujos: "Total flujos",
      conPreOrden: "Con preorden",
      conOrdenCompra: "Con orden de compra",
      conFactura: "Con factura",
      montoTotalOC: "Monto total OC",

      totalRegistros: "Total registros",
      totalMonto: "Monto total",
      pendientes: "Pendientes",
      aprobadas: "Aprobadas",
      rechazadas: "Rechazadas",
      borrador: "Borrador",
      separadas: "Separadas",
      generadas: "Generadas",
      procesadas: "Procesadas",
      anuladas: "Anuladas",
    };

    return labels[key] || key;
  }

  function formatKpiValue(key, value) {
    if (key.toLowerCase().includes("monto")) {
      return `$ ${Number(value || 0).toLocaleString("es-EC", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }

    return Number(value || 0).toLocaleString("es-EC");
  }

  function getKpiIcon(key) {
    const k = key.toLowerCase();

    if (k.includes("monto")) return "$";
    if (k.includes("factura")) return "F";
    if (k.includes("orden")) return "OC";
    if (k.includes("pre")) return "PO";
    if (k.includes("total")) return "#";

    return "✓";
  }

  function formatColumnLabel(column) {
    const labels = {
      IdSolicitud: "ID Solicitud",
      Solicitud: "Solicitud",
      EstadoSolicitud: "Estado solicitud",
      FechaSolicitud: "Fecha solicitud",
      FechaAprobacion: "Fecha aprobación",
      PreOrden: "Preorden",
      EstadoPreOrden: "Estado preorden",
      FechaPreOrden: "Fecha preorden",
      OrdenCompra: "Orden compra",
      EstadoOC: "Estado OC",
      FechaOC: "Fecha OC",
      Departamento: "Departamento",
      Usuario: "Usuario",
      MontoOC: "Monto OC",
      RenglonesOC: "Renglones OC",
      DocEntrySAP: "DocEntry SAP",
      Establecimiento: "Establecimiento",
      PuntoEmision: "Punto emisión",
      Secuencial: "Secuencial",
      FacturaSAP: "Factura SAP",
    };

    return labels[column] || column;
  }

  function formatCellValue(column, value) {
    if (value === null || value === undefined || value === "") return "—";

    if (column.toLowerCase().includes("monto")) {
      return `$ ${Number(value || 0).toLocaleString("es-EC", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }

    if (column.toLowerCase().includes("fecha")) {
      const clean = String(value).replace("T", " ");
      return clean.length > 19 ? clean.slice(0, 19) : clean;
    }

    return value;
  }

  function getEstadoClass(value) {
    const estado = String(value || "").trim().toUpperCase();

    if (estado.includes("APROBADA") || estado.includes("PROCESADA")) {
      return styles.badgeSuccess;
    }

    if (estado.includes("PENDIENTE") || estado.includes("BORRADOR")) {
      return styles.badgeWarning;
    }

    if (estado.includes("RECHAZADA") || estado.includes("ANULADA")) {
      return styles.badgeDanger;
    }

    if (estado.includes("GENERADA") || estado.includes("SEPARADA")) {
      return styles.badgeInfo;
    }

    return styles.badgeNeutral;
  }

  const columns = useMemo(() => {
    if (!data.items?.length) return [];
    return Object.keys(data.items[0]);
  }, [data.items]);

  const totalActual = data.totalRows || 0;

  if (loading) {
    return <div className={styles.wrapper}>Cargando...</div>;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Módulo de compras</span>
          <h1>Reportería ejecutiva</h1>
          <p>
            Consulta el flujo completo de solicitudes, preórdenes, órdenes de
            compra, datos SAP y facturación.
          </p>
        </div>

        <div className={styles.exportActions}>
          <button className={styles.excelBtn} onClick={descargarExcel}>
            Descargar Excel
          </button>

          <button className={styles.pdfBtn} onClick={descargarPDF}>
            Descargar PDF
          </button>
        </div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.filtersCard}>
        <div className={styles.filtersHeader}>
          <div>
            <h2>Filtros de consulta</h2>
            <p>Selecciona los parámetros para generar el reporte.</p>
          </div>

          <span className={styles.resultBadge}>
            {totalActual.toLocaleString("es-EC")} registros
          </span>
        </div>

        <div className={styles.grid}>
          <div className={styles.field}>
            <label>Tipo</label>
            <select name="tipo" value={filtros.tipo} onChange={handleChange}>
              {catalogos.tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Fecha desde</label>
            <input
              type="date"
              name="fechaDesde"
              value={filtros.fechaDesde}
              onChange={handleChange}
            />
          </div>

          <div className={styles.field}>
            <label>Fecha hasta</label>
            <input
              type="date"
              name="fechaHasta"
              value={filtros.fechaHasta}
              onChange={handleChange}
            />
          </div>

          <div className={styles.field}>
            <label>Departamento</label>
            <select
              name="departamentoId"
              value={filtros.departamentoId}
              onChange={handleChange}
            >
              <option value="">Todos</option>
              {catalogos.departamentos.map((d) => (
                <option key={d.Id} value={d.Id}>
                  {d.Nombre}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Usuario</label>
            <select
              name="usuarioId"
              value={filtros.usuarioId}
              onChange={handleChange}
            >
              <option value="">Todos</option>
              {catalogos.usuarios.map((u) => (
                <option key={u.Id} value={u.Id}>
                  {u.Nombre}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Estado</label>
            <input
              type="text"
              name="estado"
              value={filtros.estado}
              onChange={handleChange}
              placeholder="Ej: PENDIENTE, APROBADA..."
            />
          </div>
        </div>

        <div className={styles.actions}>
          <button onClick={aplicarFiltros}>Consultar</button>
          <button className={styles.secondary} onClick={limpiarFiltros}>
            Limpiar
          </button>
        </div>
      </div>

      <div className={styles.kpis}>
        {Object.entries(data.kpis || {}).map(([k, v]) => (
          <div key={k} className={styles.kpi}>
            <div className={styles.kpiIcon}>{getKpiIcon(k)}</div>

            <div>
              <span>{formatKpiLabel(k)}</span>
              <strong>{formatKpiValue(k, v)}</strong>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <div>
            <h2>Detalle del reporte</h2>
            <p>
              Información detallada según los filtros seleccionados y el tipo de
              reporte.
            </p>
          </div>
        </div>

        {loadingData ? (
          <div className={styles.loading}>Cargando reporte...</div>
        ) : !data.items?.length ? (
          <div className={styles.empty}>No hay información para mostrar.</div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th key={c}>{formatColumnLabel(c)}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {data.items.map((row, idx) => (
                    <tr key={idx}>
                      {columns.map((c) => {
                        const isEstado = c.toLowerCase().includes("estado");

                        return (
                          <td key={c}>
                            {isEstado ? (
                              <span
                                className={`${styles.badge} ${getEstadoClass(
                                  row[c]
                                )}`}
                              >
                                {formatCellValue(c, row[c])}
                              </span>
                            ) : (
                              formatCellValue(c, row[c])
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.pagination}>
              <div className={styles.pageInfo}>
                Página {data.page || page} de {data.totalPages || 1} ·{" "}
                {(data.totalRows || 0).toLocaleString("es-EC")} registros
              </div>

              <div className={styles.pageControls}>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPage(1);
                    setPageSize(Number(e.target.value));
                  }}
                >
                  <option value={10}>10 filas</option>
                  <option value={20}>20 filas</option>
                  <option value={50}>50 filas</option>
                </select>

                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Anterior
                </button>

                <button
                  onClick={() =>
                    setPage((p) => Math.min(data.totalPages || 1, p + 1))
                  }
                  disabled={page >= (data.totalPages || 1)}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}