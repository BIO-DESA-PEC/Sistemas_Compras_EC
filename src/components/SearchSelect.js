'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export default function SearchSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Seleccionar...',
  disabled = false,
  title,

  // ✅ ESTOS TE FALTABAN
  mode = 'dialog',                 // 'dialog' | 'popover'
  dialogTitle = 'Seleccionar',
  inputClassName = '',             // clase del botón (para que se vea igual al input)
  className = '',                  // wrapper

  maxHeight = 320,
  searchPlaceholder = 'Buscar...',
  clearable = true,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const searchRef = useRef(null);

  const selected = useMemo(() => {
    const v = String(value ?? '');
    return options.find(o => String(o.value) === v) || null;
  }, [value, options]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter(o => String(o.label ?? '').toLowerCase().includes(s));
  }, [q, options]);

  useEffect(() => {
    if (open) {
      setQ('');
      setTimeout(() => searchRef.current?.focus?.(), 50);
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
    e?.stopPropagation?.();
    if (!clearable) return;
    onChange?.('');
    setOpen(false);
  };

  // ✅ BOTÓN que “imita” input
  const Trigger = (
    <button
      type="button"
      className={inputClassName}
      onClick={() => !disabled && setOpen(true)}
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={open}
      title={title || selected?.label || ''}
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

  // ✅ MODO DIALOG
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
              zIndex: 9999,
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
                  const isSel = String(o.value) === String(value ?? '');
                  return (
                    <button
                      key={String(o.value)}
                      type="button"
                      onClick={() => pick(o.value)}
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
  // ✅ MODO DIALOG (mini-modal)
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
              zIndex: 9999,
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
                  const isSel = String(o.value) === String(value ?? '');
                  return (
                    <button
                      key={String(o.value)}
                      type="button"
                      onClick={() => pick(o.value)}
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

  // =================================
  // (Opcional) modo popover si quieres
  // =================================
  return (
    <div className={className} style={{ position: 'relative' }}>
      {Trigger}
      {open && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            zIndex: 20,
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
              const isSel = String(o.value) === String(value ?? '');
              return (
                <button
                  key={String(o.value)}
                  type="button"
                  onClick={() => pick(o.value)}
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
