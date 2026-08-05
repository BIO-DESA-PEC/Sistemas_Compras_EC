'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { unifyMonthlyOCs } from '@/app/lib/backend';
import styles from './ordenes.module.css';

export const MONTHLY_UNIFY_FORM_ID = 'monthly-orders-unify-form';

export default function MonthlyOrderUnifier() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const idsOC = formData.getAll('idsOC').map(Number).filter(Boolean);

    if (idsOC.length < 2) {
      alert('Selecciona al menos dos órdenes MENSUALES en estado GENERADA.');
      return;
    }

    if (!window.confirm(`¿Unificar las ${idsOC.length} órdenes seleccionadas en una sola OC?`)) {
      return;
    }

    try {
      setSaving(true);
      const result = await unifyMonthlyOCs(idsOC);
      alert(`Órdenes unificadas correctamente en la OC #${result.IdOC}.`);
      router.push(`/ordenes/${result.IdOC}`);
      router.refresh();
    } catch (error) {
      let message = error?.message || 'No se pudieron unificar las órdenes.';
      try {
        message = JSON.parse(message)?.error || message;
      } catch {}
      alert(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form id={MONTHLY_UNIFY_FORM_ID} onSubmit={onSubmit}>
      <button
        type="submit"
        className={`${styles.newBtn} ${styles.monthlyUnifyBtn}`}
        disabled={saving}
        title="Unificar órdenes mensuales en estado GENERADA"
      >
        {saving ? 'Unificando...' : 'Unificar mensuales'}
      </button>
    </form>
  );
}
