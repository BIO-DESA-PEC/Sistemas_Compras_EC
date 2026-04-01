"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./reportes.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

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
    tipo: "solicitudes",
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

      if (!res.ok) throw new Error(json.error || "No se pudieron cargar filtros");
      setCatalogos(json);
    } catch (e) {
      setError(e.message || "Error cargando filtros");
    } finally {
      setLoading(false);
    }
  }

  async function loadData(currentFilters = filtros, currentPage = page, currentPageSize = pageSize) {
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

      const res = await fetch(`${API_BASE}/api/reportes?${qs.toString()}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "No se pudo cargar reporte");
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
      tipo: "solicitudes",
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

  function descargarPDF() {
    const qs = new URLSearchParams();

    Object.entries(filtros).forEach(([k, v]) => {
      if (v !== null && v !== undefined && String(v).trim() !== "") {
        qs.set(k, v);
      }
    });

    window.open(`${API_BASE}/api/reportes/pdf?${qs.toString()}`, "_blank");
  }

  const columns = useMemo(() => {
    if (!data.items?.length) return [];
    return Object.keys(data.items[0]);
  }, [data.items]);

  if (loading) return <div className={styles.wrapper}>Cargando...</div>;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1>Reportes</h1>
          <p>Consulta reportes de solicitudes, pre-órdenes y órdenes de compra.</p>
        </div>

        <button className={styles.pdfBtn} onClick={descargarPDF}>
          Descargar PDF
        </button>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.filtersCard}>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label>Tipo</label>
            <select name="tipo" value={filtros.tipo} onChange={handleChange}>
              {catalogos.tipos.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Fecha desde</label>
            <input type="date" name="fechaDesde" value={filtros.fechaDesde} onChange={handleChange} />
          </div>

          <div className={styles.field}>
            <label>Fecha hasta</label>
            <input type="date" name="fechaHasta" value={filtros.fechaHasta} onChange={handleChange} />
          </div>

          <div className={styles.field}>
            <label>Departamento</label>
            <select name="departamentoId" value={filtros.departamentoId} onChange={handleChange}>
              <option value="">Todos</option>
              {catalogos.departamentos.map((d) => (
                <option key={d.Id} value={d.Id}>{d.Nombre}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Usuario</label>
            <select name="usuarioId" value={filtros.usuarioId} onChange={handleChange}>
              <option value="">Todos</option>
              {catalogos.usuarios.map((u) => (
                <option key={u.Id} value={u.Id}>{u.Nombre}</option>
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
          <button className={styles.secondary} onClick={limpiarFiltros}>Limpiar</button>
        </div>
      </div>

      <div className={styles.kpis}>
        {Object.entries(data.kpis || {}).map(([k, v]) => (
          <div key={k} className={styles.kpi}>
            <span>{k}</span>
            <strong>{typeof v === "number" ? v.toLocaleString() : v}</strong>
          </div>
        ))}
      </div>

      <div className={styles.tableCard}>
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
                    {columns.map((c) => <th key={c}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row, idx) => (
                    <tr key={idx}>
                      {columns.map((c) => <td key={c}>{row[c] ?? ""}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.pagination}>
              <div className={styles.pageInfo}>
                Página {data.page || page} de {data.totalPages || 1} · {data.totalRows || 0} registros
              </div>

              <div className={styles.pageControls}>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPage(1);
                    setPageSize(Number(e.target.value));
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>

                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Anterior
                </button>

                <button
                  onClick={() => setPage((p) => Math.min(data.totalPages || 1, p + 1))}
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