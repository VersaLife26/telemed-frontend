export type PageMeta = {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
};

export type TelemedUser = {
  id: string;
  phone: string;
  email?: string | null;
  name?: string;
  address?: string;
  date_of_birth?: string | null;
  language?: string;
  role?: string;
  status?: string;
  version?: number;
};

export type Doctor = {
  id: string;
  user_id?: string;
  slmc_number?: string;
  specialty?: string;
  display_name?: string;
  languages?: string[];
  bio?: string;
  photo_url?: string | null;
  fee_cents?: number;
  currency?: string;
  rating?: number;
  review_count?: number;
  consultation_count?: number;
  verification_status?: string;
  experience_years?: number;
  next_available_at?: string | null;
};

export type Appointment = {
  id: string;
  patient_id?: string;
  doctor_id?: string;
  slot_id?: string;
  start_at?: string;
  end_at?: string;
  start_at_local?: string;
  end_at_local?: string;
  status?: string;
  amount_cents?: number;
  currency?: string;
  specialty?: string;
};

export type RescheduleRequest = {
  id: string;
  appointment_id: string;
  patient_id?: string;
  doctor_id?: string;
  original_start_at?: string;
  original_end_at?: string;
  original_start_at_local?: string;
  original_end_at_local?: string;
  proposed_start_at?: string;
  proposed_end_at?: string;
  proposed_start_at_local?: string;
  proposed_end_at_local?: string;
  reason?: string;
  status?: "pending" | "accepted" | "declined" | "expired" | string;
  decided_by_role?: string;
  created_at?: string;
};

export type EarlyJoinOffer = {
  appointment_id: string;
  consultation_id: string;
  scheduled_at?: string;
  offered_at?: string;
  response?: "accepted" | "declined" | string | null;
  responded_at?: string;
  status?: "offered" | "already_offered" | "already_waiting" | "declined" | string;
};

export type Slot = {
  id: string;
  doctor_id: string;
  start_at: string;
  end_at: string;
  start_at_local?: string;
  end_at_local?: string;
  duration_minutes?: number;
  status?: string;
};

export type WorkingHour = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
};

export type Payment = {
  id: string;
  appointment_id?: string;
  amount_cents?: number;
  currency?: string;
  provider?: string;
  status?: string;
  doctor_payout_cents?: number;
  commission_cents?: number;
  refunded_cents?: number;
  refunded_payout_cents?: number;
  payout_id?: string | null;
  succeeded_at?: string;
  created_at?: string;
};

export type OrderSummary = {
  payment_id?: string;
  appointment_id?: string;
  consultation_fee_cents?: number;
  discount_cents?: number;
  total_cents?: number;
  currency?: string;
  applied_promo_code?: string;
};

export type PaymentIntentView = {
  payment: Payment;
  client_secret?: string;
  redirect_url?: string;
  next_action?: string;
  order?: OrderSummary;
};

export type ICEServer = {
  urls: string[];
  username?: string;
  credential?: string;
};

export type JoinResult = {
  consultation_id: string;
  appointment_id: string;
  status: string;
  role: "patient" | "doctor" | string;
  token: string;
  token_expires_at?: string;
  room_name: string;

  /**
   * Which video stack this deployment runs. The client branches on THIS, not
   * on which URL happens to be non-empty -- reading a stale `livekit_url` and
   * handing it to a LiveKit SDK opens a socket speaking a different protocol
   * and hangs rather than failing.
   */
  provider?: "inhouse" | "livekit" | "mock" | string;

  /** Empty for every non-LiveKit provider. */
  livekit_url?: string;

  /** The platform's own signalling socket, absolute. Append ?token=. */
  signal_url?: string;

  /**
   * Where a recording would actually live: "server" (an SFU writes to object
   * storage), "client" (the doctor's browser records and it dies with the
   * tab), or "none". The consent copy depends on it -- a patient agreeing to
   * be recorded is entitled to know who keeps it.
   */
  recording_mode?: "server" | "client" | "none";

  /**
   * STUN/TURN servers, minted per join.
   *
   * Belt-and-braces: PeerCall takes its ICE config from the `welcome` frame
   * instead, which is the better source because it is refreshed on every
   * signalling reconnect. This copy is for pre-flight checks -- warning a user
   * before the camera comes on that no relay is configured.
   */
  ice_servers?: ICEServer[];
  scheduled_at?: string;
};

export type WaitingRoomStatus = {
  waiting?: boolean;
  position?: number;
  patients_ahead?: number;
  estimated_wait_seconds?: number;
};

export type Consultation = {
  id: string;
  appointment_id?: string;
  status?: string;
  room_name?: string;
  scheduled_at?: string;
  started_at?: string;
};

export type ClinicalNoteDiagnosis = {
  code: string;
  description?: string;
  is_primary?: boolean;
};

export type ClinicalNote = {
  id: string;
  appointment_id: string;
  doctor_id?: string;
  patient_id?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  diagnoses?: ClinicalNoteDiagnosis[];
  status?: string;
  finalised_at?: string;
  created_at?: string;
  updated_at?: string;
  version: number;
};

export type PrescriptionItem = {
  drug_name: string;
  strength?: string;
  form?: string;
  dosage: string;
  frequency: string;
  duration_days: number;
  quantity: number;
  instructions?: string;
  is_generic?: boolean;
};

export type Prescription = {
  id: string;
  appointment_id: string;
  doctor_id?: string;
  patient_id?: string;
  doctor_name?: string;
  doctor_slmc?: string;
  issued_at?: string;
  status?: string;
  items?: PrescriptionItem[];
};

export type PrescriptionPdf = {
  pdf_url: string;
  expires_in_seconds?: number;
};

export type VaultDocument = {
  id: string;
  owner_user_id?: string;
  uploaded_by?: string;
  document_type: string;
  filename: string;
  content_type?: string;
  size_bytes?: number;
  scan_status?: string;
  created_at?: string;
};

export type VaultDownload = {
  download_url: string;
  expires_in_seconds?: number;
  filename?: string;
  content_type?: string;
};

// ---------------------------------------------------------------------------
// Doctor-surface types. Kept in the shared module rather than a doctor-only one
// because the API envelope, the fetch client and the error shape are shared --
// splitting the types alone would mean two modules that must be imported
// together and can drift apart.
// ---------------------------------------------------------------------------

export type Payout = {
  id: string;
  doctor_id?: string;
  period_start?: string;
  period_end?: string;
  amount_cents?: number;
  currency?: string;
  payment_count?: number;
  status?: string;
  provider?: string;
  failure_reason?: string;
  initiated_at?: string;
  paid_at?: string;
  created_at?: string;
};

export type Icd10Code = {
  code: string;
  description: string;
  category?: string;
};

export type FormularyDrug = {
  id: string;
  name: string;
  generic_name?: string;
  strength?: string;
  form?: string;
  manufacturer?: string;
  category?: string;
  is_controlled?: boolean;
  is_generic?: boolean;
};
