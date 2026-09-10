'use client';

import { useState, useCallback } from 'react';
import styles from './Repositorio.module.css';
import { buscarRepositorioFacturas, facturaSriPdfUrl } from '@/app/lib/backend';

export default function RepositorioFacturasPage() {
  const [establecimiento, setEstablecimiento] = useState('');
  const [puntoEmision, setPuntoEmision] = useState('');
  const [secuencial, setSecuencial] = useState('');
  const [fecha, setFecha] = useState('');

  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const [resultados, setResultados] = useState(null); // null = aún no se buscó
  const [mensaje, setMensaje] = useState('');

  const buscar = useCallback(async () => {
    const est = establecimiento.trim();
    const pto = puntoEmision.trim();
    const sec = secuencial.trim();

    if (!est || !sec) {
      setError('Completa Establecimiento y Secuencial.');
      return;
    }
    if (!fecha) {
      setError('Indica la fecha de emisión de la factura.');
      return;
    }

    setBuscando(true);
    setError('');
    setMensaje('');
    setResultados(null);

    try {
      // Punto de emisión es opcional: varía por proveedor, así que si no se
      // conoce, se busca solo con Establecimiento + Secuencial + Fecha.
      const numeroFactura = pto ? `${est}-${pto}-${sec}` : `${est}-${sec}`;
      const resp = await buscarRepositorioFacturas({ numeroFactura, fechaEmision: fecha });

      const encontrados = Array.isArray(resp?.encontrados) ? resp.encontrados : [];
      setResultados(encontrados);

      if (encontrados.length === 0) {
        setMensaje(resp?.mensaje || 'No se encontró ningún comprobante con ese número en la fecha indicada.');
      } else if (encontrados.length > 1) {
        setMensaje(`Se encontraron ${encontrados.length} comprobantes que coinciden con ese número. Revisa cuál corresponde antes de descargar.`);
      }
    } catch (e) {
      setError(e?.message || 'No se pudo consultar el SRI.');
    } finally {
      setBuscando(false);
    }
  }, [establecimiento, puntoEmision, secuencial, fecha]);

  const onSubmit = (e) => {
    e.preventDefault();
    buscar();
  };

  const yaBusco = Array.isArray(resultados);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.headerIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M8 3h6l4 4v14H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
            <path d="M14 3v4h4" />
            <circle cx="10.5" cy="15.5" r="2.5" />
            <path d="M15 19l-2.4-2.4" />
          </svg>
        </div>
        <div>
          <h1 className={styles.title}>Repositorio de facturas</h1>
          <p className={styles.subtitle}>
            Busca cualquier factura recibida directamente en el SRI, sin necesidad
            de una orden de compra de referencia.
          </p>
        </div>
      </div>

      <form className={styles.card} onSubmit={onSubmit}>
        <div className={styles.formGrid}>
          <label>
            <span>Establecimiento</span>
            <input
              value={establecimiento}
              onChange={(e) => setEstablecimiento(e.target.value)}
              placeholder="001"
              maxLength={10}
            />
          </label>

          <label>
            <span>Punto de emisión (opcional)</span>
            <input
              value={puntoEmision}
              onChange={(e) => setPuntoEmision(e.target.value)}
              placeholder="001"
              maxLength={10}
            />
          </label>

          <label>
            <span>Secuencial</span>
            <input
              value={secuencial}
              onChange={(e) => setSecuencial(e.target.value)}
              placeholder="000000001"
              maxLength={20}
            />
          </label>

          <label>
            <span>Fecha de emisión</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </label>
        </div>

        <div className={styles.actions}>
          <button type="submit" className={styles.primary} disabled={buscando}>
            {buscando ? 'Buscando en el SRI…' : 'Buscar en el SRI'}
          </button>
        </div>
      </form>

      {error && <div className={styles.error}>{error}</div>}
      {!error && mensaje && <div className={styles.notice}>{mensaje}</div>}

      {!error && !mensaje && !yaBusco && !buscando && (
        <div className={styles.idle}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <p>Ingresa el número de factura y la fecha para empezar a buscar.</p>
        </div>
      )}

      {Array.isArray(resultados) && resultados.length > 0 && (
        <div className={styles.card}>
          <div className={styles.sectionTitle}>
            {resultados.length === 1 ? 'Comprobante encontrado' : `${resultados.length} comprobantes encontrados`}
          </div>

          <div className={styles.results}>
            {resultados.map((r, i) => (
              <div className={styles.resultRow} key={`${r.numeroAutorizacion || i}`}>
                <div className={styles.resultMain}>
                  <div className={styles.resultName}>{r.razonSocial || 'Proveedor sin nombre en SRI'}</div>
                  <div className={styles.resultMeta}>
                    Autorización: {r.numeroAutorizacion || '—'}
                    {r.fechaEmision ? ` · Emisión: ${r.fechaEmision}` : ''}
                    {r.tipoDocumento ? ` · Doc: ${r.tipoDocumento}` : ''}
                  </div>
                </div>

                <a
                  className={styles.downloadBtn}
                  href={facturaSriPdfUrl(r.pdfUrl)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
                    <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                  </svg>
                  Ver / Descargar PDF
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
