# Consolidation record — frontend

`telemed-patient-web`, `telemed-doctor-web` and `telemed-admin-web` merged into
one Next.js application, built once per surface and deployed to the three
subdomains they already occupy.

Baseline: the three repositories at their `main` HEADs on 9 September 2026,
tagged `pre-consolidation`.

| Suite | Before | After |
| --- | --- | --- |
| patient-web | 40 pass | 40 pass |
| doctor-web | 40 pass | 40 pass |
| admin-web | **could not run** — see below | 50 pass |

admin-web's test harness resolved its own directory with
`new URL(import.meta.url).pathname`, which is percent-encoded. In a checkout
whose path contains a space every `@/…` and relative import failed to resolve
and all five test files errored before running. Fixed with `fileURLToPath`
(twice — `here` and `resolveRelative`), which is why the admin suite now reports
50 passing tests rather than 5 failing files.

---

## The plan said "three route groups". That is not possible.

Route groups organise files; they do **not** namespace URLs. The three surfaces
publish nine of the same paths:

```
/                        patient  doctor  admin
/login                   patient  doctor  admin
/login/otp               patient  doctor
/register                patient  doctor
/profile                 patient  doctor
/appointments            patient          admin
/appointments/[id]/call  patient  doctor
/doctors                 patient          admin
/doctors/[id]            patient          admin      <- and [id] vs [doctorId]
```

Three parallel groups each defining `/login` is a build error, not a layout
choice. `/doctors/[doctorId]` beside `/doctors/[id]` is a second, separate
error — Next refuses two names for one dynamic position.

So the tree is grouped by **chrome**, which is what a route group is actually
for, and the nine shared paths are single route files that dispatch on the
surface:

```
app/
  layout.tsx                 one root layout; branches the html/body frame
  (auth)/                    login, login/otp, register, ip-blocked, no-access
  (app)/                     everything behind a session
  api/                       11 routes, patient+doctor unified, admin's kept
components/
  consumer/pages/            patient and doctor implementations of the 9
  admin/pages/               admin implementations of the 9
lib/surface-routes.ts        which URLs each surface actually serves
proxy.ts                     404s anything this surface does not own
```

A dispatcher is thin and explicit:

```tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (SURFACE === "admin") return <AdminPage params={params} />;
  return <PatientPage params={params} />;
}
```

Every URL is byte-identical to what the three apps served before. Nothing was
prefixed, moved or renamed in the URL space.

## Why three builds and not one

The plan assumed one build, three images. That does not survive contact with the
stylesheets: both surfaces run Tailwind v4 configured in CSS, and both declare
`@theme { --color-primary: … }` — the consumer apps mean `#015591`, the admin
console means `var(--primary)` from a shadcn token set. Importing both would let
one silently win for every `bg-primary` on the other surface, and CSS cannot
branch at runtime.

`scripts/select-surface.mjs` picks the stylesheet before the bundler runs, from
`TELEMED_SURFACE`. So: one source tree, three builds, three images — the same
shape as the backend's nine images from one module. It also means the other
surfaces' code is a dead branch rather than something every browser downloads.

## Security model — unchanged, and that is the point

Three origins, not one. `__Host-telemed-admin.session` only means anything on a
dedicated origin; the gateway splits `CORS_PATIENT/DOCTOR/ADMIN_ORIGINS` three
ways; `ADMIN_IP_ALLOWLIST` is scoped to the admin origin. One origin would put a
patient-facing XSS in the same cookie jar as the admin console.

`proxy.ts` adds one thing the three apps did not need: **surface scoping**. One
build contains every route for all three surfaces, so the patient deployment
must refuse `/audit` and `/users`. It would have failed on a missing admin
session anyway, but "it errors" is not an access control — `lib/surface-routes.ts`
is, and it answers 404 before any page module runs. The table is derived from
the three original route trees, so it records what each app already served.

The admin middleware (Auth.js session, role check, per-request CSP nonce) moved
to `lib/admin/proxy-impl.ts` and is reached by **dynamic** import. `@/auth`
builds the Auth.js instance at module load and needs `AUTH_SECRET`; a static
import would evaluate that in the patient and doctor builds too.

## What was deduplicated

Of the 38 files that shared a path between patient-web and doctor-web, 22 were
byte-identical and became one copy: the whole API client, the cookie layer, the
OTP and consult feature modules, every UI primitive, `video-call-client.tsx`.

Five differed in ways that are genuinely per-surface and are now one module
branching on `SURFACE`:

| Module | What differed |
| --- | --- |
| `lib/consumer/env.ts` | cookie names — now `telemed_${SURFACE}_access`. They must stay distinct: the two apps are sibling subdomains, and a shared name would let a doctor session be presented to the patient app. |
| `lib/consumer/auth/session.ts` | doctor required `role === "doctor"` and turned the gateway's 404 on Google sign-in into an instruction. Now `requiredRole()`, keyed on the surface. |
| `app/api/auth/google/route.ts` | `create_account: true` for patients, `false` for doctors — a doctor is onboarded through application and OTP, and minting one here would put an unverified clinician on the platform. |
| `components/consumer/shell-nav.tsx` | nav items and product name. |
| `lib/consumer/api/types.ts` | union of both. `Payment.appointment_id` takes doctor-web's **optional** form: a payout-linked payment carries no appointment, so patient-web's `required` was a claim the API does not make. |

`lib/` and `components/` are namespaced `consumer/` and `admin/` because three
files collided outright — `lib/api/envelope.ts`, `lib/api/types.ts` and
`lib/env.ts` mean different things in the two codebases.

## Behaviour changes

| # | Change | Why |
| --- | --- | --- |
| 1 | `Payment.appointment_id` is optional on the patient surface | See above — the union takes the honest form. TypeScript found no call site that assumed otherwise. |
| 2 | `export const dynamic = "force-dynamic"` now applies to the consumer surfaces' authenticated pages | It came from the admin console layout, and a route-segment config must be a literal Next can read without executing the module, so it cannot be conditional. Costs nothing: every page under `(app)` already reads the session cookie, so none was static. |
| 3 | The whole toolchain is Node 24 / TypeScript 7 | admin-web's. patient-web and doctor-web were on Node 20 / TS 5.9.3. `tsc --noEmit` is clean. |
| 4 | The lint toolchain is pinned exactly, not by caret range | A fresh lockfile resolved `eslint-plugin-react-hooks` 7.1.1 where admin-web shipped 7.0.1, and the newer rule set turned seven clean admin components into build failures. Consolidation should not silently adopt a newer linter. |
| 5 | Two lint rule sets, scoped by path | admin-web's config is far stricter (react-hooks, jsx-a11y, react). Applied to consumer code it turned twenty pre-existing patterns into errors. Each surface keeps the rules it was written against; the TypeScript parser applies to everything. |

## Verification

```
npm run typecheck    PASS
npm run lint         PASS  (0 errors, 2 warnings, both pre-existing)
npm run test:patient 40 pass, 0 fail
npm run test:doctor  40 pass, 0 fail
npm run test:admin   50 pass, 0 fail
next build           PASS for patient, doctor and admin
```

**Not verified here:** nothing was run against a live API gateway. The suites
are unit-level and the builds are static; a real sign-in, a real proxy round
trip and the golden-transcript replay all need the backend running, which needs
Docker, which is not available in this environment.
