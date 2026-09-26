import assert from "node:assert/strict";
import test from "node:test";

import type { TelemedUser } from "@/lib/consumer/api/types";
import {
  MAX_PROFILE_PHOTO_BYTES,
  profileDraftFromUser,
  profilePhotoError,
  profilePhotoSrc,
  profileUpdateBody,
  profileUpdateError,
} from "@/lib/consumer/features/profile";

const user: TelemedUser = {
  id: "u1",
  phoneNumber: "+94771234567",
  fullName: "Lasana Pahanga",
  address: "Colombo",
  dateOfBirth: "1994-04-12",
  language: "en",
  version: "AAAAAAAAB9E=",
};

const blank = { name: "", address: "", dateOfBirth: "", sex: "" as const, allergies: "" };

test("profileDraftFromUser copies the editable fields and hides role and identity", () => {
  const draft = profileDraftFromUser({ ...user, role: "patient" });
  assert.deepEqual(draft, {
    name: "Lasana Pahanga",
    address: "Colombo",
    dateOfBirth: "1994-04-12",
    sex: "",
    allergies: "",
  });
  assert.equal("role" in draft, false);
  assert.equal("phone" in draft, false);
});

test("profileUpdateError refuses a blank name and a future date of birth", () => {
  assert.equal(profileUpdateError({ ...blank, name: " " }), "Enter your name.");
  assert.equal(
    profileUpdateError({ ...blank, name: "Pat", dateOfBirth: "2999-01-01" }),
    "Date of birth cannot be in the future.",
  );
  assert.equal(profileUpdateError({ ...blank, name: "Pat", address: "Kandy", dateOfBirth: "1990-01-01" }), null);
});

test("profileUpdateBody sends the PUT /me fields with the observed version and nulls for blanks", () => {
  assert.deepEqual(
    profileUpdateBody(user, {
      name: " Lasana ",
      address: " Kandy ",
      dateOfBirth: "1994-04-12",
      sex: "female",
      allergies: " Penicillin ",
    }),
    {
      fullName: "Lasana",
      address: "Kandy",
      dateOfBirth: "1994-04-12",
      sex: "female",
      allergies: "Penicillin",
      language: "en",
      version: "AAAAAAAAB9E=",
    },
  );
  assert.deepEqual(profileUpdateBody(user, { ...blank, name: "Pat" }), {
    fullName: "Pat",
    address: null,
    dateOfBirth: null,
    sex: null,
    allergies: null,
    language: "en",
    version: "AAAAAAAAB9E=",
  });
});

test("profilePhotoSrc routes signed API paths through the BFF proxy", () => {
  assert.equal(profilePhotoSrc(null), null);
  assert.equal(profilePhotoSrc("/api/v1/files/abc.def"), "/api/proxy/files/abc.def");
  assert.equal(profilePhotoSrc("/api/proxy/files/abc.def"), "/api/proxy/files/abc.def");
  assert.equal(profilePhotoSrc("https://cdn.example/a.jpg"), "https://cdn.example/a.jpg");
});

test("profilePhotoError rejects unsupported types and oversized files", () => {
  assert.equal(profilePhotoError(null), "Choose a photo to upload.");
  assert.equal(
    profilePhotoError({ type: "image/gif", size: 10 } as File),
    "Use a JPEG, PNG, or WebP image.",
  );
  assert.equal(
    profilePhotoError({ type: "image/jpeg", size: MAX_PROFILE_PHOTO_BYTES + 1 } as File),
    "Photo must be 5 MB or smaller.",
  );
  assert.equal(profilePhotoError({ type: "image/png", size: 100 } as File), null);
});
