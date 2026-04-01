"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./solicitudesMensuales.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://back-compras-ec.onrender.com";

const CATEGORIAS = [
  "CAFETERIA",
  "LIMPIEZA",
  "OFICINA",
  "EDUCACION MEDICA",
];

export default function SolicitudesMensualesClient({ session }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [userInfo, setUserInfo] = useState(null);

  const [categoria, setCategoria] = useState("CAFETERIA");
  const [plantillas, setPlantillas] = useState([]);
  const [plantillaId, setPlantillaId] = useState("");
  const [plantilla, setPlantilla] = useState(null);

  const [comentarios, setComentarios] = useState("");
  const [fechaNecesaria, setFechaNecesaria] = useState("");
  const [busqueda, setBusqueda] = useState("");

 async function loadUserInfo() {
  try {
    const email = session?.user?.email || "";

    if (!email) {
      throw new Error("La sesión no contiene correo del usuario");
    }

    const res = await fetch(
      `${API_BASE}/api/users/by-email?email=${encodeURIComponent(email)}`,
      {
        cache: "no-store",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "No se pudo cargar el usuario autenticado");
    }

    if (!data?.found) {
      throw new Error("El correo autenticado no existe en la tabla de usuarios");
    }

    setUserInfo({
      Id: data.IdUsuario,
      Nombre: data.Nombre,
      Correo: data.Correo,
      RolId: data.RolId,
      RolNombre: data.RolNombre,
      DepartamentoId: data.DepartamentoId,
      DepartamentoNombre: data.DeptoNombre,
    });
  } catch (e) {
    setError(e.message || "Error cargando usuario");
  }
}

  async function loadPlantillas(cat) {
    setError("");
    try {
      const res = await fetch(
        `${API_BASE}/api/solicitudes-mensuales/plantillas?categoria=${encodeURIComponent(cat)}`,
        { cache: "no-store" }
      );

      if (!res.ok) throw new Error("No se pudieron cargar las plantillas");

      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      setPlantillas(items);

      if (items.length > 0) {
        setPlantillaId(String(items[0].IdPlantilla));
      } else {
        setPlantillaId("");
        setPlantilla(null);
      }
    } catch (e) {
      setError(e.message || "Error cargando plantillas");
      setPlantillas([]);
      setPlantillaId("");
      setPlantilla(null);
    }
  }

  async function loadPlantilla(id) {
    if (!id) {
      setPlantilla(null);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `${API_BASE}/api/solicitudes-mensuales/plantillas/${id}`,
        { cache: "no-store" }
      );

      if (!res.ok) throw new Error("No se pudo cargar el detalle de la plantilla");

      const data = await res.json();

      const detalle = Array.isArray(data.detalle)
        ? data.detalle.map((item) => ({
            ...item,
            Cantidad: item.Cantidad || "",
            Observacion: item.Observacion || "",
          }))
        : [];

      setPlantilla({
        cabecera: data.cabecera,
        detalle,
      });
    } catch (e) {
      setError(e.message || "Error cargando detalle");
      setPlantilla(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUserInfo();
  }, []);

  useEffect(() => {
    loadPlantillas(categoria);
  }, [categoria]);

  useEffect(() => {
    if (plantillaId) loadPlantilla(plantillaId);
  }, [plantillaId]);

  function updateCantidad(index, value) {
    setPlantilla((prev) => {
      if (!prev) return prev;
      const next = [...prev.detalle];
      next[index] = {
        ...next[index],
        Cantidad: value,
      };
      return { ...prev, detalle: next };
    });
  }

  function updateObservacion(index, value) {
    setPlantilla((prev) => {
      if (!prev) return prev;
      const next = [...prev.detalle];
      next[index] = {
        ...next[index],
        Observacion: value,
      };
      return { ...prev, detalle: next };
    });
  }

  const filteredDetalle = useMemo(() => {
    const items = plantilla?.detalle || [];
    const q = busqueda.trim().toLowerCase();
    if (!q) return items;

    return items.filter((it) =>
      `${it.Descripcion || ""} ${it.NumeroArticulo || ""} ${it.ObservacionReferencia || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [plantilla, busqueda]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (!userInfo?.Id) {
        throw new Error("No se pudo resolver el usuario autenticado");
      }

      if (!userInfo?.DepartamentoId) {
        throw new Error("El usuario no tiene departamento asignado");
      }

      if (!plantilla?.cabecera?.IdPlantilla) {
        throw new Error("Debe seleccionar una plantilla");
      }

      const detalleEnviar = (plantilla?.detalle || [])
        .map((it) => {
          const cantidad = Number(it.Cantidad || 0);

          return {
            NumeroArticulo: (it.Descripcion || "").trim(), // aquí va lo que pediste
            Descripcion: "", // aquí vacío
            Cantidad: cantidad,
            Observacion: (it.Observacion || "").trim(),
            FechaNecesaria: fechaNecesaria || null,
          };
        })
        .filter((it) => it.Cantidad > 0);

      if (!detalleEnviar.length) {
        throw new Error("Debe ingresar al menos una cantidad mayor a 0");
      }

      const payload = {
        cabecera: {
          IdUsuario: userInfo.Id,
          DepartamentoId: userInfo.DepartamentoId,
          IdPlantilla: plantilla.cabecera.IdPlantilla,
          Categoria: categoria,
          Comentarios: comentarios.trim(),
          FechaNecesaria: fechaNecesaria || null,
          Tipo: "ARTICULO",
        },
        detalle: detalleEnviar,
        autoApprove: false,
      };

      const res = await fetch(`${API_BASE}/api/solicitudes-mensuales`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "No se pudo crear la solicitud mensual");
      }

      setSuccess(
        `Solicitud creada correctamente. Código: ${data?.Codigo || ""}`
      );

      setComentarios("");
      setFechaNecesaria("");
      setBusqueda("");

      await loadPlantilla(plantilla.cabecera.IdPlantilla);
    } catch (e) {
      setError(e.message || "Error guardando solicitud");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Solicitudes mensuales</h1>
        <p>Selecciona una categoría, completa cantidades y observaciones, y envía para aprobación.</p>
      </div>

      <div className={styles.topGrid}>
        <div className={styles.card}>
          <label className={styles.label}>Categoría</label>
          <select
            className={styles.input}
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            {CATEGORIAS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.card}>
          <label className={styles.label}>Plantilla</label>
          <select
            className={styles.input}
            value={plantillaId}
            onChange={(e) => setPlantillaId(e.target.value)}
          >
            {plantillas.map((p) => (
              <option key={p.IdPlantilla} value={p.IdPlantilla}>
                {p.Nombre}
              </option>
            ))}
          </select>
        </div>

        <div className={`${styles.card} ${styles.dateCard}`}>
  <label className={styles.label}>Fecha necesaria</label>
  <div className={styles.dateField}>
    <input
      type="date"
      className={`${styles.input} ${styles.dateInput}`}
      value={fechaNecesaria}
      onChange={(e) => setFechaNecesaria(e.target.value)}
    />
  </div>
  <small className={styles.helperText}>
    Esta fecha se aplicará a todos los ítems de la solicitud.
  </small>
</div>
      </div>

      <div className={styles.meta}>
  <div className={styles.metaItem}>
    <span className={styles.metaLabel}>Solicitante</span>
    <span className={styles.metaValue}>
      {userInfo?.Nombre || session?.user?.name || "-"}
    </span>
  </div>

  <div className={styles.metaItem}>
    <span className={styles.metaLabel}>Departamento</span>
    <span className={styles.metaValue}>
      {userInfo?.DepartamentoNombre || "-"}
    </span>
  </div>

  <div className={styles.metaItem}>
    <span className={styles.metaLabel}>Categoría</span>
    <span className={styles.metaValue}>{categoria}</span>
  </div>
</div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.toolbar}>
          <input
            type="text"
            className={styles.search}
            placeholder="Buscar ítem..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}
        {success ? <div className={styles.success}>{success}</div> : null}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
  <tr>
    <th className={styles.colNum}>#</th>
    <th className={styles.colImagen}>Imagen</th>
    <th className={styles.colDetalle}>Detalle</th>
    <th className={styles.colCantidad}>Cantidad</th>
    <th className={styles.colObservacion}>Observación</th>
  </tr>
</thead>
            <tbody>
  {loading ? (
    <tr>
      <td colSpan="6" className={styles.empty}>Cargando...</td>
    </tr>
  ) : !filteredDetalle.length ? (
    <tr>
      <td colSpan="6" className={styles.empty}>No hay ítems</td>
    </tr>
  ) : (
    filteredDetalle.map((item) => {
      const realIndex = plantilla.detalle.findIndex(
        (x) => x.IdDetallePlantilla === item.IdDetallePlantilla
      );

      return (
        <tr key={item.IdDetallePlantilla}>
          <td>{item.Orden}</td>

          <td>
  <div className={styles.imageBox}>
    {item.ImagenReferencia ? (
      <img
        src={
          item.ImagenReferencia?.startsWith("http")
            ? item.ImagenReferencia
            : `${API_BASE}${item.ImagenReferencia}`
        }
        alt={item.Descripcion || "Imagen referencia"}
        className={styles.refImage}
      />
    ) : (
      <div className={styles.imagePlaceholder}>Sin imagen</div>
    )}
  </div>
</td>

          <td className={styles.detalleCell}>
  <div className={styles.detalleContent}>
    <div className={styles.detalleTitle}>{item.Descripcion}</div>
    {item.NumeroArticulo ? (
      <div className={styles.detalleCode}>{item.NumeroArticulo}</div>
    ) : null}
  </div>
</td>

          <td>
  <input
    type="number"
    min="0"
    step="1"
    className={styles.qtyInput}
    value={item.Cantidad}
    onChange={(e) => updateCantidad(realIndex, e.target.value)}
    placeholder="0"
  />
</td>

          <td>
            <input
              type="text"
              className={styles.obsInput}
              placeholder="Observación"
              value={item.Observacion || ""}
              onChange={(e) => updateObservacion(realIndex, e.target.value)}
            />
          </td>
        </tr>
      );
    })
  )}
</tbody>
          </table>
        </div>

        <div className={styles.commentsBox}>
          <label className={styles.label}>Comentarios generales</label>
          <textarea
            className={styles.textarea}
            rows={4}
            placeholder="Comentarios adicionales..."
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
          />
        </div>

        <div className={styles.actions}>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>
            {saving ? "Enviando..." : "Enviar para aprobación"}
          </button>
        </div>
      </form>
    </div>
  );
}