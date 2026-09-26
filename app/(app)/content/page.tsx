import type { Metadata } from "next";

import { adminRoles } from "@/lib/admin/auth/current";
import { ErrorState } from "@/components/admin/common/error-state";
import { PageHeader } from "@/components/admin/common/page-header";
import { ContentTabs } from "@/components/admin/content/content-tabs";
import { endpoints, query } from "@/lib/admin/api/endpoints";
import { routeFatal } from "@/lib/admin/api/guard";
import { tryGetServer, tryListServer } from "@/lib/admin/api/server";
import type { Drug, Specialty } from "@/lib/admin/api/types";
import { can } from "@/lib/admin/rbac";

export const metadata: Metadata = { title: "Content" };

/** Reference data the API owns: specialties and the drug formulary. */
export default async function ContentPage() {
  const readOnly = !can(await adminRoles(), "content");

  const [specialties, drugs] = await Promise.all([
    tryGetServer<Specialty[]>(endpoints.content.specialties()),
    tryListServer<Drug>(endpoints.content.drugs(query({ pageSize: 100 }))),
  ]);

  const header = (
    <PageHeader
      title="Content"
      description="Specialties and the drug formulary offered to patients and doctors."
    />
  );

  // If the first list fails with something fatal, route it; otherwise show the
  // sections that did load and report the ones that did not.
  if (!specialties.ok) routeFatal(specialties.error);

  const failures = [
    !specialties.ok ? { what: "specialties", error: specialties.error } : null,
    !drugs.ok ? { what: "the drug formulary", error: drugs.error } : null,
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
        specialties={specialties.ok ? specialties.data : []}
        drugs={drugs.ok ? drugs.page.items : []}
        readOnly={readOnly}
      />
    </>
  );
}
