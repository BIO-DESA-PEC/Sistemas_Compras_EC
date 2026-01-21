'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getFacturaSapByDraft, getUserByEmail } from '@/app/lib/backend';
import FacturaPreviewModal from '@/components/FacturaPreviewModal';
import { useSession } from "next-auth/react";

export default function FacturaSAPDetalle() {
  const { docEntry } = useParams();
  const [factura, setFactura] = useState(null);
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  const { data: session } = useSession();

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const data = await getFacturaSapByDraft(Number(docEntry));
        if (!alive) return;
        setFactura(data);
      } catch (err) {
        console.error(err);
        setError('No se pudo cargar el borrador.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [docEntry]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const email = session?.user?.email;
        if (!email) return;

        const u = await getUserByEmail(email);
        if (!alive) return;

        setUser(u);
      } catch (e) {
        console.error(e);
      }
    })();

    return () => { alive = false; };
  }, [session?.user?.email]);

  if (loading) return <p>Cargando borrador...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (!factura) return <p>No se encontró la factura.</p>;
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>
        Editar Factura SAP (DocEntry #{docEntry})
      </h1>

      <FacturaPreviewModal
        open={true}
        data={{
          Cabecera: factura.Cabecera,
          Lineas: factura.Lineas,
          DocEntry: factura.DocEntry,
          OcId: factura.IdOC || factura.OcId,
          TipoOC: factura.TipoOC || "SERVICIO",
        }}
        onClose={() => router.push('/facturas-sap')}
        onUse={() => router.push('/facturas-sap')}

        // ✅ ESTO HACE QUE DATA/ADMIN PUEDAN EDITAR GASTO
        rolNombre={user?.RolNombre}
        rolId={user?.RolId}

        // ✅ tu lógica actual de Data lock
        modo="facturas_sap"
        lockSoloGasto={true}
      />
    </main>
  );
}
