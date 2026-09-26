import type { components } from "@/lib/api/schema";

type S = components["schemas"];

export type Paged<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export function totalPages(page: Pick<Paged<unknown>, "pageSize" | "total">): number {
  return page.pageSize > 0 ? Math.max(1, Math.ceil(page.total / page.pageSize)) : 1;
}

export type Sex = S["Sex"];
export type Language = S["Language"];
export type UserRole = S["UserRole"];
export type TelemedUser = S["MeDto"];
export type AuthResponse = S["AuthResponse"];
export type OtpSent = S["OtpSentResponse"];

export type Specialty = S["SpecialtyDto"];
export type DoctorQualification = S["QualificationDto"];
export type ConsultationLanguage = S["ConsultationLanguage"];
export type Doctor = S["PublicDoctorDto"];
export type DoctorProfile = S["DoctorProfileDto"];
export type DoctorSort = S["DoctorSort"];

export type AppointmentStatus = S["AppointmentStatus"];
export type Appointment = S["AppointmentDto"];
export type VisitPatient = S["VisitPatientDto"];
export type Intake = S["IntakeDto"];
export type BookAppointmentRequest = S["BookAppointmentRequest"];
export type LastVisitDetails = S["LastVisitDetailsDto"];
export type RescheduleRequest = S["RescheduleRequestDto"];
export type RescheduleDecision = S["RescheduleDecisionDto"];

export type Slot = S["SlotDto"];
export type Slots = S["SlotsDto"];
export type WorkingHour = S["WorkingHourDto"];
export type Schedule = S["ScheduleDto"];
export type ScheduleUpdated = S["ScheduleUpdatedDto"];
export type UpdateScheduleRequest = S["UpdateScheduleRequest"];
export type Holiday = S["HolidayDto"];

export type PaymentProvider = S["PaymentProvider"];
export type PaymentStatus = S["PaymentStatus"];
export type Payment = S["PaymentDto"];
export type OrderSummary = S["OrderSummaryDto"];
export type PaymentIntent = S["PaymentIntentDto"];

export type ICEServer = S["IceServer"];
export type JoinResult = S["JoinConsultationDto"];
export type ConsultationStatus = S["ConsultationStatus"];
export type Consultation = S["ConsultationDto"];
export type WaitingRoomStatus = S["WaitingRoomDto"];
export type ConsultationMessage = S["ConsultationMessageDto"];
export type EarlyJoinOffer = S["EarlyJoinDto"];
export type ReadyForNext = S["ReadyForNextDto"];
export type CallQuality = S["CallQuality"];

export type ClinicalNoteDiagnosis = S["DiagnosisDto"];
export type DiagnosisInput = S["DiagnosisInput"];
export type ClinicalNote = S["ClinicalNoteDto"];
export type ClinicalNoteSummary = S["ClinicalNoteSummaryDto"];
export type ClinicalNoteRevision = S["ClinicalNoteRevisionDto"];

export type PrescriptionItem = S["PrescriptionItemDto"];
export type PrescriptionItemRequest = S["PrescriptionItemRequest"];
export type Prescription = S["PrescriptionDto"];

export type VaultDocumentType = S["VaultDocumentType"];
export type VaultDocument = S["VaultDocumentDto"];
export type VaultFolder = S["VaultFolderDto"];
export type VaultPatient = S["AccessiblePatientDto"];
export type VaultDownload = S["VaultDownloadDto"];

export type DoctorDocumentType = S["DoctorDocumentType"];
export type DoctorDocument = S["DoctorDocumentDto"];
export type DoctorAnalytics = S["DoctorAnalyticsDto"];
export type PeakHour = S["PeakHourDto"];
export type DoctorEarnings = S["DoctorEarningsDto"];
export type Payout = S["DoctorPayoutDto"];
export type ApplicantEligibility = S["EligibilityDto"];
export type DoctorApplicationRequest = S["DoctorApplicationRequest"];
export type DoctorApplicationCreated = S["DoctorApplicationCreatedDto"];

export type Icd10Code = S["Icd10CodeDto"];
export type FormularyDrug = S["DrugDto"];
export type SignedUrl = S["SignedUrlDto"];
