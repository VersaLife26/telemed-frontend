"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/admin/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { endpoints } from "@/lib/admin/api/endpoints";
import type { Article, Drug, Specialty, Symptom } from "@/lib/admin/api/types";
import { formatDate } from "@/lib/admin/format";

import { ContentSection } from "./content-section";
import type { FieldSpec } from "./entity-editor";

/**
 * The four content types the admin service owns, on one route.
 *
 * Trilingual name fields (English, Sinhala, Tamil) are present on specialties
 * and symptoms because the patient app offers all three languages. English is
 * required and the other two are not: shipping a specialty with no Sinhala name
 * is a gap, shipping none at all is an outage.
 */

const activeField: FieldSpec = {
  name: "active",
  label: "Active",
  kind: "boolean",
  help: "Inactive entries stay in the database and in past records, but are not offered to patients.",
};

const codeField = (example: string): FieldSpec => ({
  name: "code",
  label: "Code",
  kind: "text",
  required: true,
  placeholder: example,
  help: "Stable identifier used by the other services. Changing it after launch orphans existing references.",
  validate: (value) =>
    typeof value === "string" && /^[a-z0-9_]+$/.test(value.trim())
      ? null
      : "Lowercase letters, digits and underscores only.",
});

function activeCell(active: boolean) {
  return active ? (
    <Badge variant="success">Active</Badge>
  ) : (
    <Badge variant="muted">Inactive</Badge>
  );
}

