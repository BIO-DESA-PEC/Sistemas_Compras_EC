"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  listPreOCs,
  toggleFavoritePreOC,
  unifyPreOCs,
} from "@/app/lib/backend";
import styles from "./preorden.module.css";

const ESTADOS = [
  { value: "", label: "Todos" },
  { value: "BORRADOR", label: "BORRADOR" },
  { value: "GENERADA", label: "GENERADA" },
  { value: "SEPARADA", label: "SEPARADA" },
  { value: "APROBADA", label: "APROBADA" },
  { value: "UNIFICADA", label: "UNIFICADA" },
];

function fmtMoney(v) {
  return Number(v || 0).toLocaleString("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtFecha(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("es-EC", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isMensual(item) {
  return (
    String(item?.EsMensual || "N").toUpperCase() === "Y" ||
    !!item?.IdPlantillaMensual
  );
}

function canBeUnified(item) {
  const estado = (item?.Estado || "").toUpperCase();
  const mensual = isMensual(item);
  return mensual && (estado === "BORRADOR" || estado === "GENERADA");
}

function badgeClass(estado, css) {
  const e = (estado || "").toUpperCase();
  if (e === "BORRADOR") return `${css.badge} ${css.badgeDraft}`;
  if (e === "APROBADA") return `${css.badge} ${css.badgeApproved}`;
  if (e === "GENERADA") return `${css.badge} ${css.badgeGenerated}`;
  if (e === "SEPARADA") return `${css.badge} ${css.badgeSeparated}`;
  if (e === "UNIFICADA") return `${css.badge} ${css.badgeUnified}`;
  return css.badge;
}

export default function PreOrdenesPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [estado, setEstado] = useState("");
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");

  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const [selected, setSelected] = useState([]);
  const [savingUnify, setSavingUnify] = useState(false);

  const userId = session?.user?.id || session?.user?.Id || null;

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil((totalRows || 0) / pageSize));
  }, [totalRows, pageSize]);

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      const data = await listPreOCs({
        page,
        pageSize,
        estado,
        q,
        userId,
      });

      setItems(data?.items || []);
      setTotalRows(data?.totalRows || 0);

      // limpia selección si ya no está visible
      setSelected((prev) =>
        prev.filter((id) =>
          (data?.items || []).some((x) => x.IdPreOC === id && canBeUnified(x))
        )
      );
    } catch (e) {
      setError(e.message || "No se pudo cargar la bandeja.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [page, pageSize, estado, q, userId]);

  function onBuscar(e) {
    e.preventDefault();
    setPage(1);
    setQ(qInput.trim());
  }

  function toggleSelected(id, enabled) {
    if (!enabled) return;
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const visibleSelectableIds = useMemo(() => {
    return items.filter(canBeUnified).map((x) => x.IdPreOC);
  }, [items]);

  const allSelectableChecked =
    visibleSelectableIds.length > 0 &&
    visibleSelectableIds.every((id) => selected.includes(id));

  function toggleSelectAllVisible() {
    if (!visibleSelectableIds.length) return;

    if (allSelectableChecked) {
      setSelected((prev) =>
        prev.filter((id) => !visibleSelectableIds.includes(id))
      );
    } else {
      setSelected((prev) => Array.from(new Set([...prev, ...visibleSelectableIds])));
    }
  }

  async function onToggleFav(item) {
    if (!userId) {
      alert("No se pudo identificar el usuario actual.");
      return;
    }

    const favNext = !item.IsFavorita;

    try {
      await toggleFavoritePreOC(userId, item.IdPreOC, favNext);
      setItems((prev) =>
        prev.map((x) =>
          x.IdPreOC === item.IdPreOC ? { ...x, IsFavorita: favNext } : x
        )
      );
    } catch (e) {
      alert(e.message || "No se pudo actualizar favorita.");
    }
  }

  async function onUnificar() {
    if (selected.length < 2) {
  alert("Debes seleccionar al menos 2 Pre-Órdenes mensuales.");
  return;
}

const seleccionadas = items.filter((x) => selected.includes(x.IdPreOC));
const invalidas = seleccionadas.filter((x) => !canBeUnified(x));

  if (invalidas.length) {
    alert("Solo se pueden unificar Pre-Órdenes que vengan de solicitudes mensuales y estén en BORRADOR o GENERADA.");
    return;
  }

  const comentario = `Pre-Orden consolidada desde mensuales: ${selected.join(", ")}`;
   
  try {
      setSavingUnify(true);
      setMensaje("");
      const r = await unifyPreOCs(selected, comentario);

      if (!r?.IdPreOC) {
        throw new Error(r?.error || "No se pudo unificar.");
      }

      setMensaje("Pre-Órdenes unificadas correctamente.");
      setSelected([]);
      router.push(`/preordenes/${r.IdPreOC}`);
    } catch (e) {
      alert(e.message || "No se pudo unificar.");
    } finally {
      setSavingUnify(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.topHeader}>
        <div className={styles.headerCard}>
          <div>
            <h1 className={styles.pageTitle}>Pre-Órdenes</h1>
            <div className={styles.meta}>
              <span className={styles.metaItem}>
                Gestión de preórdenes y consolidación por proveedor
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <form className={styles.filtersBar} onSubmit={onBuscar}>
          <div className={styles.filtersLeft}>
            <input
              className={styles.searchInput}
              placeholder="Buscar por Id Pre-OC o Solicitud..."
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
            />

            <select
              className={styles.select}
              value={estado}
              onChange={(e) => {
                setPage(1);
                setEstado(e.target.value);
              }}
            >
              {ESTADOS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>

            <select
              className={styles.select}
              value={pageSize}
              onChange={(e) => {
                setPage(1);
                setPageSize(Number(e.target.value));
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>

            <button className={styles.secondary} type="submit">
              Buscar
            </button>
          </div>

          <div className={styles.right}>
            <button
              type="button"
              className={styles.primary}
              disabled={selected.length < 2 || savingUnify}
              onClick={onUnificar}
              title="Unificar únicamente Pre-Órdenes de solicitudes mensuales"
            >
              {savingUnify ? "Unificando..." : "Unificar seleccionadas"}
            </button>
          </div>
        </form>

        <div className={styles.selectionBar}>
          <label className={styles.selectionCheck}>
            <input
              type="checkbox"
              checked={allSelectableChecked}
              onChange={toggleSelectAllVisible}
            />
            <span>Seleccionar visibles aptas para unificar</span>
          </label>

          <div className={styles.selectionInfo}>
            Seleccionadas: <strong>{selected.length}</strong>
          </div>
        </div>

        {mensaje ? <div className={styles.successBox}>{mensaje}</div> : null}
        {error ? <div className={styles.errorBox}>{error}</div> : null}

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
              <th style={{ width: 52, textAlign: "center" }}>✓</th>
              <th style={{ width: 70 }}>Fav</th>
              <th>Pre-OC</th>
              <th>Solicitud</th>
              <th>Origen</th>
              <th>Fecha</th>
              <th>Solicitante</th>
              <th>Últ. aprobador</th>
              <th>Nivel</th>
              <th>Renglones</th>
              <th>Total</th>
              <th>Estado</th>
              <th style={{ width: 120 }}>Acciones</th>
            </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} className={styles.emptyCell}>
                    Cargando...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={13} className={styles.emptyCell}>
                    No hay registros.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
  const selectable = canBeUnified(item);
  const checked = selected.includes(item.IdPreOC);
  const mensual = isMensual(item);

  return (
    <tr key={item.IdPreOC}>
      <td style={{ textAlign: "center" }}>
        {selectable ? (
          <input
            type="checkbox"
            checked={checked}
            onChange={() =>
              toggleSelected(item.IdPreOC, selectable)
            }
            title="Seleccionar para unificar"
          />
        ) : (
          <span className={styles.noCheck}>—</span>
        )}
      </td>

                      <td>
                        <button
                          type="button"
                          className={styles.starBtn}
                          onClick={() => onToggleFav(item)}
                          title={
                            item.IsFavorita
                              ? "Quitar de favoritas"
                              : "Marcar como favorita"
                          }
                        >
                          {item.IsFavorita ? "★" : "☆"}
                        </button>
                      </td>

                      <td>#{item.IdPreOC}</td>
                      <td>#{item.IdSolicitud ?? "-"}</td>
                      <td>
  {mensual ? (
    <div className={styles.originWrap}>
      <span className={styles.monthlyBadge}>Mensual</span>
      {item.CategoriaMensual ? (
        <div className={styles.originSub}>{item.CategoriaMensual}</div>
      ) : null}
    </div>
  ) : (
    <span className={styles.normalOrigin}>Normal</span>
  )}
</td>
                      <td>{fmtFecha(item.FechaCreacion)}</td>
                      <td>{item.SolicitanteNombre || "-"}</td>
                      <td>{item.UltimoAprobadorNombre || "-"}</td>
                      <td>{item.UltimoNivelAprobacion || "-"}</td>
                      <td>{item.Renglones || 0}</td>
                      <td>{fmtMoney(item.Total)}</td>
                      <td>
                        <span className={badgeClass(item.Estado, styles)}>
                          {item.Estado || "-"}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/preordenes/${item.IdPreOC}`}
                          className={styles.linkBtn}
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.paginationBar}>
          <button
            className={styles.pageBtn}
            disabled={page <= 1}
            onClick={() => setPage(1)}
            type="button"
          >
            «
          </button>
          <button
            className={styles.pageBtn}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            type="button"
          >
            ‹
          </button>

          <span className={styles.pageInfo}>
            Página {page} de {totalPages} — {totalRows} registros
          </span>

          <button
            className={styles.pageBtn}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            type="button"
          >
            ›
          </button>
          <button
            className={styles.pageBtn}
            disabled={page >= totalPages}
            onClick={() => setPage(totalPages)}
            type="button"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}