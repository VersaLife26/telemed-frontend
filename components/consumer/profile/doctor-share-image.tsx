import { ImageResponse } from "next/og";

import { apiFetch } from "@/lib/consumer/api/client";
import { API_BASE_URL } from "@/lib/consumer/env";
import type { Doctor, Specialty } from "@/lib/consumer/api/types";
import { specialtyLabel } from "@/lib/consumer/features/doctor-search";
import { clipText, doctorInitials, doctorShareBioLine } from "@/lib/consumer/features/doctor-share";
import { formatMoney } from "@/lib/consumer/money";

const WIDTH = 1200;
const HEIGHT = 630;

type Card = {
  name: string;
  specialty: string;
  meta: string;
  bio: string;
  photo: string | null;
};

/**
 * PNG card crawlers fetch for link previews. The photo is embedded at request
 * time because the API's photo URL expires after a few minutes.
 */
export async function shareImageResponse(doctorId: string): Promise<ImageResponse> {
  const card = await loadCard(doctorId);
  try {
    return new ImageResponse(cardMarkup(card), { width: WIDTH, height: HEIGHT });
  } catch {
    return new ImageResponse(cardMarkup({ ...card, photo: null }), { width: WIDTH, height: HEIGHT });
  }
}

async function loadCard(doctorId: string): Promise<Card> {
  const [doctor, specialties] = await Promise.all([
    apiFetch<Doctor>(`/api/v1/doctors/${doctorId}`),
    apiFetch<Specialty[]>("/api/v1/specialties").catch(() => [] as Specialty[]),
  ]);
  const name = clipText(doctor.displayName?.trim() || "Doctor", 32);
  const specialty = specialtyLabel(doctor.specialtyCode, specialties);
  const years = doctor.experienceYears ?? 0;
  const metaBits: string[] = [];
  if (years > 0) metaBits.push(`${years} ${years === 1 ? "year" : "years"} experience`);
  if (doctor.feeCents != null) metaBits.push(formatMoney(doctor.feeCents, doctor.currency || "LKR"));
  return {
    name,
    specialty: specialty === "—" ? "" : clipText(specialty, 40),
    meta: metaBits.join("  ·  "),
    bio: doctorShareBioLine(doctor.bio, 90),
    photo: await photoDataUrl(doctor.photoUrl),
  };
}

async function photoDataUrl(photoUrl?: string | null): Promise<string | null> {
  const raw = photoUrl?.trim();
  if (!raw) return null;
  const absolute = raw.startsWith("http://") || raw.startsWith("https://")
    ? raw
    : `${API_BASE_URL}${raw.startsWith("/") ? raw : `/${raw}`}`;
  try {
    const res = await fetch(absolute, { cache: "no-store" });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").split(";")[0]?.trim().toLowerCase();
    if (type !== "image/jpeg" && type !== "image/png" && type !== "image/webp") return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > 2_500_000) return null;
    return `data:${type};base64,${encodeBase64(bytes)}`;
  } catch {
    return null;
  }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function cardMarkup(card: Card) {
  const initials = doctorInitials(card.name);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "linear-gradient(135deg, #0c3d86 0%, #1a62c8 100%)",
        color: "#ffffff",
        padding: 56,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          width: 460,
          height: 518,
          borderRadius: 36,
          overflow: "hidden",
          background: "rgba(255,255,255,0.16)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {card.photo ? (
          // next/og paints this into a PNG. It is not a page image, so next/image does not apply.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.photo} width={460} height={518} alt="" style={{ objectFit: "cover" }} />
        ) : (
          <div style={{ display: "flex", fontSize: 140, fontWeight: 700 }}>{initials}</div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 560,
          marginLeft: 52,
          justifyContent: "center",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 3, opacity: 0.9 }}>
          VERSALIFE HEALTH
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.05,
            marginTop: 22,
          }}
        >
          {card.name}
        </div>
        {card.specialty ? (
          <div style={{ display: "flex", fontSize: 32, marginTop: 18 }}>{card.specialty}</div>
        ) : null}
        {card.meta ? (
          <div style={{ display: "flex", fontSize: 28, marginTop: 14, opacity: 0.95 }}>{card.meta}</div>
        ) : null}
        {card.bio ? (
          <div style={{ display: "flex", fontSize: 26, marginTop: 28, lineHeight: 1.35, opacity: 0.92 }}>
            {card.bio}
          </div>
        ) : null}
        <div style={{ display: "flex", fontSize: 24, marginTop: 36, letterSpacing: 0.4 }}>
          Book a consultation
        </div>
      </div>
    </div>
  );
}
