// src/app/lib/backend.js

// Base pública (llega al cliente). Ej.: http://127.0.0.1:8000
export const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL || "https://back-compras-ec.onrender.com";

// Helper para armar URLs de forma segura
function apiUrl(path, params) {
  const url = new URL(path, API_BASE);
  if (params && typeof params === "object") {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }
  return url.toString();
}

/* ================================
 * Utils
 * ================================ */
async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return `HTTP ${res.status}`;
  }
}

// Helper estricto para JSON
async function fetchJSON(pathOrUrl, opts = {}) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : apiUrl(pathOrUrl);

  const res = await fetch(url, {
    cache: "no-store",
    ...opts,
  });

  const text = await res.text();
  const ct = res.headers.get("content-type") || "";

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
  }

  if (!ct.includes("application/json")) {
    throw new Error(`Respuesta no JSON (ct=${ct}): ${text.slice(0, 300)}`);
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`JSON inválido: ${e?.message || e}`);
  }
}

async function fetchJSONBody(path, method, body) {
  return fetchJSON(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

/* ================================
 * Users / Overview
 * ================================ */
export async function getUserByEmail(email) {
  const url = apiUrl("/api/users/by-email", { email });
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export async function getOverview(userId) {
  const url = apiUrl("/api/stats/overview", { userId });
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

/* ================================
 * Órdenes de Compra (OC)
 * ================================ */
export async function getOCList({
  page = 1,
  pageSize = 20,
  estado = "",
  q = "",
  historico = "N",
  fechaDesde = "",
  fechaHasta = "",
} = {}) {
  const url = apiUrl("/api/oc", {
  page,
  pageSize,
  estado,
  q,
  historico,
  fechaDesde,
  fechaHasta,
});

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export async function getOC(id) {
  const url = apiUrl(`/api/oc/${id}`);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export async function updateOCHeader(id, payload) {
  const url = apiUrl(`/api/oc/${id}`);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export async function replaceOCDetail(id, detalle) {
  const url = apiUrl(`/api/oc/${id}/detalle`);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ detalle }),
  });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export async function updateOCState(idOC, body) {
  const url = apiUrl(`/api/oc/${idOC}/estado`);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export async function updatePagoOC(idOC, payload) {
  const url = apiUrl(`/api/oc/${idOC}/pago`);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

/* ================================
 * Aprobaciones (genérico)
 * ================================ */
export async function getPendingApprovals(userId) {
  const url = apiUrl("/api/approvals/pending", { userId });
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export async function postApprovalsDecide(
  actorId,
  approvalIds,
  action,
  comentario
) {
  const url = apiUrl("/api/approvals/decide-batch");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      actorId: Number(actorId),
      approvalIds: (approvalIds || []).map(Number),
      action,
      comentario: comentario || "",
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || Number(data?.errors || 0) > 0) {
    throw new Error(
      data?.messages?.join("\n") ||
      data?.error ||
      "No se pudo completar la aprobación."
    );
  }

  return data;
}

/* ================================
 * Aprobación a nivel OC
 * ================================ */
export async function requestOCApproval(idOC, payload) {
  const res = await fetch(`${API_BASE}/api/oc/${idOC}/request-approval`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Error solicitando aprobación OC");
  return data;
}

export async function getOCApprovalStatus(idOC) {
  const url = apiUrl(`/api/oc/${idOC}/approval/status`);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

/* ================================
 * Prefactura OC
 * ================================ */
export async function createPrefacturaOC(idOC, body) {
  const url = apiUrl(`/api/ov/${idOC}/prefactura`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export async function getPrefacturaStatus(idOC) {
  const url = apiUrl(`/api/ov/${idOC}/prefactura/status`);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export async function getOVPending(userId) {
  const url = apiUrl("/api/ov/prefactura/pending", { userId });
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export async function approveOVDraft(idDraft, UsuarioId, Comentario = "") {
  const url = apiUrl(`/api/ov/prefactura/${idDraft}/aprobar`);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ UsuarioId, Comentario }),
  });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export async function rejectOVDraft(idDraft, UsuarioId, Comentario = "") {
  const url = apiUrl(`/api/ov/prefactura/${idDraft}/rechazar`);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ UsuarioId, Comentario }),
  });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export async function previewPrefacturaOC(idOC, payload) {
  const res = await fetch(`${API_BASE}/api/oc/${idOC}/prefactura/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Error al previsualizar prefactura");
  return data;
}

export async function persistFacturaSnapshotOC(idOC, docEntry, payload) {
  return fetchJSON(apiUrl(`/api/oc/${idOC}/prefactura/preview/${docEntry}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/* ================================
 * Pre-Órdenes
 * ================================ */
export async function listPreOCs({
  page = 1,
  pageSize = 20,
  estado = "",
  q = "",
  userId,
  historico = "N",
}) {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL;
  const url = new URL(`${base}/api/preoc`);

  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));

  if (estado) url.searchParams.set("estado", estado);
  if (q) url.searchParams.set("q", q);
  if (userId) url.searchParams.set("userId", userId);

  // ✅ ESTO ES LO QUE TE FALTA
  if (historico === "Y") {
    url.searchParams.set("historico", "Y");
  } else {
    url.searchParams.set("historico", "N");
  }

  const res = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

// Alias por compatibilidad
export async function listPreOC(params = {}) {
  return listPreOCs(params);
}

export async function getPreOC(idPreOC) {
  const url = apiUrl(`/api/preoc/${idPreOC}`);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export async function replacePreOCDetail(idPreOC, detalle) {
  const url = apiUrl(`/api/preoc/${idPreOC}/detalle`);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ detalle }),
  });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export async function splitPreOC(idPreOC) {
  const url = apiUrl(`/api/preoc/${idPreOC}/generar-oc`);
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export async function updatePreOCPago(idPreOC, payload) {
  const url = apiUrl(`/api/preoc/${idPreOC}/pago`);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export async function toggleFavoritePreOC(userId, preocId, fav) {
  const url = apiUrl(`/api/preoc/favorites/toggle`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ userId, preocId, fav }),
  });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export async function duplicatePreOC(idPreOC, payload) {
  const url = apiUrl(`/api/preoc/${idPreOC}/duplicar`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export async function createPreOCDirect({ userId, departamentoId, tipo, comentario }) {
  const url = apiUrl(`/api/preoc`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ userId, departamentoId, tipo, comentario }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export async function unifyPreOCs(idsPreOC = [], comentario = "") {
  const url = apiUrl(`/api/preoc/unificar`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ idsPreOC, comentario }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

/* ================================
 * Facturas SAP
 * ================================ */
export async function getFacturasSap({ historico = "N" } = {}) {
  const url = apiUrl("/api/facturas-sap", { historico });
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(await safeText(res));
  }

  return res.json();
}

export async function getFacturaSapByDraft(docEntry) {
  const url = apiUrl(`/api/facturas-sap/${docEntry}`);
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(await safeText(res));
  }

  return res.json();
}

export async function uploadFacturaAdjuntoOC(
  idOc,
  { Establecimiento, PuntoEmision, Secuencial, file },
  userEmail
) {
  const fd = new FormData();
  fd.append("Establecimiento", Establecimiento);
  fd.append("PuntoEmision", PuntoEmision);
  fd.append("Secuencial", Secuencial);
  fd.append("file", file);

  const url = apiUrl(`/api/oc/${idOc}/factura/adjunto`);
  const res = await fetch(url, {
    method: "POST",
    body: fd,
    headers: {
      ...(userEmail ? { "X-User-Email": userEmail } : {}),
    },
  });

  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export async function listFacturaAdjuntosOC(idOc) {
  const url = apiUrl(`/api/oc/${idOc}/factura/adjuntos`);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export function downloadFacturaAdjuntoOC(idOc, idAdj) {
  return apiUrl(`/api/oc/${idOc}/factura/adjunto/${idAdj}/download`);
}

export async function getFacturaInfoOC(idOC) {
  const res = await fetch(`${API_BASE}/api/oc/${idOC}/factura-info`, {
    method: "GET",
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Error al obtener factura-info");
  return data;
}

export async function saveFacturaInfoOC(idOC, payload) {
  const res = await fetch(`${API_BASE}/api/oc/${idOC}/factura-info`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Error al guardar factura-info");
  return data;
}

export async function validarFacturaDuplicadaOC({
  establecimiento,
  puntoEmision,
  secuencial,
  cardCode,
  excludeIdOC,
}) {
  const url = apiUrl("/api/oc/factura-existe", {
    establecimiento,
    puntoEmision,
    secuencial,
    cardCode,
    excludeIdOC,
  });

  return fetchJSON(url);
}

/* ================================
 * Proveedores SAP
 * ================================ */
export async function getProveedoresSap({ q = "", top = 50 } = {}) {
  const url = apiUrl("/api/proveedores-sap", { q, top });
  return fetchJSON(url, { method: "GET" });
}

export async function getProveedorSapByCardCode(cardCode) {
  const url = apiUrl(`/api/proveedores-sap/${encodeURIComponent(cardCode)}`);
  return fetchJSON(url, { method: "GET" });
}

export async function getCondicionesPago() {
  const url = apiUrl("/api/proveedores/condiciones-pago");
  return fetchJSON(url, { method: "GET" });
}

export async function updateProveedorSap(cardcode, payload) {
  const url = apiUrl(`/api/proveedores-sap/${encodeURIComponent(cardcode)}`);
  return fetchJSON(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getProveedoresSapAll({ q = "" } = {}) {
  const url = apiUrl("/api/proveedores/all", { q });
  return fetchJSON(url, { method: "GET" });
}

export async function getFormasPago() {
  const url = apiUrl("/api/proveedores/formas-pago");
  return fetchJSON(url, { method: "GET" });
}

export async function solicitarCambioProveedor(cardcode, payload) {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL;

  if (payload.bank_cert) {
    const fd = new FormData();
    const { bank_cert, ...data } = payload;

    fd.append("data", JSON.stringify(data));
    fd.append("bank_cert", bank_cert);

    const res = await fetch(`${base}/api/proveedores-sap/${cardcode}/solicitar-cambio`, {
      method: "POST",
      body: fd,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Error solicitando cambio");
    return json;
  }

  const res = await fetch(`${base}/api/proveedores-sap/${cardcode}/solicitar-cambio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Error solicitando cambio");
  return json;
}

export async function updateFacturaSapDraft(idOC, docEntry, payload) {
  return fetchJSON(apiUrl(`/api/oc/${idOC}/prefactura/preview/${docEntry}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
export async function createOCDirecta(payload) {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL || "https://back-compras-ec.onrender.com";

  const res = await fetch(`${base}/api/oc-directa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || "No se pudo crear la OC directa.");
  }

  return data;
}

export async function crearOCDesdeAnticipo(idAnticipo, userId) {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL;

  const res = await fetch(`${base}/api/anticipos/${idAnticipo}/crear-oc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      userId,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "No se pudo crear la OC desde el anticipo.");
  }

  return data;
}

export async function crearDraftNotaVentaOC(idOC, payload) {
  return fetchJSON(apiUrl(`/api/oc/${idOC}/nota-venta/draft`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateComentarioDraftOC(idOC, docEntry, comentario) {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL || "https://back-compras-ec.onrender.com";

  const res = await fetch(`${base}/api/oc/${idOC}/draft/${docEntry}/comentario`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Comments: comentario }),
  });

  const j = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(j?.error || "No se pudo actualizar el comentario.");
  }

  return j;
}

export async function crearBorradorManualOC(idOC, payload) {
  const base =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "https://back-compras-ec.onrender.com";

  const res = await fetch(
    `${base}/api/oc/${idOC}/factura/crear-borrador-manual`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  const j = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      j?.sap_body ||
      j?.details ||
      j?.error ||
      "No se pudo crear el borrador manual."
    );
  }

  return j;
}

export async function getApprovedApprovals(userId) {
  const url = apiUrl("/api/approvals/approved", { userId });
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export async function getApprovedApprovalDetail(userId, solicitudId) {
  const url = apiUrl(
    `/api/approvals/approved/${solicitudId}/detail`,
    { userId }
  );

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.detalle ||
        data?.error ||
        "No se pudo consultar el detalle de la solicitud aprobada."
    );
  }

  return data;
}

export async function getPendingApprovalDetail(userId, approvalId) {
  const url = apiUrl(
    `/api/approvals/pending/${approvalId}/detail`,
    { userId }
  );

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.detalle ||
        data?.error ||
        "No se pudo consultar el detalle de la solicitud pendiente."
    );
  }

  return data;
}