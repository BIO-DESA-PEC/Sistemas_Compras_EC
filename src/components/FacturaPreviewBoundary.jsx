'use client';

import { Component } from 'react';
import styles from './FacturaPreviewModal.module.css';

export default class FacturaPreviewBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Error al mostrar la factura de la OC', this.props.ocId, error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Error al mostrar factura">
        <div className={styles.modalBox}>
          <div className={styles.modalContent}>
            <p role="alert">No se pudo mostrar el detalle de la factura. Cierra este mensaje y vuelve a consultarla.</p>
            <details>
              <summary>Detalle del error</summary>
              <pre>{String(this.state.error?.message || this.state.error)}</pre>
            </details>
          </div>
          <div className={styles.modalFooter}>
            <button type="button" className={styles.secondary} onClick={this.props.onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    );
  }
}
