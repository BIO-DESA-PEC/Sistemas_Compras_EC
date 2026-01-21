"use client";

export default function AnticipoCheck({ idSolicitud, tieneAnticipo, numeroAnticipo }) {
  const checked = !!tieneAnticipo;

  return (
    <input
      type="checkbox"
      title={checked ? `Ya tiene anticipo: ${numeroAnticipo || ""}` : "Crear anticipo"}
      checked={checked}
      disabled={checked}
      onChange={(e) => {
        if (e.target.checked && !checked) {
          window.location.href = `/anticipos?from=preorden&idSolicitud=${encodeURIComponent(
            idSolicitud
          )}`;
        }
      }}
      style={{ cursor: checked ? "not-allowed" : "pointer" }}
    />
  );
}
