export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function weekdayLabel(dayOfWeek: number): string {
  return WEEKDAYS[dayOfWeek] ?? `Day ${dayOfWeek}`;
}

export function hoursLine(hour: {
  is_available: boolean;
  start_time: string;
  end_time: string;
}): string {
  return hour.is_available ? `${hour.start_time} – ${hour.end_time}` : "Unavailable";
}
