"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Search, Trash2, CreditCard } from "lucide-react";
import styles from "./TarjetasCredito.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const meses = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

export default function TarjetasCredito() {
  const fechaActual = new Date();

  const [tarjetas, setTarjetas] = useState([]);
  const [idTarjeta, setIdTarjeta] = useState("");
  const [anio, setAnio] = useState(fechaActual.getFullYear());
  const [mes, setMes] = useState(fechaActual.getMonth() + 1);

  const [detalle, setDetalle] = useState([]);
  const [idEstado, setIdEstado] = useState(null);
  const [estado, setEstado] = useState("NUEVO");

  const [mostrarNuevaTarjeta, setMostrarNuevaTarjeta] = useState(false);
  const [nombreTarjeta, setNombreTarjeta] = useState("");
  const [cuentaContable, setCuentaContable] = useState("");

  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const [paginaActual, setPaginaActual] = useState(1);
  const filasPorPagina = 10;

  const totalPaginas = Math.ceil(detalle.length / filasPorPagina);
  const inicio = (paginaActual - 1) * filasPorPagina;
  const fin = inicio + filasPorPagina;
  const detallePaginado = detalle.slice(inicio, fin);

  const anios = useMemo(() => {
    const actual = new Date().getFullYear();
    return [actual - 1, actual, actual + 1];
  }, []);

  useEffect(() => {
    cargarTarjetas();
  }, []);

  const cargarTarjetas = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tarjetas`);
      const contentType = res.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error("La ruta /api/tarjetas no está devolviendo JSON.");
      }

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error al cargar tarjetas");

      setTarjetas(data);

      if (data.length > 0 && !idTarjeta) {
        setIdTarjeta(String(data[0].IdTarjeta));
      }
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const crearTarjeta = async () => {
    if (!nombreTarjeta.trim()) {
      setMensaje("Ingrese el nombre de la tarjeta.");
      return;
    }

    try {
      setMensaje("");

      const res = await fetch(`${API_URL}/api/tarjetas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Nombre: nombreTarjeta.trim(),
          CuentaContable: cuentaContable.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error al crear tarjeta");

      setNombreTarjeta("");
      setCuentaContable("");
      setMostrarNuevaTarjeta(false);
      setMensaje("Tarjeta creada correctamente.");

      await cargarTarjetas();
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const buscarEstado = async () => {
    if (!idTarjeta || !anio || !mes) {
      setMensaje("Seleccione tarjeta, año y mes.");
      return;
    }

    setLoading(true);
    setMensaje("");

    try {
      const url = `${API_URL}/api/tarjetas/estado?idTarjeta=${idTarjeta}&anio=${anio}&mes=${mes}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error al consultar estado");

      if (data.existe) {
        setIdEstado(data.cabecera.IdEstado);
        setEstado(data.cabecera.Estado || "BORRADOR");
        setDetalle(data.detalle || []);
        setPaginaActual(1);
        setMensaje("Estado de cuenta cargado correctamente.");
      } else {
        setIdEstado(null);
        setEstado("BORRADOR");
        setDetalle([crearFila()]);
        setPaginaActual(1);
        setMensaje("No existe estado de cuenta. Se abrió una plantilla nueva.");
      }
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setLoading(false);
    }
  };

  const normalizarFecha = (valor) => {
    if (!valor) return "";

    const limpio = valor.trim();

    const match = limpio.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);

    if (match) {
      const dia = match[1].padStart(2, "0");
      const mes = match[2].padStart(2, "0");
      const anio = match[3];

      return `${anio}-${mes}-${dia}`;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(limpio)) {
      return limpio;
    }

    return "";
  };

  const handlePasteExcel = (e) => {
    e.preventDefault();

    const text = e.clipboardData.getData("text");
    if (!text) return;

    const filas = text.split(/\r?\n/).filter((x) => x.trim() !== "");

    const nuevas = filas.map((fila) => {
      const columnas = fila.split("\t");

      return {
        Fecha: normalizarFecha(columnas[0] || ""),
        Descripcion: columnas[1] || "",
        Valor: columnas[2] || "",
        Observacion: columnas[3] || "",
      };
    });

    setDetalle((prev) => {
      const actualizado = [...prev, ...nuevas];

      setTimeout(() => {
        setPaginaActual(Math.ceil(actualizado.length / filasPorPagina));
      }, 0);

      return actualizado;
    });
  };

  const crearFila = () => ({
    Fecha: "",
    Descripcion: "",
    Valor: "",
    Observacion: "",
  });

  const agregarFila = () => {
    setDetalle((prev) => {
      const actualizado = [...prev, crearFila()];

      setTimeout(() => {
        setPaginaActual(Math.ceil(actualizado.length / filasPorPagina));
      }, 0);

      return actualizado;
    });
  };

  const eliminarFila = (index) => {
    setDetalle((prev) => {
      const actualizado = prev.filter((_, i) => i !== index);
      const nuevasPaginas = Math.ceil(actualizado.length / filasPorPagina) || 1;

      if (paginaActual > nuevasPaginas) {
        setPaginaActual(nuevasPaginas);
      }

      return actualizado;
    });
  };

  const actualizarFila = (index, campo, valor) => {
    setDetalle((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [campo]: valor } : item
      )
    );
  };

  const total = detalle.reduce((acc, item) => {
    return acc + Number(item.Valor || 0);
  }, 0);

  const guardarEstado = async () => {
    if (!idTarjeta || !anio || !mes) {
      setMensaje("Seleccione tarjeta, año y mes.");
      return;
    }

    setGuardando(true);
    setMensaje("");

    try {
      const payload = {
        IdTarjeta: Number(idTarjeta),
        Anio: Number(anio),
        Mes: Number(mes),
        UsuarioCreacion: "",
        Detalle: detalle.map((item) => ({
          Fecha: item.Fecha || null,
          Descripcion: item.Descripcion || "",
          Valor: Number(item.Valor || 0),
          Observacion: item.Observacion || "",
        })),
      };

      const res = await fetch(`${API_URL}/api/tarjetas/estado`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error al guardar");

      setIdEstado(data.IdEstado);
      setEstado("BORRADOR");
      setMensaje("Estado de cuenta guardado correctamente.");
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.header}>
          <div>
            <div className={styles.titleRow}>
              <CreditCard size={28} />
              <h1>Tarjetas de crédito</h1>
            </div>
            <p>
              Seleccione una tarjeta y el mes para cargar o crear el estado de
              cuenta.
            </p>
          </div>

          <div className={styles.badge}>{estado}</div>
        </div>

        <div className={styles.catalogHeader}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setMostrarNuevaTarjeta(!mostrarNuevaTarjeta)}
          >
            <Plus size={18} />
            Nueva tarjeta
          </button>
        </div>

        {mostrarNuevaTarjeta && (
          <div className={styles.newCardBox}>
            <div className={styles.field}>
              <label>Nombre de tarjeta</label>
              <input
                value={nombreTarjeta}
                onChange={(e) => setNombreTarjeta(e.target.value)}
                placeholder="Ej: Diners Club, Visa Pichincha, Mastercard"
              />
            </div>

            <div className={styles.field}>
              <label>Cuenta contable</label>
              <input
                value={cuentaContable}
                onChange={(e) => setCuentaContable(e.target.value)}
                placeholder="Opcional"
              />
            </div>

            <button
              type="button"
              className={styles.saveBtn}
              onClick={crearTarjeta}
            >
              <Save size={18} />
              Guardar tarjeta
            </button>
          </div>
        )}

        <div className={styles.filters}>
          <div className={styles.field}>
            <label>Tarjeta</label>
            <select
              value={idTarjeta}
              onChange={(e) => setIdTarjeta(e.target.value)}
            >
              <option value="">Seleccione</option>
              {tarjetas.map((t) => (
                <option key={t.IdTarjeta} value={t.IdTarjeta}>
                  {t.Nombre}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Año</label>
            <select value={anio} onChange={(e) => setAnio(e.target.value)}>
              {anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Mes</label>
            <select value={mes} onChange={(e) => setMes(e.target.value)}>
              {meses.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className={styles.searchBtn}
            onClick={buscarEstado}
          >
            <Search size={18} />
            {loading ? "Buscando..." : "Abrir"}
          </button>
        </div>

        {mensaje && <div className={styles.message}>{mensaje}</div>}

        <div className={styles.tableHeader}>
          <h2>Detalle del estado de cuenta</h2>

          <button type="button" className={styles.addBtn} onClick={agregarFila}>
            <Plus size={18} />
            Agregar fila
          </button>
        </div>

        <div className={styles.pasteBox}>
          <label>Pegado masivo desde Excel</label>
          <textarea
            placeholder="Pegue aquí filas copiadas desde Excel..."
            onPaste={handlePasteExcel}
          />
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Valor</th>
                <th>Observación</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {detalle.length === 0 ? (
                <tr>
                  <td colSpan="5" className={styles.empty}>
                    Abra o cree un estado de cuenta.
                  </td>
                </tr>
              ) : (
                detallePaginado.map((item, idx) => {
                  const index = inicio + idx;

                  return (
                    <tr key={index}>
                      <td>
                        <input
                          type="date"
                          value={item.Fecha || ""}
                          onChange={(e) =>
                            actualizarFila(index, "Fecha", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={item.Descripcion || ""}
                          onChange={(e) =>
                            actualizarFila(
                              index,
                              "Descripcion",
                              e.target.value
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={item.Valor || ""}
                          onChange={(e) =>
                            actualizarFila(index, "Valor", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={item.Observacion || ""}
                          onChange={(e) =>
                            actualizarFila(
                              index,
                              "Observacion",
                              e.target.value
                            )
                          }
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={() => eliminarFila(index)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {detalle.length > 0 && (
            <div className={styles.pagination}>
              <button
                type="button"
                disabled={paginaActual === 1}
                onClick={() => setPaginaActual((p) => p - 1)}
              >
                Anterior
              </button>

              <span>
                Página {paginaActual} de {totalPaginas || 1} | Registros:{" "}
                {detalle.length}
              </span>

              <button
                type="button"
                disabled={paginaActual >= totalPaginas}
                onClick={() => setPaginaActual((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.total}>
            Total: <strong>${total.toFixed(2)}</strong>
          </div>

          <button
            type="button"
            className={styles.saveBtn}
            onClick={guardarEstado}
          >
            <Save size={18} />
            {guardando ? "Guardando..." : "Guardar estado"}
          </button>
        </div>
      </section>
    </main>
  );
}