export function ContentTabs({
  specialties,
  symptoms,
  drugs,
  articles,
  readOnly,
}: {
  specialties: Specialty[];
  symptoms: Symptom[];
  drugs: Drug[];
  articles: Article[];
  readOnly: boolean;
}) {
  const specialtyColumns = React.useMemo<ColumnDef<Specialty, unknown>[]>(
    () => [
      { accessorKey: "code", header: "Code", cell: ({ row }) => <code className="text-xs">{row.original.code}</code> },
      { accessorKey: "name_en", header: "English" },
      { accessorKey: "name_si", header: "Sinhala", cell: ({ row }) => row.original.name_si ?? "—" },
      { accessorKey: "name_ta", header: "Tamil", cell: ({ row }) => row.original.name_ta ?? "—" },
      { accessorKey: "active", header: "Status", cell: ({ row }) => activeCell(row.original.active) },
    ],
    [],
  );

  const symptomColumns = React.useMemo<ColumnDef<Symptom, unknown>[]>(
    () => [
      { accessorKey: "code", header: "Code", cell: ({ row }) => <code className="text-xs">{row.original.code}</code> },
      { accessorKey: "name_en", header: "English" },
      {
        id: "specialties",
        header: "Routes to",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.specialty_codes.length > 0
            ? row.original.specialty_codes.join(", ")
            : "—",
      },
      { accessorKey: "active", header: "Status", cell: ({ row }) => activeCell(row.original.active) },
    ],
    [],
  );

  const drugColumns = React.useMemo<ColumnDef<Drug, unknown>[]>(
    () => [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "strength", header: "Strength", cell: ({ row }) => row.original.strength ?? "—" },
      { accessorKey: "form", header: "Form", cell: ({ row }) => row.original.form ?? "—" },
      {
        accessorKey: "manufacturer",
        header: "Manufacturer",
        cell: ({ row }) => row.original.manufacturer ?? "—",
      },
      { accessorKey: "active", header: "Status", cell: ({ row }) => activeCell(row.original.active) },
    ],
    [],
  );

  const articleColumns = React.useMemo<ColumnDef<Article, unknown>[]>(
    () => [
      { accessorKey: "title", header: "Title" },
      { accessorKey: "language", header: "Language", cell: ({ row }) => row.original.language.toUpperCase() },
      {
        accessorKey: "specialty_code",
        header: "Specialty",
        cell: ({ row }) => row.original.specialty_code ?? "General",
      },
      {
        accessorKey: "published",
        header: "Status",
        cell: ({ row }) =>
          row.original.published ? (
            <Badge variant="success">
              Published {row.original.published_at ? formatDate(row.original.published_at) : ""}
            </Badge>
          ) : (
            <Badge variant="muted">Draft</Badge>
          ),
      },
    ],
    [],
  );

  return (
    <Tabs defaultValue="specialties">
      <TabsList>
        <TabsTrigger value="specialties">Specialties</TabsTrigger>
        <TabsTrigger value="symptoms">Symptoms</TabsTrigger>
        <TabsTrigger value="drugs">Drug formulary</TabsTrigger>
        <TabsTrigger value="articles">Waiting-room articles</TabsTrigger>
      </TabsList>

      <TabsContent value="specialties">
        <ContentSection<Specialty>
          title="Specialties"
          description="Drives specialty search in the patient app and the specialty field on a doctor's registration."
          rows={specialties}
          columns={specialtyColumns}
          singular="Specialty"
          readOnly={readOnly}
          createPath={endpoints.content.specialty()}
          updatePath={(id) => endpoints.content.specialty(id)}
          fields={[
            codeField("cardiology"),
            { name: "name_en", label: "Name (English)", kind: "text", required: true },
            { name: "name_si", label: "Name (Sinhala)", kind: "text" },
            { name: "name_ta", label: "Name (Tamil)", kind: "text" },
            activeField,
          ]}
          toFormValues={(row) => ({
            code: row?.code ?? "",
            name_en: row?.name_en ?? "",
            name_si: row?.name_si ?? "",
            name_ta: row?.name_ta ?? "",
            active: row?.active ?? true,
          })}
          toPayload={(values) => values}
        />
      </TabsContent>

      <TabsContent value="symptoms">
        <ContentSection<Symptom>
          title="Symptoms"
          description="Offered during intake and used to route a patient to the right specialty."
          rows={symptoms}
          columns={symptomColumns}
          singular="Symptom"
          readOnly={readOnly}
          createPath={endpoints.content.symptom()}
          updatePath={(id) => endpoints.content.symptom(id)}
          fields={[
            codeField("chest_pain"),
            { name: "name_en", label: "Name (English)", kind: "text", required: true },
            { name: "name_si", label: "Name (Sinhala)", kind: "text" },
            { name: "name_ta", label: "Name (Tamil)", kind: "text" },
            {
              name: "specialty_codes",
              label: "Routes to specialties",
              kind: "list",
              placeholder: "cardiology, general_practice",
              help: "Comma separated specialty codes. A symptom with no route falls back to general practice.",
            },
            activeField,
          ]}
          toFormValues={(row) => ({
            code: row?.code ?? "",
            name_en: row?.name_en ?? "",
            name_si: row?.name_si ?? "",
            name_ta: row?.name_ta ?? "",
            specialty_codes: row?.specialty_codes ?? [],
            active: row?.active ?? true,
          })}
          toPayload={(values) => values}
        />
      </TabsContent>

      <TabsContent value="drugs">
        <ContentSection<Drug>
          title="Drug formulary"
          description="The Sri Lankan formulary a doctor searches when building a prescription. This console manages the catalogue; it never sees a prescription."
          rows={drugs}
          columns={drugColumns}
          singular="Drug"
          readOnly={readOnly}
          createPath={endpoints.content.drug()}
          updatePath={(id) => endpoints.content.drug(id)}
          fields={[
            { name: "name", label: "Name", kind: "text", required: true, placeholder: "Paracetamol" },
            { name: "strength", label: "Strength", kind: "text", placeholder: "500 mg" },
            { name: "form", label: "Form", kind: "text", placeholder: "Tablet" },
            { name: "manufacturer", label: "Manufacturer", kind: "text" },
            activeField,
          ]}
          toFormValues={(row) => ({
            name: row?.name ?? "",
            strength: row?.strength ?? "",
            form: row?.form ?? "",
            manufacturer: row?.manufacturer ?? "",
            active: row?.active ?? true,
          })}
          toPayload={(values) => values}
        />
      </TabsContent>

      <TabsContent value="articles">
        <ContentSection<Article>
          title="Waiting-room articles"
          description="Shown to patients while they wait for a doctor to admit them."
          rows={articles}
          columns={articleColumns}
          singular="Article"
          readOnly={readOnly}
          createPath={endpoints.content.article()}
          updatePath={(id) => endpoints.content.article(id)}
          fields={[
            { name: "title", label: "Title", kind: "text", required: true },
            {
              name: "slug",
              label: "Slug",
              kind: "text",
              required: true,
              placeholder: "managing-blood-pressure",
              validate: (value) =>
                typeof value === "string" && /^[a-z0-9-]+$/.test(value.trim())
                  ? null
                  : "Lowercase letters, digits and hyphens only.",
            },
            {
              name: "language",
              label: "Language",
              kind: "select",
              required: true,
              options: [
                { value: "en", label: "English" },
                { value: "si", label: "Sinhala" },
                { value: "ta", label: "Tamil" },
              ],
            },
            {
              name: "specialty_code",
              label: "Specialty",
              kind: "text",
              help: "Leave blank for a general article shown to every waiting patient.",
            },
            { name: "body", label: "Body", kind: "textarea", required: true },
            {
              name: "published",
              label: "Published",
              kind: "boolean",
              help: "Unpublished articles are never shown to patients.",
            },
          ]}
          toFormValues={(row) => ({
            title: row?.title ?? "",
            slug: row?.slug ?? "",
            language: row?.language ?? "en",
            specialty_code: row?.specialty_code ?? "",
            body: "",
            published: row?.published ?? false,
          })}
          toPayload={(values) => values}
        />
      </TabsContent>
    </Tabs>
  );
}
