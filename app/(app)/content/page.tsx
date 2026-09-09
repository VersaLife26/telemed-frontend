import type { Metadata } from "next";

import { auth } from "@/auth";
import { ErrorState } from "@/components/admin/common/error-state";
import { PageHeader } from "@/components/admin/common/page-header";
import { ContentTabs } from "@/components/admin/content/content-tabs";
import { endpoints, query } from "@/lib/admin/api/endpoints";
import { routeFatal } from "@/lib/admin/api/guard";
import { tryListServer } from "@/lib/admin/api/server";
import type { Article, Drug, Specialty, Symptom } from "@/lib/admin/api/types";
import { can } from "@/lib/admin/rbac";

export const metadata: Metadata = { title: "Content" };

/**
 * Reference data owned by telemed-admin-service (migration 000006).
 *
 * Other services do not read these tables — per ADR-004 there is no
 * cross-database join — they subscribe to the `content.*` events this service
 * publishes and keep their own local copy. So a save here is eventually
 * consistent everywhere else, and the UI says so rather than implying it is
 * instant.
 */
export default async function ContentPage() {
  const session = await auth();
  const readOnly = !can(session?.roles ?? [], "content");

  const page = query({ per_page: 200 });
  const [specialties, symptoms, drugs, articles] = await Promise.all([
    tryListServer<Specialty>(endpoints.content.specialties(page)),
    tryListServer<Symptom>(endpoints.content.symptoms(page)),
    tryListServer<Drug>(endpoints.content.drugs(page)),
    tryListServer<Article>(endpoints.content.articles(page)),
  ]);

  const header = (
    <PageHeader
      title="Content"
      description="Specialties, symptoms, the drug formulary and waiting-room articles. Changes publish content.* events; the patient and doctor apps pick them up asynchronously."
    />
  );

  // If the first list fails with something fatal, route it; otherwise show the
  // sections that did load and report the ones that did not.
  if (!specialties.ok && specialties.error.code !== "NOT_FOUND") {
    routeFatal(specialties.error);
  }

  const failures = [
    !specialties.ok ? { what: "specialties", error: specialties.error } : null,
    !symptoms.ok ? { what: "symptoms", error: symptoms.error } : null,
    !drugs.ok ? { what: "the drug formulary", error: drugs.error } : null,
    !articles.ok ? { what: "articles", error: articles.error } : null,
  ].filter((entry) => entry !== null);

  return (
    <>
      {header}

      {failures.length > 0 ? (
        <div className="mb-6 space-y-3">
          {failures.map((failure) => (
            <ErrorState key={failure.what} error={failure.error} what={failure.what} />
          ))}
        </div>
      ) : null}

      <ContentTabs
        specialties={specialties.ok ? specialties.page.data : []}
        symptoms={symptoms.ok ? symptoms.page.data : []}
        drugs={drugs.ok ? drugs.page.data : []}
        articles={articles.ok ? articles.page.data : []}
        readOnly={readOnly}
      />
    </>
  );
}
