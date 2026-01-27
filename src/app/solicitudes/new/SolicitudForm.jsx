'use client';

import { useEffect, useMemo, useState } from "react";
import styles from "./new.module.css";
import { Plus, Trash2, Check, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

function emptyRow() {
  return {
    NumeroArticulo: "",
    Descripcion: "",
    FechaNecesaria: "",
    Cantidad: 1,
  };
}

export default function SolicitudForm({
  user,
  mode = "create",            // "create" | "edit" | "view"
  initial = null,             // { cabecera, detalle } para editar/ver
  lockReason = null,          // texto cuando está bloqueado
}) {
  const router = useRouter();

  const isCreate = mode === "create";
  const isEdit   = mode === "edit";
  const isView   = mode === "view";

  // Tipo de requerimiento: "ARTICULO" | "SERVICIO"
  const [tipo, setTipo] = useState("ARTICULO");

  const [rows, setRows] = useState([emptyRow()]);
  const [sending, setSending] = useState(false);
  const [okId, setOkId] = useState(initial?.cabecera?.IdSolicitud ?? null);
  const [errorMsg, setErrorMsg] = useState("");
  const [comentarios, setComentarios] = useState(initial?.cabecera?.Comentarios ?? "");

  // ✅ ===== ROLES (según tu endpoint by-email) =====
  // user.RolNombre viene como: "Administrador", "Compras", "Usuario", "Contabilidad", etc.
  const rolNombre = useMemo(() => {
    const r = (user?.RolNombre || "").trim();
    return r;
  }, [user]);

  // ✅ Solo estos roles pueden auto-aprobar y crear OC
  const puedeCrearOC = useMemo(() => {
    const r = rolNombre.toUpperCase();
    return r === "ADMINISTRADOR" || r === "COMPRAS";
  }, [rolNombre]);
  // ✅ ============================================

  // Precarga cuando viene "initial"
  useEffect(() => {
  if (initial?.cabecera?.Tipo) {
    setTipo((initial.cabecera.Tipo || "ARTICULO").toUpperCase());
  }
  if (initial?.detalle?.length) {
    setRows(
      initial.detalle.map((d) => ({
        NumeroArticulo: d.NumeroArticulo ?? "",
        Descripcion: d.Descripcion ?? "",
        FechaNecesaria: (d.FechaNecesaria || "").slice(0, 10),
        Cantidad: d.Cantidad ?? 1,
      }))
    );
  }
}, [initial]);

  // Si cambian a SERVICIO, normalizamos Cantidad=1 y vaciamos FechaNecesaria (oculta)
  useEffect(() => {
    if (tipo === "SERVICIO") {
      setRows(prev => prev.map(r => ({
        ...r,
        Cantidad: 1,
        FechaNecesaria: "",
      })));
    }
  }, [tipo]);

  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  // Total páginas según filas
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  }, [rows.length]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  const pageStart = (page - 1) * PAGE_SIZE;
  const pageRows = rows.slice(pageStart, pageStart + PAGE_SIZE);

  const setRow = (i, patch) => {
    setRows(prev => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  const addRow = () =>
  setRows(prev => {
    const lastFecha =
      [...prev].reverse().find(r => (r.FechaNecesaria || "").trim())?.FechaNecesaria || "";

    const newRow = { ...emptyRow(), FechaNecesaria: (tipo === "ARTICULO" ? lastFecha : "") };
    if (tipo === "SERVICIO") newRow.Cantidad = 1;

    const next = [...prev, newRow];

    // ✅ saltar a la última página
    const lastPage = Math.max(1, Math.ceil(next.length / PAGE_SIZE));
    setPage(lastPage);

    return next;
  });

  const removeRow = (i) =>
    setRows(prev => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i));

  const validate = () => {
    if (isView) return ""; // no valida en solo lectura
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      // Nombre (Artículo o Servicio)
      if (!r.NumeroArticulo?.trim())
        return `Fila ${i + 1}: falta ${tipo === "SERVICIO" ? "Nombre del servicio" : "Artículo/Servicio"}`;

      if (!r.Descripcion?.trim())
        return `Fila ${i + 1}: falta Descripción`;

      if (tipo === "ARTICULO") {
        if (!r.FechaNecesaria) return `Fila ${i + 1}: falta Fecha Necesaria`;
        if ((Number(r.Cantidad) || 0) <= 0) return `Fila ${i + 1}: Cantidad debe ser > 0`;
      }
    }
    return "";
  };

  // submit(action): "approval" | "auto"
  const submit = async (e, action = "approval") => {
    e.preventDefault();
    if (isView) return;
    setErrorMsg("");

    const v = validate();
    if (v) { setErrorMsg(v); return; }

    // ✅ Seguridad UI: si NO puede crear OC, bloqueamos action="auto"
    if (action === "auto" && !puedeCrearOC) {
      setErrorMsg("No autorizado: tu rol no puede aprobar y crear OC.");
      return;
    }

    setSending(true);
    try {
      const detalle = rows.map(r => {
        if (tipo === "SERVICIO") {
          return {
            NumeroArticulo: r.NumeroArticulo.trim(), // nombre del servicio
            Descripcion: r.Descripcion.trim(),
            FechaNecesaria: null,   // no aplica
            Cantidad: 1,            // fijo en 1
          };
        }
        // ARTÍCULO
        return {
          NumeroArticulo: r.NumeroArticulo.trim(),
          Descripcion: r.Descripcion.trim(),
          FechaNecesaria: r.FechaNecesaria,
          Cantidad: Number(r.Cantidad),
        };
      });

      const autoApprove = action === "auto";

      if (isCreate) {
        const payload = {
          cabecera: {
            IdUsuario: user.IdUsuario,
            DepartamentoId: user.DepartamentoId,
            Tipo: tipo,
             Comentarios: comentarios?.trim() || "",
          },
          detalle,
          autoApprove,
        };

        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/solicitudes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const newId = data.IdSolicitud || data.id || data.solicitudId || null;
        setOkId(newId);
        router.push("/solicitudes");
        return;
      }

      if (isEdit && initial?.cabecera?.IdSolicitud) {
        const id = initial.cabecera.IdSolicitud;
        const payload = { detalle, autoApprove, Tipo: tipo, Comentarios: comentarios?.trim() || "" };
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/solicitudes/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
        router.push("/solicitudes");
        return;
      }
    } catch (err) {
      setErrorMsg(String(err?.message || err));
    } finally {
      setSending(false);
    }
  };

  const disabledAll = isView || sending;

  // Datos de meta (cabecera visual)
  const metaId     = okId ?? initial?.cabecera?.IdSolicitud ?? null;
  const metaCodigo = initial?.cabecera?.Codigo ?? null;
  const metaEstado = isCreate ? "PENDIENTE" : (initial?.cabecera?.Estado ?? "—");
  const metaFecha  = isCreate
    ? new Date().toISOString().slice(0, 10)
    : (initial?.cabecera?.FechaCreacionSoli ?? "—");
  const metaDepto  = user.DeptoNombre ?? initial?.cabecera?.Departamento ?? user.DepartamentoId;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {isCreate ? "Nueva" : isEdit ? "Editar" : "Solicitud"} de compra
          </h1>
          <div className={styles.sub}>
            Solicitante: <b>{user.Nombre}</b> — Depto: <b>{metaDepto}</b>
            {/* opcional para debug */}
            {/* <span style={{ marginLeft: 10, opacity: 0.7 }}>Rol: {rolNombre || "—"}</span> */}
          </div>
        </div>
      </div>

      {/* Selector de tipo */}
      <div className={styles.row}>
        <label className={styles.label}>Tipo de requerimiento</label>
        <div className={styles.chips}>
          <button
            type="button"
            className={`${styles.chip} ${tipo === "ARTICULO" ? styles.chipActive : ""}`}
            onClick={() => setTipo("ARTICULO")}
            disabled={disabledAll}
          >
            Artículo
          </button>
          <button
            type="button"
            className={`${styles.chip} ${tipo === "SERVICIO" ? styles.chipActive : ""}`}
            onClick={() => setTipo("SERVICIO")}
            disabled={disabledAll}
          >
            Servicio
          </button>
        </div>
      </div>

      {/* Cabecera visual */}
      <div className={styles.meta}>
        <div>
          <span>Código</span>
          <b>{metaCodigo || (metaId ? `#${metaId}` : "—")}</b>
        </div>
        <div><span>Solicitante</span><b>{user.Nombre}</b></div>
        <div><span>Departamento</span><b>{metaDepto}</b></div>
        <div><span>Estado</span><b>{metaEstado}</b></div>
        <div><span>Fecha creación</span><b>{metaFecha}</b></div>
      </div>

      {/* Alertas */}
      {!!errorMsg && (
        <div className={`${styles.alert} ${styles.error}`}>
          <AlertCircle size={16}/> {errorMsg}
        </div>
      )}
      {!!okId && isCreate && (
        <div className={`${styles.alert} ${styles.success}`}>
          <Check size={16}/> Solicitud creada <b>#{okId}</b>.
        </div>
      )}
      {isView && lockReason && (
        <div className={`${styles.alert} ${styles.error}`}>
          <AlertCircle size={16}/> {lockReason}
        </div>
      )}

      <form onSubmit={(e) => submit(e)} className={styles.form}>
        {/* Encabezado de grilla */}
        <div className={styles.gridHead}>
          <div>#</div>
          <div>{tipo === "SERVICIO" ? "Nombre del servicio" : "Artículo"}</div>
          <div>Descripción</div>
          {tipo === "ARTICULO" && <div>Fecha necesaria</div>}
          {tipo === "ARTICULO" && <div>Cant.</div>}
          <div></div>
        </div>
        {/* Filas */}
        {pageRows.map((r, localIdx) => {
  const i = pageStart + localIdx; // índice real en rows

  return (
    <div className={styles.gridRow} key={i}>
      <div className={styles.mono}>#{i + 1}</div>

      <input
        className={styles.input}
        disabled={disabledAll}
        value={r.NumeroArticulo}
        onChange={e => setRow(i, { NumeroArticulo: e.target.value })}
        placeholder={tipo === "SERVICIO" ? "Mantenimiento preventivo" : "AF-1001"}
      />

      <textarea
        className={styles.input}
        disabled={disabledAll}
        value={r.Descripcion}
        onChange={e => setRow(i, { Descripcion: e.target.value })}
        placeholder="Describe el artículo o servicio solicitado…"
        rows={1}
      />

      {tipo === "ARTICULO" && (
        <input
          className={styles.input}
          type="date"
          disabled={disabledAll}
          value={r.FechaNecesaria}
          onChange={e => setRow(i, { FechaNecesaria: e.target.value })}
        />
      )}

      {tipo === "ARTICULO" && (
        <input
          className={styles.input}
          type="number" min="1" step="1"
          disabled={disabledAll}
          value={r.Cantidad}
          onChange={e => setRow(i, { Cantidad: e.target.value })}
        />
      )}

      {!disabledAll && (
        <button
          type="button"
          className={styles.iconBtn}
          onClick={() => removeRow(i)}
          title="Eliminar"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
})}
{/* ✅ Paginador */}
{rows.length > PAGE_SIZE && (
  <div className={styles.pager}>
    <div className={styles.pagerInfo}>
      Mostrando <b>{pageStart + 1}</b>–<b>{Math.min(pageStart + PAGE_SIZE, rows.length)}</b> de <b>{rows.length}</b>
    </div>

    <div className={styles.pagerBtns}>
      <button
        type="button"
        className={styles.pagerBtn}
        disabled={disabledAll || page === 1}
        onClick={() => setPage(1)}
      >
        «
      </button>

      <button
        type="button"
        className={styles.pagerBtn}
        disabled={disabledAll || page === 1}
        onClick={() => setPage(p => Math.max(1, p - 1))}
      >
        Anterior
      </button>

      <div className={styles.pagerPage}>
        Página <b>{page}</b> / <b>{totalPages}</b>
      </div>

      <button
        type="button"
        className={styles.pagerBtn}
        disabled={disabledAll || page === totalPages}
        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
      >
        Siguiente
      </button>

      <button
        type="button"
        className={styles.pagerBtn}
        disabled={disabledAll || page === totalPages}
        onClick={() => setPage(totalPages)}
      >
        »
      </button>
    </div>
  </div>
)}

        {!disabledAll && (
          <div className={styles.toolbar}>
            <button type="button" onClick={addRow} className={styles.secondary}>
              <Plus size={16} /> Agregar renglón
            </button>
            {tipo === "SERVICIO" && (
              <div className={styles.note}>
                * Para servicios, la cantidad se asume como 1 y la fecha no aplica.
              </div>
            )}
          </div>
        )}

        {/* ✅ Acciones (según rol) */}
        <div className={styles.actions}>
  {!isView && (
    <>
      {/* ✅ SIEMPRE: Enviar para aprobación */}
      <button
        type="button"
        className={styles.primary}
        disabled={sending}
        onClick={(e) => submit(e, "approval")}
        title="Enviar para aprobación (manda correo al aprobador)"
      >
        {sending ? "Enviando..." : "Enviar para aprobación"}
      </button>

      {/* ✅ SOLO ADMINISTRADOR / COMPRAS: botón extra para crear OC */}
      {puedeCrearOC && (
        <button
          type="button"
          className={styles.secondary}
          disabled={sending}
          onClick={(e) => submit(e, "auto")}
          title="Aprueba automáticamente y crea la OC"
        >
          {sending ? "Procesando..." : "Enviar (aprobar y crear OC)"}
        </button>
      )}
    </>
  )}

  {/* ✅ Cancelar siempre */}
  <button
    type="button"
    className={styles.ghost}
    onClick={() => router.push("/solicitudes")}
  >
    {isView ? "Volver al listado" : "Cancelar"}
  </button>
</div>
<div className={styles.row}>
  <label className={styles.label}>Comentarios</label>
  <textarea
    className={styles.input}
    rows={3}
    disabled={disabledAll}
    value={comentarios}
    onChange={(e) => setComentarios(e.target.value)}
    placeholder="Observaciones adicionales…"
  />
</div>
      </form>
    </div>
  );
}
