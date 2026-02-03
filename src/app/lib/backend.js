// src/app/lib/backend.js

// Base pública (llega al cliente). Ej.: http://127.0.0.1:8000
export const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL || "https://back-compras-ec.onrender.com";

// Helper para armar URLs de forma segura
function apiUrl(path, params) {
  const url = new URL(path, API_BASE); // concatena BASE + path
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

// --- helpers estrictos para JSON (evitan "Unexpected token '<' ...") ---
async function fetchJSON(pathOrUrl, opts = {}) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : apiUrl(pathOrUrl);
  const res = await fetch(url, { cache: "no-store", ...opts });
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
export async function getOCList({ page = 1, pageSize = 20, estado = "", q = "" } = {}) {
  const url = apiUrl("/api/oc", { page, pageSize, estado, q });
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

/* ================================
 * Aprobaciones (genérico)
 * ================================ */
export async function getPendingApprovals(userId) {
  const url = apiUrl("/api/approvals/pending", { userId });
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

export async function postApprovalsDecide(actorId, approvalIds, action, comentario) {
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
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

/* ================================
 * Prefactura OC (flujo de aprobación para facturar)
 * ================================ */
export async function createPrefacturaOC(idOC, body) {
  // Backend expone /api/ov/:id/prefactura
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

// === NUEVO: listar prefacturas OC pendientes para un usuario ===
export async function getOVPending(userId) {
  const url = apiUrl("/api/ov/prefactura/pending", { userId });
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

// === NUEVO: aprobar prefactura (nivel actual) ===
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

// === NUEVO: rechazar prefactura (nivel actual) ===
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

export async function updatePagoOC(idOC, payload) {
  // usando apiUrl por consistencia
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
 * (NUEVO) Aprobación a nivel OC
 * ================================ */
// === Solicitar aprobación de OC al guardar detalle ===
export async function requestOCApproval(idOC, { autoApprove = false } = {}) {
  const url = apiUrl(`/api/oc/${idOC}/request-approval`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ autoApprove }),
  });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

// === Estado de la aprobación de OC ===
export async function getOCApprovalStatus(idOC) {
  const url = apiUrl(`/api/oc/${idOC}/approval/status`);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

/* ================================
 * (NUEVO) Preview de prefactura SAP
 * ================================ */
export async function previewPrefacturaOC(idOC, payload) {
  // Usa helpers estrictos para garantizar JSON válido
  return fetchJSONBody(`/api/oc/${idOC}/prefactura/preview`, "POST", payload);
}


/* ================================
 * (NUEVO) Pre-Órdenes de Compra
 * ================================ */

// Crear una Pre-Orden copiando una Solicitud
export async function listPreOC({ page = 1, pageSize = 20, estado = "", q = "" } = {}) {
  const url = apiUrl("/api/preoc", { page, pageSize, estado, q });
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
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
  const res = await fetch(url, { method: "POST", cache: "no-store" });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}
// === NUEVO: actualizar cabecera de Pre-Orden (días/forma pago)
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

// Lista todos los borradores para el módulo Facturas SAP
// Lista todos los borradores para el módulo Facturas SAP
export async function getFacturasSap() {
  const url = apiUrl("/api/facturas-sap");
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    // muestra status + texto real del backend
    throw new Error(await safeText(res));
  }

  return res.json();
}

// Trae un borrador específico por DocEntry
export async function getFacturaSapByDraft(docEntry) {
  const url = apiUrl(`/api/facturas-sap/${docEntry}`);
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(await safeText(res));
  }

  return res.json();
}

export async function uploadFacturaAdjuntoOC(idOc, { Establecimiento, PuntoEmision, Secuencial, file }, userEmail) {
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
  return await res.json();
}

export async function listFacturaAdjuntosOC(idOc) {
  const url = apiUrl(`/api/oc/${idOc}/factura/adjuntos`);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(await safeText(res));
  return await res.json();
}

export function downloadFacturaAdjuntoOC(idOc, idAdj) {
  // redirige a backend que a su vez redirige a downloadUrl temporal
  return apiUrl(`/api/oc/${idOc}/factura/adjunto/${idAdj}/download`);
}

export async function getFacturaInfoOC(idOC) {
  return fetchJSON(`/api/oc/${idOC}/factura-info`);
}

export async function saveFacturaInfoOC(idOC, payload) {
  return fetchJSON(`/api/oc/${idOC}/factura-info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
