'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './FacturaPreviewModal.module.css';
import SearchSelect from '@/components/SearchSelect';

const IVA_OPTS = [
  { value: 'IVA_15', label: 'IVA 15%' },
  { value: 'IVA_0',  label: 'IVA 0%'  },
];

const SUSTENTO_OPTS = [
  { value: '01', label: '01 - Créditos tributarios' },
  { value: '02', label: '02 - Reembolsos' },
];

function n2(v){
  if (typeof v === 'string') v = v.replace(',', '.');
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
const t = (v) => String(v ?? '').trim();

function titleFromOpts(value, opts = []) {
  const v = t(value);
  if (!v) return '';
  const found = opts.find(o => String(o.value) === v);
  return found ? found.label : v;
}
function titleFromDim(code, list = []) {
  const v = t(code);
  if (!v) return '';
  const found = (list || []).find(o => String(o.code) === v);
  return found ? `${found.code} — ${found.name}` : v;
}

export default function FacturaPreviewModalArticulo({
  open,
  data,
  onClose,
  onUse,
  modo,
  rolNombre = "",
  rolId = null,
  lockSoloGasto = false,
}) {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://back-compras-ec.onrender.com';

  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);

  // Paso 1
  const [est, setEst] = useState('');
  const [pto, setPto] = useState('');
  const [sec, setSec] = useState('');

  // Draft real
  const [draft, setDraft] = useState(data || null);

  // Dimensiones
  const [dLinea,  setDLinea]  = useState([]);
  const [dRegion, setDRegion] = useState([]);

  // cache deptos por linea
  const [deptosCache, setDeptosCache] = useState({});

  async function getDeptosByLinea(lineaCode) {
    const k = String(lineaCode || '').trim();
    if (!k) return [];
    if (deptosCache[k]) return deptosCache[k];

    const res = await fetch(`${baseUrl}/api/dimensiones/departamento?linea=${encodeURIComponent(k)}`);
    const j = await res.json();
    const arr = Array.isArray(j) ? j : [];
    setDeptosCache(prev => ({ ...prev, [k]: arr }));
    return arr;
  }

  function deptoListForRow(lineaCode) {
    const k = String(lineaCode || '').trim();
    return k && deptosCache[k] ? deptosCache[k] : [];
  }
  function deptoOptsForRow(lineaCode) {
    const list = deptoListForRow(lineaCode);
    return (list || []).map(o => ({ value: o.code, label: `${o.code} — ${o.name}` }));
  }

  const buildCabecera = (d) => {
    const c = d?.Cabecera || {};
    const s = (v) => (v ?? '').toString();
    const normDate = (v) => {
      const txt = s(v);
      if (!txt) return '';
      if (txt.includes('Date(')) {
        const ms = parseInt(txt.replace(/[^0-9]/g, ''), 10);
        if (!Number.isNaN(ms)) return new Date(ms).toISOString().slice(0, 10);
      }
      return txt.slice(0, 10);
    };

    return {
      CardCode: s(c.CardCode),
      CardName: s(c.CardName || ''),
      DocDate: normDate(c.DocDate),
      DocDueDate: normDate(c.DocDueDate),

      Serie: s(c.Serie),
      PtoEmi: s(c.PtoEmi),
      Secuencial: s(c.Secuencial),
      NumAtCard: s(c.NumAtCard || `${c.Serie}-${c.PtoEmi}${c.Secuencial}`),

      NroAutorizacion: s(c.NroAutorizacion || ''),
      FechaAutorizacion: normDate(c.FechaAutorizacion),

      TipoEmision: s(c.TipoEmision || 'E'),
      TipoDoc: s(c.TipoDoc || '01'),
      FormaPago: s(c.FormaPago || '20'),
      TipoPago: s(c.TipoPago || '01'),

      Comments: s(c.Comments || ''),
      IdSustentoTributario: s(c.IdSustentoTributario || '01'),

      DocTotal: Number(c.DocTotal ?? 0),
    };
  };

  const [cabecera, setCabecera] = useState(() => buildCabecera(draft));

  const [rows, setRows] = useState(() =>
    ((draft?.Lineas || [])).map((ln) => ({
      ItemCode: ln.ItemCode || '',
      Descripcion: ln.ItemDescription || '',
      Cantidad: n2(ln.Quantity ?? 1),
      Precio: n2(ln.UnitPrice ?? 0),
      Descuento: n2(ln.DiscountPercent ?? 0),
      TaxCode: ln.TaxCode || 'IVA_15',

      CostingCode:  ln.CostingCode  || '',
      CostingCode2: ln.CostingCode2 || '',
      CostingCode3: ln.CostingCode3 || '',

      IdSustentoTributario: ln.U_SYP_CODIDTRD || (draft?.Cabecera?.IdSustentoTributario ?? '01'),
    }))
  );

  const [finalizado, setFinalizado] = useState(false);
  const readOnlyTotal = (modo === "facturas_sap") && finalizado;

  const setCab = (k, v) => {
    if (readOnlyTotal) return;
    setCabecera(p => ({ ...p, [k]: v }));
  };

  const updateRow = (ix, patch) => {
    if (readOnlyTotal) return;
    setRows(prev => prev.map((r, i) => (i === ix ? { ...r, ...patch } : r)));
  };

  useEffect(() => {
    if (!open) return;
    setMsg(null);
    setFinalizado(false);

    setDraft(data || null);
    setCabecera(buildCabecera(data || null));
    setRows(((data?.Lineas || [])).map((ln) => ({
      ItemCode: ln.ItemCode || '',
      Descripcion: ln.ItemDescription || '',
      Cantidad: n2(ln.Quantity ?? 1),
      Precio: n2(ln.UnitPrice ?? 0),
      Descuento: n2(ln.DiscountPercent ?? 0),
      TaxCode: ln.TaxCode || 'IVA_15',
      CostingCode:  ln.CostingCode  || '',
      CostingCode2: ln.CostingCode2 || '',
      CostingCode3: ln.CostingCode3 || '',
      IdSustentoTributario: ln.U_SYP_CODIDTRD || (data?.Cabecera?.IdSustentoTributario ?? '01'),
    })));

    setEst(String(data?.Cabecera?.Serie || ''));
    setPto(String(data?.Cabecera?.PtoEmi || ''));
    setSec(String(data?.Cabecera?.Secuencial || ''));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data?.DocEntry]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [a, b] = await Promise.all([
          fetch(`${baseUrl}/api/dimensiones/linea`).then(r => r.json()),
          fetch(`${baseUrl}/api/dimensiones/region`).then(r => r.json()),
        ]);
        setDLinea(a || []);
        setDRegion(b || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [open, baseUrl]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const unicas = Array.from(
        new Set((rows || []).map(r => String(r.CostingCode || '').trim()).filter(Boolean))
      );
      for (const l of unicas) {
        try { await getDeptosByLinea(l); } catch {}
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dimOptsLinea  = useMemo(() => (dLinea || []).map(o => ({ value: o.code, label: `${o.code} — ${o.name}` })), [dLinea]);
  const dimOptsRegion = useMemo(() => (dRegion || []).map(o => ({ value: o.code, label: `${o.code} — ${o.name}` })), [dRegion]);

  const ivaOpts = useMemo(() => IVA_OPTS.map(o => ({ value: o.value, label: o.label })), []);
  const sustentoOpts = useMemo(() => SUSTENTO_OPTS.map(o => ({ value: o.value, label: o.label })), []);

  const resumen = useMemo(() => {
    let sub = 0, ivaBase = 0;
    for (const r of rows) {
      const base = Math.max(0, n2(r.Cantidad) * n2(r.Precio));
      const disc = base * (n2(r.Descuento) / 100);
      const line = Math.max(0, base - disc);
      sub += line;
      if ((r.TaxCode || 'IVA_15') !== 'IVA_0') ivaBase += line;
    }
    const iva = +(ivaBase * 0.15).toFixed(2);
    const total = +(sub + iva).toFixed(2);
    return { sub: +sub.toFixed(2), iva, total };
  }, [rows]);

  async function buscarDraftArticulo() {
    try {
      setSending(true); setMsg(null);

      const body = {
        Establecimiento: String(est || '').trim(),
        PuntoEmision: String(pto || '').trim(),
        Secuencial: String(sec || '').trim(),
      };
      if (!body.Establecimiento || !body.PuntoEmision || !body.Secuencial) {
        throw new Error('Completa Establecimiento, Punto Emisión y Secuencial.');
      }

      const res = await fetch(`${baseUrl}/api/oc/${data?.OcId || 0}/prefactura/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'No se pudo buscar el borrador');

      if (!j?.encontrado) {
        setMsg({ type: 'err', text: j?.mensaje || 'No existe Draft OPCH con esos datos.' });
        return;
      }

      setDraft(j);
      setCabecera(buildCabecera(j));
      setRows((j.Lineas || []).map((ln) => ({
        ItemCode: ln.ItemCode || '',
        Descripcion: ln.ItemDescription || '',
        Cantidad: n2(ln.Quantity ?? 1),
        Precio: n2(ln.UnitPrice ?? 0),
        Descuento: n2(ln.DiscountPercent ?? 0),
        TaxCode: ln.TaxCode || 'IVA_15',
        CostingCode:  ln.CostingCode  || '',
        CostingCode2: ln.CostingCode2 || '',
        CostingCode3: ln.CostingCode3 || '',
        IdSustentoTributario: ln.U_SYP_CODIDTRD || (j?.Cabecera?.IdSustentoTributario ?? '01'),
      })));

      const unicas = Array.from(
        new Set((j.Lineas || []).map(r => String(r.CostingCode || '').trim()).filter(Boolean))
      );
      for (const l of unicas) {
        try { await getDeptosByLinea(l); } catch {}
      }

      setMsg({ type: 'ok', text: `Borrador encontrado: DocEntry #${j.DocEntry}` });
    } catch (e) {
      setMsg({ type: 'err', text: String(e?.message || e) });
    } finally {
      setSending(false);
    }
  }

  async function guardarBorradorArticulo() {
    try {
      setSending(true); setMsg(null);

      const docEntry = draft?.DocEntry;
      if (!docEntry) throw new Error('Primero busca el borrador (DocEntry).');

      for (let i = 0; i < rows.length; i++) {
        const it = String(rows[i]?.ItemCode || '').trim();
        if (!it) throw new Error(`Línea ${i + 1}: falta ItemCode`);
        const qty = Number(rows[i]?.Cantidad ?? 0);
        if (!qty || qty <= 0) throw new Error(`Línea ${i + 1}: Cantidad debe ser mayor a 0`);
      }

      for (let i = 0; i < rows.length; i++) {
        const ln = rows[i];
        const linea = String(ln?.CostingCode || '').trim();
        const region = String(ln?.CostingCode2 || '').trim();
        const depto = String(ln?.CostingCode3 || '').trim();

        if (!linea) throw new Error(`Línea ${i + 1}: falta Línea`);
        if (!region) throw new Error(`Línea ${i + 1}: falta Región`);
        if (!depto) throw new Error(`Línea ${i + 1}: falta Departamento`);
      }

      const payload = {
        ForceService: true, // ✅ SIEMPRE manda como SERVICIO por detrás
        Cabecera: {
          CardCode: cabecera.CardCode,
          CardName: cabecera.CardName,
          Comments: [
            'BORRADOR DE TIPO ARTICULO',
            cabecera.Comments || ''
          ].filter(Boolean).join(' | '),
          DocDate: cabecera.DocDate,
          DocDueDate: cabecera.DocDueDate,
          Serie: cabecera.Serie,
          PtoEmi: cabecera.PtoEmi,
          Secuencial: cabecera.Secuencial,
          NumAtCard: cabecera.NumAtCard,
          TipoDoc: cabecera.TipoDoc,
          TipoEmision: cabecera.TipoEmision,
          NroAutorizacion: cabecera.NroAutorizacion,
          FechaAutorizacion: cabecera.FechaAutorizacion,
          FormaPago: cabecera.FormaPago,
          TipoPago: cabecera.TipoPago,
          IdSustentoTributario: cabecera.IdSustentoTributario,
        },
        Lineas: rows.map((r) => ({
          ItemCode: String(r.ItemCode || '').trim(),     // UI lo manda, backend lo traduce a AccountCode
          Descripcion: String(r.Descripcion || ''),
          Cantidad: Number(r.Cantidad ?? 1),
          Quantity: Number(r.Cantidad ?? 1),
          Precio: Number(r.Precio ?? 0) || 0,
          UnitPrice: Number(r.Precio ?? 0) || 0,
          Descuento: Number(r.Descuento ?? 0) || 0,
          DiscountPercent: Number(r.Descuento ?? 0) || 0,
          TaxCode: (Number(r.Precio ?? 0) || 0) === 0 ? 'IVA_0' : (r.TaxCode || 'IVA_15'),
          CostingCode: String(r.CostingCode || ''),
          CostingCode2: String(r.CostingCode2 || ''),
          CostingCode3: String(r.CostingCode3 || ''),
          IdSustentoTributario: String(r.IdSustentoTributario || ''),
        })),
      };

      const res = await fetch(`${baseUrl}/api/oc/${data?.OcId || 0}/prefactura/preview/${docEntry}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'No se pudo actualizar el borrador');

      setMsg({ type: 'ok', text: 'Borrador actualizado en SAP (guardado como SERVICIO por detrás).' });
      onUse?.({ clase: 'ARTICULO', draftUpdated: true, docEntry });

      if (modo === 'facturas_sap') setFinalizado(true);

    } catch (e) {
      setMsg({ type: 'err', text: String(e?.message || e) });
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  const hasDraft = !!draft?.DocEntry;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalBox}>

        <div className={styles.modalHeader}>
          <div className={styles.titleRow}>
            <h3 className={styles.modalTitle}>
              Factura de Proveedores · ARTÍCULO {hasDraft ? `· Borrador #${draft.DocEntry}` : ''}
            </h3>
            <button type="button" className={styles.closeX} onClick={onClose} aria-label="Cerrar">×</button>
          </div>

          <div className={styles.inlineBar}>
            <div className={styles.helperNote}>
              {hasDraft
                ? '✅ Borrador cargado. Completa ItemCode/dimensiones y guarda.'
                : '🔎 Ingresa Establecimiento/Punto Emisión/Secuencial para traer el borrador desde SAP.'}
            </div>
          </div>
        </div>

        <div className={styles.modalContent}>
          {!hasDraft && (
            <div className={styles.form2}>
              <label className={styles.field}>
                <span>Establecimiento</span>
                <input value={est} onChange={e=>setEst(e.target.value)} placeholder="001" />
              </label>
              <label className={styles.field}>
                <span>Punto Emisión</span>
                <input value={pto} onChange={e=>setPto(e.target.value)} placeholder="002" />
              </label>
              <label className={styles.field}>
                <span>Secuencial</span>
                <input value={sec} onChange={e=>setSec(e.target.value)} placeholder="000012345" />
              </label>

              <div className={styles.actions} style={{ justifyContent: 'flex-start' }}>
                <button className={styles.primary} onClick={buscarDraftArticulo} disabled={sending}>
                  {sending ? 'Buscando…' : 'Buscar borrador'}
                </button>
              </div>

              {msg && <div className={msg.type === 'ok' ? styles.alertOk : styles.alertErr}>{msg.text}</div>}
            </div>
          )}

          {hasDraft && (
            <>
              <div className={styles.form2}>
                <label className={styles.field}>
                  <span>Proveedor</span>
                  <input readOnly value={cabecera.CardCode} title={t(cabecera.CardCode)} />
                </label>
                <label className={styles.field}>
                  <span>Nombre</span>
                  <input readOnly value={cabecera.CardName} title={t(cabecera.CardName)} />
                </label>

                <label className={styles.field}>
                  <span>Fecha contable</span>
                  <input type="date" value={cabecera.DocDate} onChange={e=>setCab('DocDate', e.target.value)} disabled={readOnlyTotal} />
                </label>
                <label className={styles.field}>
                  <span>Fecha vencimiento</span>
                  <input type="date" value={cabecera.DocDueDate} onChange={e=>setCab('DocDueDate', e.target.value)} disabled={readOnlyTotal} />
                </label>

                <label className={styles.field}>
                  <span>Serie</span>
                  <input readOnly value={cabecera.Serie} />
                </label>
                <label className={styles.field}>
                  <span>Pto. Emisión</span>
                  <input readOnly value={cabecera.PtoEmi} />
                </label>

                <label className={styles.field}>
                  <span>Secuencial</span>
                  <input value={cabecera.Secuencial} onChange={e=>setCab('Secuencial', e.target.value)} disabled={readOnlyTotal} />
                </label>
                <label className={styles.field}>
                  <span>NumAtCard</span>
                  <input value={cabecera.NumAtCard} onChange={e=>setCab('NumAtCard', e.target.value)} disabled={readOnlyTotal} />
                </label>

                <label className={`${styles.field} ${styles.fieldFull}`}>
                  <span>Comentarios</span>
                  <textarea rows={3} value={cabecera.Comments} onChange={e=>setCab('Comments', e.target.value)} disabled={readOnlyTotal} />
                </label>
              </div>

              <div className={styles.tableCard}>
                <div className={styles.tscroll}>
                  <div className={styles.tableGrid}>
                    <div className={styles.theadRow}>
                      <div className={`${styles.idx} ${styles.stickyHead}`}>#</div>
                      <div>Código artículo</div>
                      <div>Descripción</div>
                      <div>Cant.</div>
                      <div>Precio</div>
                      <div>Desc%</div>
                      <div>IVA</div>
                      <div>Línea*</div>
                      <div>Región*</div>
                      <div>Departamento*</div>
                      <div>Sustento</div>
                      <div className={styles.right}>Total</div>
                    </div>

                    {rows.map((ln, i) => {
                      const base = Math.max(0, n2(ln.Cantidad) * n2(ln.Precio));
                      const disc = base * (n2(ln.Descuento) / 100);
                      const total = Math.max(0, base - disc);

                      return (
                        <div className={styles.trowArticulo} key={i}>
                          <div className={`${styles.idx} ${styles.sticky}`}>{i + 1}</div>

                          <div>
                            <input
                              value={ln.ItemCode}
                              onChange={e => updateRow(i, { ItemCode: e.target.value })}
                              disabled={readOnlyTotal}
                              placeholder="AR-7200SR"
                              title={t(ln.ItemCode)}
                            />
                          </div>

                          <div>
                            <input
                              value={ln.Descripcion}
                              onChange={e => updateRow(i, { Descripcion: e.target.value })}
                              disabled={readOnlyTotal}
                              placeholder="Descripción"
                              title={t(ln.Descripcion)}
                            />
                          </div>

                          <div>
                            <input
                              type="number"
                              min={1}
                              step="1"
                              value={ln.Cantidad ?? 1}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                updateRow(i, { Cantidad: Number.isFinite(v) ? Math.max(1, v) : 1 });
                              }}
                              disabled={readOnlyTotal}
                            />
                          </div>

                          <div>
                            <input
                              type="number"
                              step="0.01"
                              className={styles.numInp}
                              value={ln.Precio}
                              onChange={e => updateRow(i, { Precio: e.target.value })}
                              disabled={readOnlyTotal}
                            />
                          </div>

                          <div>
                            <input
                              type="number"
                              step="0.01"
                              className={styles.numInp}
                              value={ln.Descuento}
                              onChange={e => updateRow(i, { Descuento: e.target.value })}
                              disabled={readOnlyTotal}
                            />
                          </div>

                          <div>
                            <SearchSelect
                              value={ln.TaxCode}
                              onChange={(v) => updateRow(i, { TaxCode: v })}
                              options={ivaOpts}
                              placeholder="IVA"
                              disabled={readOnlyTotal}
                              title={titleFromOpts(ln.TaxCode, IVA_OPTS)}
                              mode="dialog"
                              dialogTitle="Seleccionar IVA"
                              inputClassName={styles.ssInput}
                              clearable={false}
                            />
                          </div>

                          <div>
                            <SearchSelect
                              value={ln.CostingCode}
                              onChange={async (v) => {
                                updateRow(i, { CostingCode: v, CostingCode3: '' });
                                try { await getDeptosByLinea(v); } catch (e) { console.error(e); }
                              }}
                              options={dimOptsLinea}
                              placeholder="Línea"
                              disabled={readOnlyTotal}
                              title={titleFromDim(ln.CostingCode, dLinea)}
                              mode="dialog"
                              dialogTitle="Seleccionar línea"
                              inputClassName={styles.ssInput}
                            />
                          </div>

                          <div>
                            <SearchSelect
                              value={ln.CostingCode2}
                              onChange={(v) => updateRow(i, { CostingCode2: v })}
                              options={dimOptsRegion}
                              placeholder="Región"
                              disabled={readOnlyTotal}
                              title={titleFromDim(ln.CostingCode2, dRegion)}
                              mode="dialog"
                              dialogTitle="Seleccionar región"
                              inputClassName={styles.ssInput}
                            />
                          </div>

                          <div>
                            <SearchSelect
                              value={ln.CostingCode3}
                              onChange={(v) => updateRow(i, { CostingCode3: v })}
                              options={deptoOptsForRow(ln.CostingCode)}
                              placeholder={ln.CostingCode ? "Departamento" : "Primero seleccione línea"}
                              disabled={readOnlyTotal || !ln.CostingCode}
                              title={titleFromDim(ln.CostingCode3, deptoListForRow(ln.CostingCode))}
                              mode="dialog"
                              dialogTitle="Seleccionar departamento"
                              inputClassName={styles.ssInput}
                            />
                          </div>

                          <div>
                            <SearchSelect
                              value={ln.IdSustentoTributario}
                              onChange={(v) => updateRow(i, { IdSustentoTributario: v })}
                              options={sustentoOpts}
                              placeholder="Sustento"
                              disabled={readOnlyTotal || !!t(ln.IdSustentoTributario)}
                              title={titleFromOpts(ln.IdSustentoTributario, SUSTENTO_OPTS)}
                              mode="dialog"
                              dialogTitle="Seleccionar sustento"
                              inputClassName={styles.ssInput}
                              clearable={false}
                            />
                          </div>

                          <div className={styles.num}>{total.toFixed(2)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {msg && <div className={msg.type === 'ok' ? styles.alertOk : styles.alertErr}>{msg.text}</div>}
            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          <div className={styles.resumen}>
            <div><span>Subtotal</span><strong className={styles.num}>${resumen.sub.toFixed(2)}</strong></div>
            <div><span>IVA 15%</span><strong className={styles.num}>${resumen.iva.toFixed(2)}</strong></div>
            <div><span>Total calculado</span><strong className={styles.num}>${resumen.total.toFixed(2)}</strong></div>
            <div><span>Total borrador SAP</span><strong className={styles.num}>${Number(cabecera.DocTotal || 0).toFixed(2)}</strong></div>
          </div>

          <div className={styles.actions}>
            <button className={styles.secondary} onClick={onClose} disabled={sending}>Cerrar</button>

            {hasDraft && (
              <button className={styles.primary} onClick={guardarBorradorArticulo} disabled={sending || readOnlyTotal}>
                {sending ? 'Guardando…' : (readOnlyTotal ? 'Solo lectura' : 'Guardar borrador')}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
