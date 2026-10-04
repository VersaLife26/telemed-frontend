export type GuideSurface = "patient" | "doctor";

export type GuideStep = {
  id: string;
  target: string;
  title: string;
  body: string;
};

export const PATIENT_GUIDE: readonly GuideStep[] = [
  {
    id: "home",
    target: "home",
    title: "Home",
    body: "Welcome to VersaLife. Home is where your next visit shows up, and where you start when you come back.",
  },
  {
    id: "doctors",
    target: "doctors",
    title: "Doctors",
    body: "Find a doctor by specialty, then choose a time that works.",
  },
  {
    id: "appointments",
    target: "appointments",
    title: "Appointments",
    body: "Upcoming and past visits live here, including the link to join a call.",
  },
  {
    id: "vault",
    target: "vault",
    title: "Vault",
    body: "Prescriptions, reports, and files from your visits are kept in the vault.",
  },
  {
    id: "profile",
    target: "profile",
    title: "Profile",
    body: "Your name, photo, and allergies live here. You can open this guide again from this page.",
  },
  {
    id: "care",
    target: "care",
    title: "Customer care",
    body: "This button reaches customer care. Use it for a refund, a visit problem, or any other question.",
  },
];

export const DOCTOR_GUIDE: readonly GuideStep[] = [
  {
    id: "dashboard",
    target: "dashboard",
    title: "Dashboard",
    body: "Welcome. The dashboard is today’s picture: who is waiting, and what needs you next.",
  },
  {
    id: "workspace",
    target: "workspace",
    title: "Workspace",
    body: "Workspace is the live visit. The call, your notes, and the prescription happen here.",
  },
  {
    id: "appointments",
    target: "appointments",
    title: "Visits",
    body: "Visits lists everyone booked with you, upcoming and past.",
  },
  {
    id: "calendar",
    target: "calendar",
    title: "Calendar",
    body: "Calendar shows the month, so you can see how the days fill up.",
  },
  {
    id: "queue",
    target: "queue",
    title: "Queue",
    body: "Queue is the line of patients waiting to be seen now.",
  },
  {
    id: "availability",
    target: "availability",
    title: "Availability",
    body: "Availability is when patients are allowed to book you.",
  },
  {
    id: "earnings",
    target: "earnings",
    title: "Earnings",
    body: "Earnings shows what visits have paid and what is still on the way.",
  },
  {
    id: "profile",
    target: "profile",
    title: "Profile",
    body: "Your photo, fee, languages, and documents live here. You can open this guide again from this page.",
  },
  {
    id: "care",
    target: "care",
    title: "Customer care",
    body: "This button reaches customer care, for a visit problem or anything you need from us.",
  },
];

const PATIENT_START = new Set(["/home", "/doctors", "/appointments", "/vault", "/profile"]);
const DOCTOR_START = new Set([
  "/dashboard",
  "/appointments",
  "/calendar",
  "/queue",
  "/availability",
  "/earnings",
  "/profile",
  "/verification-pending",
]);

export const REPLAY_GUIDE_EVENT = "telemed:replay-guide";

type GuideStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function guideSteps(surface: GuideSurface): readonly GuideStep[] {
  return surface === "doctor" ? DOCTOR_GUIDE : PATIENT_GUIDE;
}

export function guideStorageKey(surface: GuideSurface): string {
  return `versalife.guide.${surface}`;
}

export function readGuideSeen(storage: Pick<GuideStore, "getItem">, surface: GuideSurface): boolean {
  return storage.getItem(guideStorageKey(surface)) === "seen";
}

export function writeGuideSeen(storage: Pick<GuideStore, "setItem">, surface: GuideSurface): void {
  storage.setItem(guideStorageKey(surface), "seen");
}

export function clearGuideSeen(storage: Pick<GuideStore, "removeItem">, surface: GuideSurface): void {
  storage.removeItem(guideStorageKey(surface));
}

export function shouldAutoStartGuide(surface: GuideSurface, pathname: string, seen: boolean): boolean {
  if (seen) return false;
  const allowed = surface === "doctor" ? DOCTOR_START : PATIENT_START;
  return allowed.has(pathname);
}

/**
 * Drops steps whose target is not on screen. On a phone, doctor items that
 * live behind More collapse into a single step on that button.
 */
export function resolveGuideSteps(
  steps: readonly GuideStep[],
  visible: (target: string) => boolean,
): GuideStep[] {
  const hidden = steps.filter((step) => !visible(step.target));
  const more: GuideStep | null =
    hidden.length > 0 && visible("more")
      ? {
          id: "more",
          target: "more",
          title: "More",
          body: `On a phone, ${joinTitles(hidden)} sit under More.`,
        }
      : null;

  const resolved: GuideStep[] = [];
  let placedMore = false;
  for (const step of steps) {
    if (visible(step.target)) {
      resolved.push(step);
      continue;
    }
    if (more && !placedMore) {
      resolved.push(more);
      placedMore = true;
    }
  }
  return resolved;
}

function joinTitles(steps: readonly GuideStep[]): string {
  const titles = steps.map((step) => step.title);
  if (titles.length <= 1) return titles[0] ?? "";
  if (titles.length === 2) return `${titles[0]} and ${titles[1]}`;
  return `${titles.slice(0, -1).join(", ")}, and ${titles[titles.length - 1]}`;
}
