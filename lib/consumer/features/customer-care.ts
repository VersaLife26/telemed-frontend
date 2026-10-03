import type {
  CustomerCareMessage,
  CustomerCareSummary,
  CustomerCareThread,
  Paged,
} from "@/lib/consumer/api/types";

export const CUSTOMER_CARE_CATEGORIES = [
  "refund",
  "appointment",
  "consultation",
  "prescription",
  "account",
  "technical",
] as const;

export type CustomerCareCategory = (typeof CUSTOMER_CARE_CATEGORIES)[number];
export type CustomerCareStatus = CustomerCareSummary["status"];
export type CustomerCareList = Paged<CustomerCareSummary>;
export type { CustomerCareMessage, CustomerCareSummary, CustomerCareThread };

export const CUSTOMER_CARE_CATEGORY_LABEL: Record<CustomerCareCategory, string> = {
  refund: "Refund / payment",
  appointment: "Appointment / scheduling",
  consultation: "Consultation / video call",
  prescription: "Prescription / medical report",
  account: "Account / login",
  technical: "Technical issue",
};

export function customerCareListPath(): string {
  return "/customer-care?pageSize=50";
}

export function customerCarePath(id?: string): string {
  return id ? `/customer-care/${id}` : "/customer-care";
}

export function customerCareMessagesPath(id: string): string {
  return `/customer-care/${id}/messages`;
}

export function customerCareStatusLabel(status: CustomerCareStatus): string {
  switch (status) {
    case "investigating":
      return "In progress";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    default:
      return "Open";
  }
}

export function canReplyToCustomerCare(status: CustomerCareStatus): boolean {
  return status !== "closed";
}
