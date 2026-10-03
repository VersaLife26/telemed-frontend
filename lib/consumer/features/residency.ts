/** Fields the API stores only when a new account is created from a Sri Lankan IP. */
export type ResidencyAnswer = {
  isSriLankanCitizen?: boolean;
  nationalId?: string;
};

export function residencyError(
  ask: boolean,
  citizen: boolean | null,
  nationalId: string,
): string | null {
  if (!ask) return null;
  if (citizen === null) return "Say whether you are a Sri Lankan citizen.";
  if (citizen && !nationalId.trim()) return "Enter your National ID.";
  return null;
}

/** Omits the National ID unless the visitor said they are a citizen. */
export function residencyFields(citizen: boolean | null, nationalId: string): ResidencyAnswer {
  if (citizen === null) return {};
  const fields: ResidencyAnswer = { isSriLankanCitizen: citizen };
  const nic = nationalId.trim();
  if (citizen && nic) fields.nationalId = nic;
  return fields;
}
