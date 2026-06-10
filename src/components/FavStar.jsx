"use client";

import { useMemo, useState, useTransition } from "react";

export default function FavStar({
  preocId,
  userId,
  userEmail,     // opcional
  initial = false,
  size = 28,
  apiBase = process.env.NEXT_PUBLIC_BACKEND_URL || "https://compras-back-ec-prod.onrender.com",
  onToggled,     // 👈 callback para router.refresh()
}) {
  const [fav, setFav] = useState(!!initial);
  const [pending, startTransition] = useTransition();

  const nPreocId = useMemo(() => {
    const n = Number(preocId);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [preocId]);
  const nUserId = useMemo(() => {
    if (userId == null) return null;
    const n = Number(userId);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [userId]);

  const disabled = pending || !nPreocId || !nUserId;

  async function toggle() {
    if (disabled) return;
    const payload = { userId: nUserId, preocId: nPreocId, fav: !fav };
    setFav((v) => !v);
    try {
      const res = await fetch(`${apiBase}/api/preoc/favorites/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(userEmail ? { "X-User-Email": userEmail } : {}),
        },
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      onToggled?.(!fav);             // 👈 dispara refresh arriba
    } catch (e) {
      setFav((v) => !v);
      console.error(e);
      alert("No se pudo guardar favorito.");
    }
  }

  return (
    <button
      type="button"
      onClick={() => startTransition(toggle)}
      aria-label={fav ? "Quitar de favoritas" : "Marcar como favorita"}
      aria-pressed={fav}
      disabled={disabled}
      title={fav ? "Quitar de favoritas" : "Marcar como favorita"}
      style={{
        width: size,
        height: size,
        display: "inline-grid",
        placeItems: "center",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        background: "#fff",
        color: fav ? "#f59e0b" : "#64748b",
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: "0 1px 1px rgba(0,0,0,.04)",
      }}
    >
      <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>
        {fav ? "★" : "☆"}
      </span>
    </button>
  );
}
