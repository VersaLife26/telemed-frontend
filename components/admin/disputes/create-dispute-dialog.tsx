"use client";

import * as React from "react";

import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Textarea } from "@/components/admin/ui/textarea";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiMutation } from "@/lib/admin/api/hooks";
import type { Dispute, DisputeCategory } from "@/lib/admin/api/types";

const CATEGORIES: DisputeCategory[] = [
  "billing",
  "quality_of_care",
  "no_show",
  "technical",
  "other",
];

export function CreateDisputeDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [appointmentId, setAppointmentId] = React.useState("");
  const [patientId, setPatientId] = React.useState("");
  const [doctorId, setDoctorId] = React.useState("");
  const [category, setCategory] = React.useState<DisputeCategory>("billing");
  const [description, setDescription] = React.useState("");
  const [refundRequested, setRefundRequested] = React.useState(false);

  const create = useApiMutation<Dispute, void>({
    method: "POST",
    path: () => endpoints.disputes.create(),
    body: () => ({
      appointment_id: appointmentId.trim(),
      patient_id: patientId.trim(),
      doctor_id: doctorId.trim(),
      category,
      description: description.trim(),
      refund_requested: refundRequested,
    }),
    successMessage: () => "Dispute opened.",
    onSuccess: () => {
      onClose();
      setAppointmentId("");
      setPatientId("");
      setDoctorId("");
      setDescription("");
      setRefundRequested(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a dispute</DialogTitle>
          <DialogDescription>
            Staff-raised case file. Refunds still need a separate approval on Payments.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Appointment ID" value={appointmentId} onChange={setAppointmentId} />
          <Field label="Patient ID" value={patientId} onChange={setPatientId} />
          <Field label="Doctor ID" value={doctorId} onChange={setDoctorId} />
          <div className="space-y-1">
            <Label htmlFor="dispute-category">Category</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as DisputeCategory)}>
              <SelectTrigger id="dispute-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="dispute-description">What happened</Label>
            <Textarea
              id="dispute-description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={refundRequested}
              onChange={(event) => setRefundRequested(event.target.checked)}
            />
            Refund requested
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={
              create.isPending ||
              appointmentId.trim().length < 8 ||
              patientId.trim().length < 8 ||
              doctorId.trim().length < 8 ||
              description.trim().length < 8
            }
            onClick={() => create.mutate()}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} className="font-mono text-xs" />
    </div>
  );
}
