/**
 * Tipos (JSDoc) para RingCentral → Suscripción Webhook.
 * No afecta runtime; sirve para autocompletado/contratos.
 */

/**
 * @typedef {Object} RingCentralSubscriptionItem
 * @property {string} [id]
 * @property {string} [status]
 * @property {string} [expiration_time]
 * @property {{ address?: string }} [delivery_mode]
 * @property {string[]} [event_filters]
 */

/**
 * @typedef {Object} RingCentralSubscriptionDbLatest
 * @property {string|number} [id]
 * @property {string} [status]
 * @property {string} [expiration_time]
 * @property {string} [delivery_mode_address]
 * @property {string[]} [event_filters]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

/**
 * @typedef {Object} RingCentralSubscriptionsSummary
 * @property {number} [ringcentral_active_count]
 * @property {boolean} [address_matches_configured_webhook_url]
 * @property {boolean} [has_account_telephony_sessions_filter]
 */

/**
 * @typedef {Object} RingCentralSubscriptionStatusResponse
 * @property {boolean} [success]
 * @property {{ webhook_url?: string }} [config]
 * @property {{ latest?: RingCentralSubscriptionDbLatest, active?: boolean }} [db]
 * @property {{ subscriptions?: RingCentralSubscriptionItem[] }} [ringcentral]
 * @property {RingCentralSubscriptionsSummary} [summary]
 * @property {string} [message]
 */

export {};

