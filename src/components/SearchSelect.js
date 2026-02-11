'use client';

import { useEffect, useMemo, useRef, useState, useId } from 'react';

export default function SearchSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Seleccionar...',
  disabled = false,
  title,

  // modos
  mode = 'dialog',                 // 'dialog' | 'popover'
  dialogTitle = 'Seleccionar',
  inputClassName = '',             // clase del botón (para que se vea igual al input)
  className = '',                  // wrapper

  maxHeight = 320,
  searchPlaceholder = 'Buscar...',
  clearable = true,
}) {
  const uid = useId(); // ✅ ayuda con keys únicas
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const searchRef = useRef(null);

  // Normalizar options (evita undefined)
  const normOptions = useMemo(() => {
  return (options || []).map((o, idx) => {
    const v = String(o?.value ?? '').trim();
    const lbl = String(o?.label ?? v).trim();
    return {
      value: v,
      label: lbl || v,
      __idx: idx,
    };
  });
}, [options]);


  const selected = useMemo(() => {
  const v = String(value ?? '').trim();
  return normOptions.find(o => String(o.value).trim() === v) || null;
}, [value, normOptions]);


  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return normOptions;
    return normOptions.filter(o => String(o.label ?? '').toLowerCase().includes(s));
  }, [q, normOptions]);

  useEffect(() => {
    if (open) {
      setQ('');
      setTimeout(() => searchRef.current?.focus?.(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open]);

  const pick = (v) => {
    onChange?.(v);
    setOpen(false);
  };

  const clear = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!clearable) return;
    onChange?.('');
    setOpen(false);
  };

  // ✅ Trigger “tipo input”
  const Trigger = (
    <button
      type="button"
      className={inputClassName}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setOpen(true);
      }}
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={open}
      title={title || selected?.label || ''}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{
        flex: 1,
        textAlign: 'left',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>
        {selected?.label || placeholder}
      </span>

      {clearable && !disabled && (value ?? '') !== '' && (
        <span
          onClick={clear}
          title="Limpiar"
          style={{
            padding: '0 6px',
            borderRadius: 8,
            cursor: 'pointer',
            lineHeight: '18px',
            userSelect: 'none'
          }}
        >
          ×
        </span>
      )}

      <span style={{ fontSize: 12, opacity: 0.7 }}>▾</span>
    </button>
  );

  // ==========================
  // ✅ MODO DIALOG (modal real)
  // ==========================
  if (mode === 'dialog') {
    return (
      <div className={className}>
        {Trigger}

        {open && (
          <div
            role="dialog"
            aria-modal="true"
            onMouseDown={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2147483647, // ✅ por si tienes sidebars/headers con z-index alto
              background: 'rgba(15,23,42,.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 18
            }}
          >
            <div
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                width: 'min(560px, 92vw)',
                background: '#fff',
                borderRadius: 14,
                border: '1px solid #e5e7eb',
                boxShadow: '0 18px 48px rgba(2,6,23,.20)',
                overflow: 'hidden'
              }}
            >
              {/* Header */}
              <div style={{
                padding: '12px 14px',
                borderBottom: '1px solid #eef2f4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10
              }}>
                <div style={{ fontWeight: 800, color: '#0f172a' }}>
                  {dialogTitle}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    width: 34, height: 34,
                    borderRadius: 10,
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                    cursor: 'pointer',
                    color: '#64748b'
                  }}
                  aria-label="Cerrar"
                  title="Cerrar"
                >
                  ×
                </button>
              </div>

              {/* Search */}
              <div style={{ padding: 12, borderBottom: '1px solid #eef2f4' }}>
                <input
                  ref={searchRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={searchPlaceholder}
                  style={{
                    width: '100%',
                    height: 40,
                    borderRadius: 10,
                    border: '1px solid #e5e7eb',
                    padding: '8px 10px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* List */}
              <div style={{
                maxHeight: Math.min(maxHeight, 420),
                overflow: 'auto',
                padding: 6
              }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: 12, color: '#64748b' }}>
                    No hay resultados
                  </div>
                ) : filtered.map((o) => {
                  const isSel = String(o.value).trim() === String(value ?? '').trim();
                  return (
                    <button
                      key={`${uid}-${String(o.value)}-${o.__idx}`} // ✅ key única aunque value se repita
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        pick(o.value);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 10px',
                        border: 0,
                        background: isSel ? '#eff6ff' : '#fff',
                        borderRadius: 10,
                        cursor: 'pointer',
                        fontWeight: isSel ? 800 : 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      title={o.label}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================
  // ✅ MODO POPOVER (dropdown)
  // ==========================
  return (
    <div className={className} style={{ position: 'relative' }}>
      {Trigger}

      {open && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            zIndex: 9999,
            top: 'calc(100% + 6px)',
            left: 0,
            width: '100%',
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            boxShadow: '0 18px 48px rgba(2,6,23,.18)',
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: 8, borderBottom: '1px solid #eef2f4' }}>
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                width: '100%',
                height: 36,
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                padding: '8px 10px',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ maxHeight, overflow: 'auto', padding: 6 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 12, color: '#64748b' }}>No hay resultados</div>
            ) : filtered.map((o) => {
              const isSel = String(o.value).trim() === String(value ?? '').trim();
              return (
                <button
                  key={`${uid}-${String(o.value)}-${o.__idx}`}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    pick(o.value);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 10px',
                    border: 0,
                    background: isSel ? '#eff6ff' : '#fff',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontWeight: isSel ? 800 : 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  title={o.label}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
