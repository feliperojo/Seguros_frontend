/**
 * RingCentral → Suscripción Webhook (backend Laravel).
 * Endpoints bajo /api/integrations/ringcentral/subscriptions/*
 *
 * Nota: el manejo de Authorization y errores (401/403/500) lo centraliza `apiRequest`.
 */
import apiRequest from "./api";

const BASE = "integrations/ringcentral/subscriptions";

/**
 * GET /api/integrations/ringcentral/subscriptions/status?sync=1
 * @param {{ sync?: 0|1|boolean }} params
 * @returns {Promise<import("../types/ringcentralSubscriptions").RingCentralSubscriptionStatusResponse>}
 */
export async function getSubscriptionsStatus(params = {}) {
  const qs = new URLSearchParams();
  if (params.sync != null) qs.set("sync", params.sync ? "1" : "0");
  const query = qs.toString();
  return apiRequest(`${BASE}/status${query ? `?${query}` : ""}`, "GET");
}

/**
 * POST /api/integrations/ringcentral/subscriptions/ensure
 * Body opcional: { extension_ids, webhook_url, force_create }
 * @param {{
 *  extension_ids?: string[],
 *  webhook_url?: string,
 *  force_create?: boolean
 * }} body
 */
export async function ensureSubscription(body = {}) {
  return apiRequest(`${BASE}/ensure`, "POST", body);
}

export default {
  getSubscriptionsStatus,
  ensureSubscription,
};

