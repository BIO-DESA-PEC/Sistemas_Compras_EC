// src/app/admin/departamentos/DepartamentosClient.jsx
"use client";

import { useEffect, useState } from "react";
import Select from "react-select";
import styles from "../usuarios/usuarios.module.css";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;
const PAGE_SIZE = 20;
const USERS_BATCH_SIZE = 200;

const userSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 40,
    borderRadius: 10,
    borderColor: state.isFocused ? "#10a56b" : "#d1d5db",
    boxShadow: state.isFocused ? "0 0 0 1px #10a56b" : "none",
    fontSize: 14,
    "&:hover": {
      borderColor: state.isFocused ? "#10a56b" : "#9ca3af",
    },
  }),
  menu: (base) => ({ ...base, zIndex: 60 }),
};

function UserSelect({ id, value, onChange, options, placeholder }) {
  const selectedOption = options.find((option) => option.value === value) || null;

  return (
    <Select
      inputId={id}
      value={selectedOption}
      onChange={(option) => onChange(option?.value || "")}
      options={options}
      placeholder={placeholder}
      noOptionsMessage={() => "No se encontraron usuarios"}
      isClearable
      isSearchable
      styles={userSelectStyles}
    />
  );
}

export default function DepartamentosClient() {
  const [deptos, setDeptos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    Nombre: "",
    JefeId: "",
    SubGerenteId: "",
    GerenteId: "",
  });

  const [page, setPage] = useState(1);

  const userOptions = usuarios.map((u) => ({
    value: String(u.Id),
    label: u.Nombre,
  }));

  const getNombreUsuario = (id) => {
    if (!id) return "";
    const u = usuarios.find((x) => x.Id === id);
    return u ? u.Nombre : id;
  };

  const loadDeptos = async () => {
    const res = await fetch(`${API_BASE}/api/departamentos`);
    const data = await res.json();
    setDeptos(data || []);
    setPage(1);
  };

  const loadUsuarios = async () => {
    const allUsers = [];
    let offset = 0;

    while (true) {
      const res = await fetch(
        `${API_BASE}/api/users?limit=${USERS_BATCH_SIZE}&offset=${offset}`
      );

      if (!res.ok) {
        throw new Error("No se pudo cargar la lista de usuarios");
      }

      const batch = await res.json();
      allUsers.push(...batch);

      if (batch.length < USERS_BATCH_SIZE) break;
      offset += USERS_BATCH_SIZE;
    }

    setUsuarios(allUsers);
  };

  useEffect(() => {
    loadDeptos();
    loadUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ Nombre: "", JefeId: "", SubGerenteId: "", GerenteId: "" });
    setModalOpen(true);
  };

  const openEdit = (d) => {
    setEditing(d);
    setForm({
      Nombre: d.Nombre || "",
      JefeId: d.JefeId ? String(d.JefeId) : "",
      SubGerenteId: d.SubGerenteId ? String(d.SubGerenteId) : "",
      GerenteId: d.GerenteId ? String(d.GerenteId) : "",
    });
    setModalOpen(true);
  };

  const save = async () => {
    const payload = {
      Nombre: form.Nombre,
      JefeId: form.JefeId ? Number(form.JefeId) : null,
      SubGerenteId: form.SubGerenteId ? Number(form.SubGerenteId) : null,
      GerenteId: form.GerenteId ? Number(form.GerenteId) : null,
    };

    const url = editing
      ? `${API_BASE}/api/departamentos/${editing.Id}`
      : `${API_BASE}/api/departamentos`;

    const res = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      alert("Error guardando departamento");
      return;
    }

    setModalOpen(false);
    await loadDeptos();
  };

  const del = async (d) => {
    if (!confirm(`¿Eliminar departamento "${d.Nombre}"?`)) return;

    const res = await fetch(`${API_BASE}/api/departamentos/${d.Id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      alert("Error eliminando departamento");
      return;
    }

    await loadDeptos();
  };

  // filtro + paginación
  const filtered = deptos.filter((d) =>
    d.Nombre.toLowerCase().includes(search.toLowerCase())
  );

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const pageItems = filtered.slice(startIndex, endIndex);

  const showingFrom = totalCount === 0 ? 0 : startIndex + 1;
  const showingTo = totalCount === 0 ? 0 : Math.min(endIndex, totalCount);

  const goToPage = (p) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Departamentos</h1>
          <p className={styles.subtitle}>
            Administra la estructura organizacional
          </p>
        </div>

        <div className={styles.headerRight}>
          <input
            className={styles.search}
            placeholder="Buscar departamento…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <button className={styles.primaryBtn} onClick={openNew}>
            + Nuevo Departamento
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Jefe</th>
              <th>SubGerente</th>
              <th>Gerente</th>
              <th style={{ width: 120 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((d) => (
              <tr key={d.Id}>
                <td>{d.Nombre}</td>
                <td>{getNombreUsuario(d.JefeId)}</td>
                <td>{getNombreUsuario(d.SubGerenteId)}</td>
                <td>{getNombreUsuario(d.GerenteId)}</td>
                <td>
                  <div className={styles.actions}>
                    <button
                      className={styles.secondaryBtn}
                      onClick={() => openEdit(d)}
                    >
                      Editar
                    </button>
                    <button
                      className={styles.dangerBtn}
                      onClick={() => del(d)}
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {pageItems.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  No hay departamentos
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className={styles.pagination}>
          <span className={styles.paginationSummary}>
            Mostrando {showingFrom}–{showingTo} de {totalCount}
          </span>
          <div className={styles.paginationButtons}>
            <button
              className={styles.pageArrow}
              disabled={currentPage === 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              «
            </button>

            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  className={
                    p === currentPage
                      ? styles.pageNumberActive
                      : styles.pageNumber
                  }
                  onClick={() => goToPage(p)}
                >
                  {p}
                </button>
              );
            })}

            <button
              className={styles.pageArrow}
              disabled={currentPage === totalPages || totalCount === 0}
              onClick={() => goToPage(currentPage + 1)}
            >
              »
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>{editing ? "Editar Departamento" : "Nuevo Departamento"}</h3>

            <label>Nombre</label>
            <input
              className={styles.input}
              value={form.Nombre}
              onChange={(e) => setForm({ ...form, Nombre: e.target.value })}
            />

            <label htmlFor="departamento-jefe">Jefe</label>
            <UserSelect
              id="departamento-jefe"
              value={form.JefeId}
              onChange={(value) => setForm({ ...form, JefeId: value })}
              options={userOptions}
              placeholder="Sin jefe asignado"
            />

            <label htmlFor="departamento-subgerente">SubGerente</label>
            <UserSelect
              id="departamento-subgerente"
              value={form.SubGerenteId}
              onChange={(value) =>
                setForm({ ...form, SubGerenteId: value })
              }
              options={userOptions}
              placeholder="Sin subgerente"
            />

            <label htmlFor="departamento-gerente">Gerente</label>
            <UserSelect
              id="departamento-gerente"
              value={form.GerenteId}
              onChange={(value) =>
                setForm({ ...form, GerenteId: value })
              }
              options={userOptions}
              placeholder="Sin gerente"
            />

            <div className={styles.modalFooter}>
              <button
                className={styles.cancelBtn}
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </button>
              <button className={styles.saveBtn} onClick={save}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
