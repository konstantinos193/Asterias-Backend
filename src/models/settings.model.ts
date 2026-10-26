import { Schema as MongooseSchema } from 'mongoose';

/**
 * Property settings: one definition, from which everything else is derived.
 *
 * The field list used to be maintained in four places — the inline Mongoose
 * schema in settings.module.ts, the `Settings` interface, the `allowedFields`
 * allowlist in upsertSettings(), and `defaultSettings()` in AdminService — plus
 * a fifth copy of the tax figures in PricingService.TAX_DEFAULTS, joined to the
 * schema by a "keep in sync" comment in both directions. Adding one setting
 * meant five edits, and a mismatch between the schema default and the pricing
 * default would have charged guests a different amount from the one the admin
 * panel displayed.
 *
 * Every setting here has a consumer. Four that did not — `currency`,
 * `overbookingAllowed`, `automaticPricing` and `directBookingDiscount` — were
 * removed rather than left in a screen that pretends to do something:
 *   - `currency`: the property charges euro, the Stripe account settles in
 *     euro, and PricingService computes euro. See CURRENCY in common/enums.ts.
 *   - the other three describe features that do not exist. Re-add each one
 *     together with the code that reads it.
 */
export const SETTINGS_FIELDS = {
  /** Refuses public booking traffic with a 503. Read by MaintenanceModeGuard. */
  maintenanceMode: { type: Boolean, default: false },

  /** Master switch for all guest email. Read by EmailService.isEnabled(). */
  emailNotifications: { type: Boolean, default: true },
  /** Confirmation email after a booking is made. */
  bookingConfirmations: { type: Boolean, default: true },
  /** Arrival reminder and post-checkout review request. */
  reminderNotifications: { type: Boolean, default: true },
  /** Email to the owner when a booking arrives. */
  newBookingAlerts: { type: Boolean, default: true },
  /** Email to the owner when inventory runs low. */
  lowInventoryAlerts: { type: Boolean, default: true },

  /** How many hours before check-in the arrival reminder goes out. */
  reminderHours: { type: Number, default: 24 },

  /** Shown to guests and used in emails and the booking PDF. */
  checkInTime: { type: String, default: '15:00' },
  checkOutTime: { type: String, default: '11:00' },

  /** Days ahead a stay may start. Enforced by SettingsService.validateBookingRules(). */
  minAdvanceBooking: { type: Number, default: 1 },
  maxAdvanceBooking: { type: Number, default: 365 },

  /** Hours before check-in that a guest may still cancel. */
  cancellationPolicy: { type: Number, default: 48 },

  /**
   * Tax and fee figures, read by PricingService.
   *
   * Room rates are quoted VAT-inclusive — the owner's price list is what the
   * guest pays — so taxRate is 0 and adding VAT on top would overcharge. The
   * only extra a guest owes is the per-night municipal fee.
   */
  taxRate: { type: Number, default: 0 },
  municipalFee: { type: Number, default: 2.0 },
  environmentalTax: { type: Number, default: 0 },
} as const;

type ConstructorToType<T> = T extends BooleanConstructor
  ? boolean
  : T extends NumberConstructor
    ? number
    : T extends StringConstructor
      ? string
      : never;

/** Derived from SETTINGS_FIELDS — never written out by hand. */
export type Settings = {
  -readonly [K in keyof typeof SETTINGS_FIELDS]?: ConstructorToType<
    (typeof SETTINGS_FIELDS)[K]['type']
  >;
};

export type SettingKey = keyof typeof SETTINGS_FIELDS;

/** The keys an admin may write. Derived, so a new field is writable at once. */
export const SETTING_KEYS = Object.keys(SETTINGS_FIELDS) as SettingKey[];

/**
 * Defaults as a plain object, for callers that need a complete Settings before
 * the document exists. This is what the admin panel echoes back on a fresh
 * install, and what PricingService falls back to.
 */
export const SETTINGS_DEFAULTS = Object.fromEntries(
  Object.entries(SETTINGS_FIELDS).map(([key, field]) => [key, field.default]),
) as Required<Settings>;

export const SettingsSchema = new MongooseSchema(SETTINGS_FIELDS as any, { timestamps: true });

export const SETTINGS_MODEL_NAME = 'Settings';
