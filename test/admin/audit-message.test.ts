import assert from "node:assert/strict";
import test from "node:test";

import { describeAuditActivity, describeAuditActor } from "@/lib/admin/audit-message";

test("audit activity names the thing that changed, not only created/updated", () => {
  assert.equal(
    describeAuditActivity({ action: "created", entityType: "appointments", changes: {} }),
    "Appointment created",
  );
  assert.equal(
    describeAuditActivity({ action: "created", entityType: "payments", changes: {} }),
    "Payment created",
  );
  assert.equal(
    describeAuditActivity({ action: "logged_in", entityType: "sessions", changes: {} }),
    "Logged in",
  );
  assert.equal(
    describeAuditActivity({ action: "logged_out", entityType: "sessions", changes: {} }),
    "Logged out",
  );
  assert.equal(
    describeAuditActivity({ action: "updated", entityType: "users", changes: { full_name: { old: "A", new: "B" } } }),
    "Updated profile",
  );
  assert.equal(
    describeAuditActivity({
      action: "updated",
      entityType: "appointments",
      changes: { status: { old: "confirmed", new: "cancelled" } },
    }),
    "Appointment cancelled",
  );
  assert.equal(
    describeAuditActivity({
      action: "updated",
      entityType: "payments",
      changes: { status: { old: "pending", new: "succeeded" } },
    }),
    "Payment succeeded",
  );
  assert.equal(
    describeAuditActivity({ action: "updated", entityType: "doctors", changes: {} }),
    "Updated doctor profile",
  );
  assert.equal(
    describeAuditActivity({ action: "updated", entityType: "working_hours", changes: {} }),
    "Availability updated",
  );
});

test("audit actor names the patient or doctor whose activity is open", () => {
  assert.equal(
    describeAuditActor({ actorType: "user", actorId: "p1", actorEmail: null }, { id: "p1", role: "patient" }),
    "This patient",
  );
  assert.equal(
    describeAuditActor({ actorType: "user", actorId: "d1", actorEmail: null }, { id: "d1", role: "doctor" }),
    "This doctor",
  );
  assert.equal(
    describeAuditActor({ actorType: "admin", actorId: "a1", actorEmail: "ops@versalife.lk" }, { id: "p1" }),
    "Admin · ops@versalife.lk",
  );
});
