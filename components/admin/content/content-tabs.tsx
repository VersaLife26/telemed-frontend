"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/admin/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { endpoints } from "@/lib/admin/api/endpoints";
import type { Drug, Specialty } from "@/lib/admin/api/types";

import { ContentSection } from "./content-section";
import type { FieldSpec } from "./entity-editor";

/**
 * The content types the API owns, on one route.
 *
 * Specialties carry English, Sinhala and Tamil names because the patient app
 * offers all three languages; the API requires all three.
 */

const activeField: FieldSpec = {
  name: "isActive",
  label: "Active",
  kind: "boolean",
  help: "Inactive entries stay in the database and in past records, but are not offered to patients.",
};

const codeField = (example: string): FieldSpec => ({
  name: "code",
  label: "Code",
  kind: "text",
  required: true,
  fixedOnEdit: true,
  placeholder: example,
  help: "Stable identifier doctors and bookings reference. It cannot be changed after creation.",
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

const nameField = (name: string, label: string): FieldSpec => ({
  name,
  label,
  kind: "text",
  required: true,
});

const orNull = (value: unknown) =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

export function ContentTabs({
  specialties,
  drugs,
  readOnly,
}: {
  specialties: Specialty[];
  drugs: Drug[];
  readOnly: boolean;
}) {
  const specialtyColumns = React.useMemo<ColumnDef<Specialty, unknown>[]>(
    () => [
      { accessorKey: "code", header: "Code", cell: ({ row }) => <code className="text-xs">{row.original.code}</code> },
      { accessorKey: "nameEn", header: "English" },
      { accessorKey: "nameSi", header: "Sinhala" },
      { accessorKey: "nameTa", header: "Tamil" },
      { accessorKey: "displayOrder", header: "Order" },
      { accessorKey: "isActive", header: "Status", cell: ({ row }) => activeCell(row.original.isActive) },
    ],
    [],
  );

  const drugColumns = React.useMemo<ColumnDef<Drug, unknown>[]>(
    () => [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "genericName", header: "Generic name" },
      { accessorKey: "strength", header: "Strength" },
      { accessorKey: "form", header: "Form" },
      {
        accessorKey: "manufacturer",
        header: "Manufacturer",
        cell: ({ row }) => row.original.manufacturer ?? "—",
      },
      { accessorKey: "isActive", header: "Status", cell: ({ row }) => activeCell(row.original.isActive) },
    ],
    [],
  );

  return (
    <Tabs defaultValue="specialties">
      <TabsList>
        <TabsTrigger value="specialties">Specialties</TabsTrigger>
        <TabsTrigger value="drugs">Drug formulary</TabsTrigger>
      </TabsList>

      <TabsContent value="specialties">
        <ContentSection<Specialty>
          title="Specialties"
          description="Drives specialty search in the patient app and the specialty field on a doctor's registration."
          rows={specialties}
          columns={specialtyColumns}
          singular="Specialty"
          readOnly={readOnly}
          rowId={(row) => row.code}
          createPath={endpoints.content.specialty()}
          updatePath={(code) => endpoints.content.specialty(code)}
          fields={[
            codeField("cardiology"),
            nameField("nameEn", "Name (English)"),
            nameField("nameSi", "Name (Sinhala)"),
            nameField("nameTa", "Name (Tamil)"),
            {
              name: "displayOrder",
              label: "Display order",
              kind: "text",
              required: true,
              help: "Lower numbers are listed first.",
              validate: (value) =>
                typeof value === "string" && /^\d+$/.test(value.trim())
                  ? null
                  : "A whole number.",
            },
            activeField,
          ]}
          toFormValues={(row) => ({
            code: row?.code ?? "",
            nameEn: row?.nameEn ?? "",
            nameSi: row?.nameSi ?? "",
            nameTa: row?.nameTa ?? "",
            displayOrder: String(row?.displayOrder ?? 0),
            isActive: row?.isActive ?? true,
          })}
          toPayload={(values, row) => ({
            ...(row ? {} : { code: String(values.code).trim() }),
            nameEn: values.nameEn,
            nameSi: values.nameSi,
            nameTa: values.nameTa,
            displayOrder: Number(values.displayOrder),
            isActive: values.isActive,
          })}
        />
      </TabsContent>

      <TabsContent value="drugs">
        <ContentSection<Drug>
          title="Drug formulary"
          description="The formulary a doctor searches when building a prescription. This console manages the catalogue; it never sees a prescription."
          rows={drugs}
          columns={drugColumns}
          singular="Drug"
          readOnly={readOnly}
          rowId={(row) => row.id}
          createPath={endpoints.content.drug()}
          updatePath={(id) => endpoints.content.drug(id)}
          fields={[
            { name: "name", label: "Name", kind: "text", required: true, placeholder: "Panadol" },
            { name: "genericName", label: "Generic name", kind: "text", required: true, placeholder: "Paracetamol" },
            { name: "strength", label: "Strength", kind: "text", required: true, placeholder: "500 mg" },
            { name: "form", label: "Form", kind: "text", required: true, placeholder: "Tablet" },
            { name: "manufacturer", label: "Manufacturer", kind: "text" },
            { name: "category", label: "Category", kind: "text" },
            { name: "isGeneric", label: "Generic product", kind: "boolean" },
            { name: "isControlled", label: "Controlled drug", kind: "boolean" },
            activeField,
          ]}
          toFormValues={(row) => ({
            name: row?.name ?? "",
            genericName: row?.genericName ?? "",
            strength: row?.strength ?? "",
            form: row?.form ?? "",
            manufacturer: row?.manufacturer ?? "",
            category: row?.category ?? "",
            isGeneric: row?.isGeneric ?? false,
            isControlled: row?.isControlled ?? false,
            isActive: row?.isActive ?? true,
          })}
          toPayload={(values) => ({
            ...values,
            manufacturer: orNull(values.manufacturer),
            category: orNull(values.category),
          })}
        />
      </TabsContent>
    </Tabs>
  );
}
