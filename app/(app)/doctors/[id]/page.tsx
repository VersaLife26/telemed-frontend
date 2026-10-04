import type { Metadata } from "next";

import { SURFACE } from "@/lib/consumer/surface";
import AdminPage from "@/components/admin/pages/admin__doctors___id_";
import PatientPage from "@/components/consumer/pages/patient__doctors___id_";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Doctor, Specialty } from "@/lib/consumer/api/types";
import { specialtyLabel } from "@/lib/consumer/features/doctor-search";
import {
  doctorPublicUrl,
  doctorShareDescription,
  doctorShareImageUrl,
  isDoctorId,
  patientAppOrigin,
} from "@/lib/consumer/features/doctor-share";
import { formatMoney } from "@/lib/consumer/money";

/**
 * /doctors/[id] -- served by admin, patient.
 *
 * Route groups organise files; they do not namespace URLs. All three
 * surfaces publish this path, so one route file owns it and dispatches on
 * the surface this deployment was built for. Only the matching branch ships:
 * SURFACE is fixed at build time and the other imports are dead code.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  if (SURFACE === "admin") return { title: "Credential review" };
  if (SURFACE !== "patient") return {};

  const { id } = await params;
  if (!isDoctorId(id)) return { title: "Doctor" };

  try {
    const [doctor, specialties] = await Promise.all([
      apiFetch<Doctor>(`/api/v1/doctors/${id}`),
      apiFetch<Specialty[]>("/api/v1/specialties").catch(() => [] as Specialty[]),
    ]);
    const name = doctor.displayName?.trim() || "Doctor";
    const specialty = doctor.specialtyCode ? specialtyLabel(doctor.specialtyCode, specialties) : "";
    const description = doctorShareDescription({
      specialty,
      experienceYears: doctor.experienceYears,
      feeLabel: doctor.feeCents != null ? formatMoney(doctor.feeCents, doctor.currency || "LKR") : null,
      bio: doctor.bio,
    });
    const url = doctorPublicUrl(id);
    return {
      metadataBase: new URL(patientAppOrigin()),
      title: `${name} · VersaLife Health`,
      description,
      alternates: { canonical: url },
      openGraph: {
        title: name,
        description,
        url,
        siteName: "VersaLife Health",
        type: "profile",
        images: [{ url: doctorShareImageUrl(id), width: 1200, height: 630, alt: name }],
      },
      twitter: {
        card: "summary_large_image",
        title: name,
        description,
        images: [doctorShareImageUrl(id)],
      },
    };
  } catch {
    return { title: "Doctor" };
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (SURFACE === "admin") return <AdminPage params={params} />;
  return <PatientPage params={params} />;
}
