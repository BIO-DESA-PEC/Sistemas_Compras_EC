"use client";

import { useEffect, useState } from "react";
import styles from "./plantillasMensuales.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

const EMPTY_ITEM = {
  Orden: 0,
  NumeroArticulo: "",
  Descripcion: "",
  ObservacionReferencia: "",
  Activo: "Y",
};

export default function PlantillasMensualesClient({ session }) {
  const [loading, setLoading] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [plantillas, setPlantillas] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [cabecera, setCabecera] = useState(null);
  const [detalle, setDetalle] = useState([]);
  const [newItem, setNewItem] = useState(EMPTY_ITEM);

  const authHeaders = {
    "X-User-Email": session?.user?.email || "",
  };

  async function fetchPlantillas() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_BASE}/api/solicitudes-mensuales/admin/plantillas`, {
        headers: authHeaders,
        cache: "no-store",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudieron cargar plantillas");

      setPlantillas(data.items || []);

      if ((data.items || []).length > 0 && !selectedId) {
        setSelectedId(String(data.items[0].IdPlantilla));
      }
    } catch (e) {
      setError(e.message || "Error cargando plantillas");
    } finally {
      setLoading(false);
    }
  }

  async function fetchPlantillaDetalle(id) {
    if (!id) return;

    try {
      setLoadingDetalle(true);
      setError("");

      const res = await fetch(`${API_BASE}/api/solicitudes-mensuales/admin/plantillas/${id}`, {
        headers: authHeaders,
        cache: "no-store",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo cargar la plantilla");

      setCabecera(data.cabecera || null);
      setDetalle(data.detalle || []);
    } catch (e) {
      setError(e.message || "Error cargando detalle");
    } finally {
      setLoadingDetalle(false);
    }
  }

  useEffect(() => {
    fetchPlantillas();
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchPlantillaDetalle(selectedId);
    }
  }, [selectedId]);

  function updateDetalleRow(index, field, value) {
    setDetalle((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  async function handleCreateItem(e) {
    e.preventDefault();
    if (!selectedId) return;

    try {
      setSavingItem(true);
      setError("");
      setSuccess("");

      const res = await fetch(
        `${API_BASE}/api/solicitudes-mensuales/admin/plantillas/${selectedId}/items`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify(newItem),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo crear el ítem");

      setSuccess("Ítem agregado correctamente");
      setNewItem(EMPTY_ITEM);
      await fetchPlantillaDetalle(selectedId);
      await fetchPlantillas();
    } catch (e) {
      setError(e.message || "Error creando ítem");
    } finally {
      setSavingItem(false);
    }
  }

  async function handleSaveItem(item) {
    try {
      setSavingItem(true);
      setError("");
      setSuccess("");

      const payload = {
        Orden: Number(item.Orden || 0),
        NumeroArticulo: item.NumeroArticulo || "",
        Descripcion: item.Descripcion || "",
        ImagenReferencia: item.ImagenReferencia || "",
        ObservacionReferencia: item.ObservacionReferencia || "",
        Activo: item.Activo || "Y",
      };

      const res = await fetch(
        `${API_BASE}/api/solicitudes-mensuales/admin/items/${item.IdDetallePlantilla}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo actualizar el ítem");

      setSuccess("Ítem actualizado");
      await fetchPlantillaDetalle(selectedId);
    } catch (e) {
      setError(e.message || "Error actualizando ítem");
    } finally {
      setSavingItem(false);
    }
  }

  async function handleDeleteItem(idItem) {
    if (!confirm("¿Deseas inactivar este ítem?")) return;

    try {
      setSavingItem(true);
      setError("");
      setSuccess("");

      const res = await fetch(`${API_BASE}/api/solicitudes-mensuales/admin/items/${idItem}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo inactivar el ítem");

      setSuccess("Ítem inactivado");
      await fetchPlantillaDetalle(selectedId);
      await fetchPlantillas();
    } catch (e) {
      setError(e.message || "Error inactivando ítem");
    } finally {
      setSavingItem(false);
    }
  }

  async function handleUploadImage(idItem, file) {
    if (!file) return;

    try {
      setUploadingItemId(idItem);
      setError("");
      setSuccess("");

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `${API_BASE}/api/solicitudes-mensuales/admin/items/${idItem}/upload-image`,
        {
          method: "POST",
          headers: authHeaders,
          body: formData,
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo subir la imagen");

      setDetalle((prev) =>
        prev.map((it) =>
          it.IdDetallePlantilla === idItem
            ? { ...it, ImagenReferencia: data.ImagenReferencia }
            : it
        )
      );

      setSuccess("Imagen subida correctamente");
    } catch (e) {
      setError(e.message || "Error subiendo imagen");
    } finally {
      setUploadingItemId(null);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Plantillas mensuales</h1>
        <p>Selecciona una plantilla existente y administra sus ítems con imagen.</p>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}
      {success ? <div className={styles.success}>{success}</div> : null}

      <div className={styles.card}>
        <div className={styles.topBar}>
          <div className={styles.topField}>
            <label className={styles.label}>Plantilla</label>
            <select
              className={styles.select}
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">Seleccione una plantilla</option>
              {plantillas.map((p) => (
                <option key={p.IdPlantilla} value={p.IdPlantilla}>
                  {p.Nombre} - {p.Categoria}
                </option>
              ))}
            </select>
          </div>

          {cabecera ? (
            <div className={styles.badges}>
              <span className={styles.badge}>{cabecera.Categoria}</span>
              <span className={styles.badge}>{cabecera.Tipo}</span>
              <span className={styles.badge}>
                {cabecera.Activa === "Y" ? "Activa" : "Inactiva"}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {!!selectedId && (
        <>
          <div className={styles.card}>
            <div className={styles.sectionHeader}>
              <h3>Agregar nuevo ítem</h3>
            </div>

            <form onSubmit={handleCreateItem} className={styles.newItemGrid}>
              <div>
                <label className={styles.label}>Orden</label>
                <input
                  className={styles.input}
                  type="number"
                  value={newItem.Orden}
                  onChange={(e) => setNewItem({ ...newItem, Orden: e.target.value })}
                />
              </div>

              <div>
                <label className={styles.label}>Número artículo</label>
                <input
                  className={styles.input}
                  value={newItem.NumeroArticulo}
                  onChange={(e) =>
                    setNewItem({ ...newItem, NumeroArticulo: e.target.value })
                  }
                />
              </div>

              <div>
                <label className={styles.label}>Descripción</label>
                <input
                  className={styles.input}
                  value={newItem.Descripcion}
                  onChange={(e) =>
                    setNewItem({ ...newItem, Descripcion: e.target.value })
                  }
                />
              </div>

              <div>
                <label className={styles.label}>Observación referencia</label>
                <input
                  className={styles.input}
                  value={newItem.ObservacionReferencia}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      ObservacionReferencia: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label className={styles.label}>Estado</label>
                <select
                  className={styles.select}
                  value={newItem.Activo}
                  onChange={(e) => setNewItem({ ...newItem, Activo: e.target.value })}
                >
                  <option value="Y">Activo</option>
                  <option value="N">Inactivo</option>
                </select>
              </div>

              <div className={styles.newItemAction}>
                <button className={styles.primaryBtn} type="submit" disabled={savingItem}>
                  {savingItem ? "Guardando..." : "Agregar ítem"}
                </button>
              </div>
            </form>
          </div>

          <div className={styles.itemsGrid}>
            {loadingDetalle ? (
              <div className={styles.card}>Cargando ítems...</div>
            ) : detalle.length === 0 ? (
              <div className={styles.card}>No hay ítems registrados para esta plantilla.</div>
            ) : (
              detalle.map((item, idx) => (
                <div key={item.IdDetallePlantilla} className={styles.itemCard}>
                  <div className={styles.itemTop}>
                    <div>
                      <h4 className={styles.itemTitle}>
                        {item.Descripcion || "Ítem sin descripción"}
                      </h4>
                      <p className={styles.itemSubtitle}>
                        Artículo: {item.NumeroArticulo || "-"} | Orden: {item.Orden || 0}
                      </p>
                    </div>
                    <span className={styles.statusChip}>
                      {item.Activo === "Y" ? "Activo" : "Inactivo"}
                    </span>
                  </div>

                  <div className={styles.itemBody}>
                    <div className={styles.imageBox}>
                      {item.ImagenReferencia ? (
                        <img
                          src={`${API_BASE}${item.ImagenReferencia}`}
                          alt={item.Descripcion || "Imagen referencia"}
                          className={styles.previewImage}
                        />
                      ) : (
                        <div className={styles.imageEmpty}>Sin imagen</div>
                      )}

                      <label className={styles.uploadBtn}>
                        {uploadingItemId === item.IdDetallePlantilla
                          ? "Subiendo..."
                          : "Subir imagen"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          hidden
                          onChange={(e) =>
                            handleUploadImage(
                              item.IdDetallePlantilla,
                              e.target.files?.[0]
                            )
                          }
                        />
                      </label>
                    </div>

                    <div className={styles.itemForm}>
                      <div className={styles.fieldRow}>
                        <div>
                          <label className={styles.label}>Orden</label>
                          <input
                            className={styles.input}
                            type="number"
                            value={item.Orden || 0}
                            onChange={(e) =>
                              updateDetalleRow(idx, "Orden", e.target.value)
                            }
                          />
                        </div>

                        <div>
                          <label className={styles.label}>Número artículo</label>
                          <input
                            className={styles.input}
                            value={item.NumeroArticulo || ""}
                            onChange={(e) =>
                              updateDetalleRow(idx, "NumeroArticulo", e.target.value)
                            }
                          />
                        </div>
                      </div>

                      <div>
                        <label className={styles.label}>Descripción</label>
                        <input
                          className={styles.input}
                          value={item.Descripcion || ""}
                          onChange={(e) =>
                            updateDetalleRow(idx, "Descripcion", e.target.value)
                          }
                        />
                      </div>

                      <div>
                        <label className={styles.label}>Observación referencia</label>
                        <textarea
                          className={styles.textarea}
                          value={item.ObservacionReferencia || ""}
                          onChange={(e) =>
                            updateDetalleRow(
                              idx,
                              "ObservacionReferencia",
                              e.target.value
                            )
                          }
                        />
                      </div>

                      <div>
                        <label className={styles.label}>Estado</label>
                        <select
                          className={styles.select}
                          value={item.Activo || "Y"}
                          onChange={(e) =>
                            updateDetalleRow(idx, "Activo", e.target.value)
                          }
                        >
                          <option value="Y">Activo</option>
                          <option value="N">Inactivo</option>
                        </select>
                      </div>

                      <div className={styles.itemActions}>
                        <button
                          className={styles.primaryBtn}
                          type="button"
                          onClick={() => handleSaveItem(item)}
                        >
                          Guardar cambios
                        </button>

                        <button
                          className={styles.dangerBtn}
                          type="button"
                          onClick={() => handleDeleteItem(item.IdDetallePlantilla)}
                        >
                          Inactivar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {loading && <div className={styles.loading}>Cargando plantillas...</div>}
    </div>
  );
}