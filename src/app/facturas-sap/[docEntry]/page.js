'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getFacturaSapByDraft } from '@/app/lib/backend';
import FacturaPreviewModal from '@/components/FacturaPreviewModal';
import { useSession } from "next-auth/react";
import { getUserByEmail } from "@/app/lib/backend";

export default function FacturaSAPDetalle() {
  const { docEntry } = useParams();
  const [factura, setFactura] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    async function fetchFactura() {
      try {
        const data = await getFacturaSapByDraft(Number(docEntry), devHeaders());
        setFactura(data);
      } catch (err) {
        console.error(err);
        setError('No se pudo cargar el borrador.');
      } finally {
        setLoading(false);
      }
    }
    fetchFactura();
  }, [docEntry]);

  if (loading) return <p>Cargando borrador...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (!factura) return <p>No se encontró la factura.</p>;

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>
        Editar Factura SAP (DocEntry #{docEntry})
      </h1>

      <FacturaPreviewModal
        initialData={{
          Cabecera: factura.Cabecera,
          Lineas: factura.Lineas,
          DocEntry: factura.DocEntry,
          IdOC: factura.IdOC,
        }}
        onClose={() => router.push('/facturas-sap')}
        modoEdicion={true}
      />
    </main>
  );
}
