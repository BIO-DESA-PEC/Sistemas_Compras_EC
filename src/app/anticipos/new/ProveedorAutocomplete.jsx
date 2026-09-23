"use client";

import { useEffect, useRef, useState } from "react";
import { getProveedores } from "@/app/lib/backend";
import styles from "./anticipoNew.module.css";

export default function ProveedorAutocomplete({ name, value, onChange, onPick, required }) {
  const [open, setOpen] = useState(false);
  const [opciones, setOpciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const buscar = (texto) => {
    clearTimeout(debounceRef.current);

    if (!texto || texto.trim().length < 2) {
      setOpciones([]);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await getProveedores({ q: texto.trim(), limit: 15 });
        setOpciones(Array.isArray(data) ? data : []);
      } catch {
        setOpciones([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleInput = (e) => {
    const v = e.target.value;
    onChange(v);
    setOpen(true);
    buscar(v);
  };

  const pick = (p) => {
    onChange(p.NombreProveedor);
    onPick?.(p);
    setOpen(false);
    setOpciones([]);
  };

  const mostrarLista = open && (value || "").trim().length >= 2;

  return (
    <div className={styles.autocomplete} ref={boxRef}>
      <input
        name={name}
        value={value}
        onChange={handleInput}
        onFocus={() => (value || "").trim().length >= 2 && setOpen(true)}
        placeholder="Buscar proveedor o escribir un nombre"
        autoComplete="off"
        required={required}
      />

      {mostrarLista && (
        <div className={styles.autocompleteList}>
          {loading ? (
            <div className={styles.autocompleteHint}>Buscando…</div>
          ) : opciones.length > 0 ? (
            opciones.map((p) => (
              <button
                type="button"
                key={p.CodigoSAP || p.IdProveedor || p.NombreProveedor}
                className={styles.autocompleteItem}
                onClick={() => pick(p)}
              >
                <span className={styles.autocompleteName}>{p.NombreProveedor}</span>
                {p.IdProveedor && (
                  <span className={styles.autocompleteSub}>{p.IdProveedor}</span>
                )}
              </button>
            ))
          ) : (
            <div className={styles.autocompleteHint}>
              Sin coincidencias — puedes escribir el nombre manualmente.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
