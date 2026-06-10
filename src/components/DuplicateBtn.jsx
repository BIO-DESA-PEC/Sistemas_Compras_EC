"use client";
import { useRouter } from "next/navigation";

export default function DuplicateBtn({ preocId, userId, enabled, resetCant=false, resetDesc=false, resetFechas=false }) {
  const router = useRouter();

  async function dup() {
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "https://compras-back-ec-prod.onrender.com";
    const r = await fetch(`${base}/api/preoc/${preocId}/duplicar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, resetCant, resetDesc, resetFechas }),
    });
    if (!r.ok) return alert(await r.text().catch(()=> "Error al duplicar"));
    const data = await r.json();
    router.push(`/preordenes/${data.IdPreOC}?edit=1`);
  }

  return (
    <button
      type="button"
      className="favStarBtn"
      title={enabled ? "Duplicar y editar" : "Marca como favorita para duplicar"}
      disabled={!enabled}
      onClick={dup}
      aria-disabled={!enabled}
    >
      ⧉
    </button>
  );
}
