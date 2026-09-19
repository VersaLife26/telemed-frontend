export const assets = {
  heroImage: "/assets/hero-image.png",
  logo: "/assets/logo.svg",
  logoSmall: "/assets/logo-small.svg",
  phoneIcon: "/assets/phone-icon.svg",
  settingsIcon: "/assets/settings-icon.svg",
  logoutIcon: "/assets/logout-icon.svg",
  avatarPlaceholder: "/assets/avatar-placeholder.png",
  doctorPhoto: "/assets/doctor-photo.png",
  patientPhoto: "/assets/patient-photo.png",
} as const;

/**
 * Editorial photography, from the design kit's UI kits.
 *
 * Hotlinked rather than vendored, which is a deliberate trade: it is a
 * third-party origin that sees the visitor's IP. `Referrer-Policy: no-referrer`
 * (next.config.ts) keeps the page URL out of the request, and every URL is
 * named here rather than inlined at a call site, so swapping to self-hosted
 * files later is a one-file change.
 *
 * These are decoration, never clinical content: the API's own doctor photos go
 * through `profilePhotoSrc`, and every slot below has a layout that survives
 * the image failing to load.
 */
function unsplash(id: string, width: number) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=70`;
}

export const stock = {
  /** Patient home hero — clinician with a tablet. */
  patientHero: unsplash("photo-1666214280557-f1b5022eb634", 720),
  /** Auth hero panel — consultation scene. */
  authHero: unsplash("photo-1612531386530-97286d97c2d2", 900),
  /** Doctor surface hero — ward round. */
  doctorHero: unsplash("photo-1550831107-1553da8c8464", 720),
  /** Waiting room ambience. */
  waitingRoom: unsplash("photo-1622253692010-333f2da6031d", 720),
  /** Fallbacks for directory tiles whose doctor has no uploaded photo. */
  portraits: [
    unsplash("photo-1584982751601-97dcc096659c", 400),
    unsplash("photo-1559839734-2b71ea197ec2", 400),
    unsplash("photo-1622902046580-2b47f47f5471", 400),
    unsplash("photo-1607990281513-2c110a25bd8c", 400),
  ],
} as const;

/**
 * A stable portrait for a doctor with no uploaded photo. Keyed off the id so
 * the same doctor gets the same face on every render and every device.
 */
export function fallbackPortrait(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return stock.portraits[hash % stock.portraits.length] ?? stock.portraits[0];
}
