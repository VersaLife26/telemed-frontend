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
  phone: "+94771234567",
  name: "Lasana Pahanga",
  address: "Colombo",
  date_of_birth: "1994-04-12",
  language: "en",
  version: 4,
};

test("profileDraftFromUser copies the editable fields and hides role", () => {
  const draft = profileDraftFromUser({ ...user, role: "patient" });
  assert.deepEqual(draft, {
    name: "Lasana Pahanga",
    phone: "+94771234567",
    address: "Colombo",
    dateOfBirth: "1994-04-12",
    sex: "",
    allergies: "",
  });
  assert.equal("role" in draft, false);
});

test("profileUpdateError refuses a blank name and a future date of birth", () => {
  assert.equal(profileUpdateError({ name: " ", phone: "", address: "", dateOfBirth: "", sex: "", allergies: "" }), "Enter your name.");
  assert.equal(
    profileUpdateError({ name: "Pat", phone: "", address: "", dateOfBirth: "2999-01-01", sex: "", allergies: "" }),
    "Date of birth cannot be in the future.",
  );
  assert.equal(profileUpdateError({ name: "Pat", phone: "077", address: "Kandy", dateOfBirth: "1990-01-01", sex: "", allergies: "" }), null);
});

test("profileUpdateBody sends name, phone, address, date of birth, sex and allergies with the observed version", () => {
  assert.deepEqual(
    profileUpdateBody(user, {
      name: " Lasana ",
      phone: "0771234567",
      address: " Kandy ",
      dateOfBirth: "1994-04-12",
      sex: "female",
      allergies: " Penicillin ",
    }),
    {
      name: "Lasana",
      phone: "0771234567",
      address: "Kandy",
      date_of_birth: "1994-04-12",
      sex: "female",
      allergies: "Penicillin",
      language: "en",
      version: 4,
    },
  );
});

test("profilePhotoSrc prefixes the BFF proxy path", () => {
  assert.equal(profilePhotoSrc(null), null);
  assert.equal(profilePhotoSrc("/users/me/photo?v=1"), "/api/proxy/users/me/photo?v=1");
  assert.equal(profilePhotoSrc("/doctors/d1/photo?v=9"), "/api/proxy/doctors/d1/photo?v=9");
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
    "Photo must be 2 MB or smaller.",
  );
  assert.equal(profilePhotoError({ type: "image/png", size: 100 } as File), null);
});
