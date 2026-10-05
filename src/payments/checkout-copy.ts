/**
 * What the guest reads on the Stripe-hosted payment page. Stripe translates its
 * own chrome from `locale`; the line item and the note under the button are
 * ours, so they are written out here in the three site languages.
 */

export type CheckoutLocale = 'el' | 'en' | 'de';

export const CHECKOUT_LOCALES: CheckoutLocale[] = ['el', 'en', 'de'];

/** Public site. Stripe fetches the icon and room photos from here, so never localhost. */
export const SITE_URL = 'https://asteriashome.gr';

const COPY: Record<
  CheckoutLocale,
  {
    intl: string;
    nights: (n: number) => string;
    adults: (n: number) => string;
    children: (n: number) => string;
    taxes: string;
    submit: string;
  }
> = {
  el: {
    intl: 'el-GR',
    nights: (n) => (n === 1 ? '1 νύχτα' : `${n} νύχτες`),
    adults: (n) => (n === 1 ? '1 ενήλικας' : `${n} ενήλικες`),
    children: (n) => (n === 1 ? '1 παιδί' : `${n} παιδιά`),
    taxes: 'Περιλαμβάνονται ΦΠΑ, φόροι και τέλη',
    submit: 'Η κράτησή σας επιβεβαιώνεται αμέσως μετά την πληρωμή.',
  },
  en: {
    intl: 'en-GB',
    nights: (n) => (n === 1 ? '1 night' : `${n} nights`),
    adults: (n) => (n === 1 ? '1 adult' : `${n} adults`),
    children: (n) => (n === 1 ? '1 child' : `${n} children`),
    taxes: 'VAT, taxes and fees included',
    submit: 'Your booking is confirmed as soon as the payment goes through.',
  },
  de: {
    intl: 'de-DE',
    nights: (n) => (n === 1 ? '1 Nacht' : `${n} Nächte`),
    adults: (n) => (n === 1 ? '1 Erwachsener' : `${n} Erwachsene`),
    children: (n) => (n === 1 ? '1 Kind' : `${n} Kinder`),
    taxes: 'Inkl. MwSt., Steuern und Gebühren',
    submit: 'Ihre Buchung ist bestätigt, sobald die Zahlung eingegangen ist.',
  },
};

/** "16–20 Νοε 2026 · 4 νύχτες · 2 ενήλικες · Περιλαμβάνονται ΦΠΑ, φόροι και τέλη" */
export function stayDescription(
  lang: CheckoutLocale,
  checkIn: Date,
  checkOut: Date,
  nights: number,
  adults: number,
  children: number,
): string {
  const c = COPY[lang];
  // Stay dates are calendar days stored at UTC midnight.
  const dates = new Intl.DateTimeFormat(c.intl, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatRange(checkIn, checkOut);
  const guests = children > 0 ? `${c.adults(adults)}, ${c.children(children)}` : c.adults(adults);
  return [dates, c.nights(nights), guests, c.taxes].join(' · ');
}

export function submitNote(lang: CheckoutLocale): string {
  return COPY[lang].submit;
}

/** Room name in the guest's language, falling back to the stored English name. */
export function localizedRoomName(room: any, lang: CheckoutLocale): string {
  const translated = room?.translations?.[lang]?.name;
  return (typeof translated === 'string' && translated.trim()) || room?.name || 'Asterias Homes';
}

/**
 * Absolute URL Stripe can fetch for a room photo. Rooms store full URLs,
 * site-relative paths or bare upload filenames (served by the site's
 * /api/images proxy). Plain http (local backend) is unreachable for Stripe.
 */
export function publicImageUrl(src?: string): string | undefined {
  if (!src || typeof src !== 'string') return undefined;
  if (src.startsWith('https://')) return src;
  if (src.startsWith('http://')) return undefined;
  return `${SITE_URL}${src.startsWith('/') ? src : `/api/images/${src}`}`;
}
