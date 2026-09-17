"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "../../../solicitudes/list.module.css";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "https://compras-back-ec-prod.onrender.com";

function fmtFechaHora(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" });
}

function SeccionEstado({ titulo, opciones, estadoActual, observacionActual, fechaActual, usuarioActual, onGuardar }) {
  const [estado, setEstado] = useState(opciones[0]);
  const [observacion, setObservacion] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);

  const guardar = async (e) => {
    e.preventDefault();
    setMsg("");
    setOk(false);
    setLoading(true);
    try {
      await onGuardar(estado, observacion);
      setObservacion("");
      setOk(true);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.card} style={{ padding: 24, marginBottom: 20 }}>
      <h2 style={{ marginTop: 0 }}>{titulo}</h2>

      {estadoActual && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: "#f1f5f9", fontSize: 14 }}>
          <div><b>Estado actual:</b> {estadoActual}</div>
          {observacionActual && <div><b>Última observación:</b> {observacionActual}</div>}
          {fechaActual && (
            <div>
              <b>Última actualización:</b> {fmtFechaHora(fechaActual)}
              {usuarioActual ? ` — ${usuarioActual}` : ""}
            </div>
          )}
        </div>
      )}

      <form onSubmit={guardar}>
        <label style={{ display: "block", marginBottom: 14 }}>
          <b>Nuevo estado</b>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            style={{
              width: "100%",
              marginTop: 8,
              padding: 12,
              borderRadius: 10,
              border: "1px solid #cbd5e1",
            }}
          >
            {opciones.map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
        </label>

        <label style={{ display: "block", marginBottom: 14 }}>
          <b>Observación</b>
          <textarea
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            placeholder="Ingrese una observación..."
            style={{
              width: "100%",
              minHeight: 90,
              marginTop: 8,
              padding: 12,
              borderRadius: 10,
              border: "1px solid #cbd5e1",
            }}
          />
        </label>

        <button className={styles.btn} type="submit" disabled={loading}>
          {loading ? "Guardando..." : "Guardar"}
        </button>

        {ok && (
          <div style={{ marginTop: 14, color: "#16a34a", fontWeight: 600 }}>
            Estado actualizado correctamente.
          </div>
        )}
        {msg && (
          <div style={{ marginTop: 14, color: "red", fontWeight: 600 }}>
            {msg}
          </div>
        )}
      </form>
    </div>
  );
}

export default function EstadoAnticipoForm({ id, user }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [anticipo, setAnticipo] = useState(null);
  const [error, setError] = useState("");

  const rol = (user?.RolNombre || "").toUpperCase();
  const puedeAdministrativo = rol === "COMPRAS" || rol === "ADMINISTRADOR";
  const puedeContabilidad = rol === "CONTABILIDAD" || rol === "ADMINISTRADOR";

  // El botón que trae al usuario aquí ya indica qué sección quiere cambiar
  // (?depto=administrativo|contabilidad). Sin ese parámetro (acceso directo
  // a la URL) se muestran todas las secciones que el rol permita, como antes.
  const depto = (searchParams.get("depto") || "").toLowerCase();
  const esCompras = depto === "administrativo" ? puedeAdministrativo : depto === "contabilidad" ? false : puedeAdministrativo;
  const esContabilidad = depto === "contabilidad" ? puedeContabilidad : depto === "administrativo" ? false : puedeContabilidad;

  const cargar = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/anticipos/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo cargar el anticipo.");
      setAnticipo(data);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const guardarEstado = async (path, estado, observacion) => {
    const res = await fetch(`${API_BASE}/api/anticipos/${id}/${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Estado: estado,
        Observacion: observacion,
        UsuarioId: user?.IdUsuario,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "No se pudo cambiar el estado.");

    await cargar();
    router.refresh();
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          Cambiar estado del anticipo {anticipo?.Codigo ? `— ${anticipo.Codigo}` : ""}
        </h1>

        <div className={styles.filters}>
          <a className={styles.chip} href="/anticipos">
            Volver
          </a>
        </div>
      </div>

      {error && (
        <div className={styles.card} style={{ padding: 24, color: "red" }}>
          {error}
        </div>
      )}

      {!error && !anticipo && (
        <div className={styles.card} style={{ padding: 24 }}>Cargando...</div>
      )}

      {anticipo && !esCompras && !esContabilidad && (
        <div className={styles.card} style={{ padding: 24, color: "red" }}>
          No tienes permisos para cambiar el estado de este anticipo.
        </div>
      )}

      {anticipo && esCompras && (
        <SeccionEstado
          titulo="Estado Administrativo (Compras)"
          opciones={["APROBADO", "RECHAZADO", "ANULADO"]}
          estadoActual={anticipo.EstadoAdministrativo}
          observacionActual={anticipo.ObservacionAdministrativo}
          fechaActual={anticipo.FechaEstadoAdministrativo}
          usuarioActual={
            anticipo.UsuarioEstadoAdministrativo ||
            (anticipo.EstadoAdministrativo && anticipo.EstadoAdministrativo !== "PENDIENTE"
              ? "EQUIPO ADMINISTRATIVO"
              : null)
          }
          onGuardar={(estado, observacion) => guardarEstado("estado-administrativo", estado, observacion)}
        />
      )}

      {anticipo && esContabilidad && (
        <SeccionEstado
          titulo="Estado Contabilidad"
          opciones={["PAGADO", "RECHAZADO"]}
          estadoActual={anticipo.EstadoContabilidad}
          observacionActual={anticipo.ObservacionContabilidad}
          fechaActual={anticipo.FechaEstadoContabilidad}
          usuarioActual={anticipo.UsuarioEstadoContabilidad}
          onGuardar={(estado, observacion) => guardarEstado("estado-contabilidad", estado, observacion)}
        />
      )}
    </div>
  );
}
