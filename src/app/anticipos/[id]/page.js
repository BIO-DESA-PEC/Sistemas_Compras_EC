import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserByEmail } from "@/app/lib/backend";
import styles from "../../solicitudes/list.module.css";

async function fetchAnticipo(id) {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL;
  const res = await fetch(`${base}/api/anticipos/${id}`, { cache: "no-store" });

  if (!res.ok) throw new Error(await res.text());

  return res.json();
}

function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("es-EC");
}

export default async function AnticipoDetallePage({ params }) {
  const session = await auth();
  if (!session) redirect("/");

  const user = await getUserByEmail(session.user.email);
  if (!user) redirect("/");

  const anticipo = await fetchAnticipo(params.id);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>Detalle anticipo {anticipo.Codigo}</h1>

        <div className={styles.filters}>
          <a className={styles.chip} href="/anticipos">
            Volver
          </a>

          <a className={styles.chip} href={`/anticipos/${params.id}/estado`}>
            Cambiar estado
          </a>
        </div>
      </div>

      <div className={styles.card} style={{ padding: 24 }}>
        <h3>Información general</h3>

        <p><b>Estado:</b> {anticipo.Estado}</p>
        <p><b>Solicitante:</b> {anticipo.SolicitanteNombre}</p>
        <p><b>Correo:</b> {anticipo.SolicitanteCorreo}</p>
        <p><b>Departamento:</b> {anticipo.Departamento || "—"}</p>

        <hr />

        <p><b>Fecha:</b> {fmtDate(anticipo.Fecha)}</p>
        <p><b>Monto:</b> {anticipo.Monto} {anticipo.Moneda}</p>
        <p><b>Beneficiario:</b> {anticipo.BeneficiarioCheque}</p>
        <p><b>CI/DNI/RUC:</b> {anticipo.CiDniRuc}</p>
        <p><b>Motivo 1:</b> {anticipo.Motivo1}</p>
        <p><b>Motivo 2:</b> {anticipo.Motivo2 || "—"}</p>
        <p><b>Fecha máxima liquidación:</b> {fmtDate(anticipo.FechaMaximaLiquidacion)}</p>
        <p><b>Observación:</b> {anticipo.Observacion || "—"}</p>

        <hr />

        <p><b>Fecha creación:</b> {anticipo.FechaCreacion || "—"}</p>
        <p><b>Fecha aprobación:</b> {anticipo.FechaAprobacion || "—"}</p>
      </div>
    </div>
  );
}