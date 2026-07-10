// src/app/aprobaciones/page.jsx
import { redirect } from "next/navigation";

export default function AprobacionesIndex() {
  // Por defecto lleva a Solicitudes
  redirect("/aprobaciones/solicitudes");
}
