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
import { Textarea } from "@/components/admin/ui/textarea";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiMutation } from "@/lib/admin/api/hooks";
import type { DisputeDetail } from "@/lib/admin/api/types";

export function CreateDisputeDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [appointmentId, setAppointmentId] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [description, setDescription] = React.useState("");

  const create = useApiMutation<DisputeDetail, void>({
    method: "POST",
    path: () => endpoints.disputes.create(),
    body: () => ({
      appointmentId: appointmentId.trim(),
      subject: subject.trim(),
      description: description.trim(),
    }),
    successMessage: () => "Dispute opened.",
    onSuccess: () => {
      onClose();
      setAppointmentId("");
      setSubject("");
      setDescription("");
    },
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a dispute</DialogTitle>
          <DialogDescription>
            Staff-raised case file. The patient and doctor are taken from the appointment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Appointment ID" value={appointmentId} onChange={setAppointmentId} />
          <div className="space-y-1">
            <Label htmlFor="dispute-subject">Subject</Label>
            <Input
              id="dispute-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="e.g. Doctor did not join the consultation"
            />
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={
              create.isPending ||
              appointmentId.trim().length < 8 ||
              subject.trim().length === 0 ||
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
