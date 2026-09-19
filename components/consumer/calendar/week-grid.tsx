import Link from "next/link";

import { cx } from "@/lib/consumer/cx";
import type { WorkingHour } from "@/lib/consumer/api/types";
import {
  WEEK_DAY_LABELS,
  bandStyle,
  dayKeyLabel,
  dayOfWeek,
  minuteLabel,
  workingBands,
  type GridWindow,
  type PlacedEvent,
} from "@/lib/consumer/features/calendar";
import { statusLabel } from "@/lib/consumer/features/patient-appointment";

/** Below this, a block has room for the title and the time and nothing else. */
const COMPACT_MINUTES = 50;

function EventBlock({
  event,
  window,
  href,
}: {
  event: PlacedEvent;
  window: GridWindow;
  href: string | null;
}) {
  const { top, height } = bandStyle(window, event.startMinute, event.endMinute);
  const width = 100 / event.lanes;
  const compact = event.endMinute - event.startMinute < COMPACT_MINUTES;

  const body = (
    <>
      <p className="truncate text-[0.8125rem] font-semibold leading-tight text-blue-800">
        {event.title}
      </p>
      <p className="mt-0.5 truncate text-[0.6875rem] leading-tight text-blue-700 tabular-time">
        {event.startLabel} – {event.endLabel}
      </p>
      {/* The mock puts the room at the bottom edge of the block. There are no
          rooms in a video consult, so the slot carries the status instead —
          the one thing a doctor scanning the week actually needs from it. */}
      {!compact ? (
        <p className="mt-auto truncate pt-2 text-[0.6875rem] leading-tight text-blue-600">
          {statusLabel(event.status)}
        </p>
      ) : null}
    </>
  );

  const className = cx(
    "absolute flex flex-col overflow-hidden rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5",
    "transition-[background-color,box-shadow,transform] duration-[160ms] ease-out",
    href && "can-hover:hover:z-10 can-hover:hover:bg-blue-100 can-hover:hover:shadow-md active:scale-[0.99]",
  );

  const style = {
    top,
    height,
    left: `calc(${event.lane * width}% + 2px)`,
    width: `calc(${width}% - 4px)`,
  };

  if (!href) {
    return (
      <div className={className} style={style}>
        {body}
      </div>
    );
  }

  return (
    <Link href={href} className={className} style={style}>
      {body}
    </Link>
  );
}

export function WeekGrid({
  dayKeys,
  todayKey,
  eventsByDayKey,
  hrefForEvent,
  window,
  workingHours,
  leaveByDayKey,
}: {
  dayKeys: string[];
  todayKey: string;
  eventsByDayKey: Record<string, PlacedEvent[]>;
  hrefForEvent: (event: PlacedEvent) => string | null;
  window: GridWindow;
  workingHours: WorkingHour[];
  leaveByDayKey: Record<string, string>;
}) {
  const columns = `4.75rem repeat(${dayKeys.length}, minmax(9rem, 1fr))`;
  // One hour is a fixed height rather than a fraction of the viewport: a week
  // with a 14-hour span has to stay readable, and scrolling is the honest
  // answer to that.
  const bodyHeight = `${(window.hours.length - 1) * 6}rem`;

  return (
    <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface p-4 shadow-sm md:p-6">
      <div className="min-w-[56rem]">
        <div className="grid" style={{ gridTemplateColumns: columns }}>
          <div />
          {dayKeys.map((key, index) => {
            const isToday = key === todayKey;
            const onLeave = leaveByDayKey[key];
            return (
              <div key={key} className="px-1 pb-4 text-center">
                <p
                  className={cx(
                    "inline-flex min-h-7 items-center rounded-pill px-3 text-label",
                    isToday ? "bg-brand text-on-brand" : "text-muted",
                  )}
                >
                  {WEEK_DAY_LABELS[index]}
                </p>
                <p className="mt-1 text-caption text-faint">{dayKeyLabel(key)}</p>
                {onLeave ? (
                  <p className="mt-1 truncate text-caption text-warning" title={onLeave}>
                    Leave
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div
          className="relative grid border-t border-border-subtle"
          style={{ gridTemplateColumns: columns, height: bodyHeight }}
        >
          <div className="relative">
            {window.hours.map((minute) => {
              const { top } = bandStyle(window, minute, minute);
              return (
                <span
                  key={minute}
                  className="absolute right-3 -translate-y-1/2 text-caption text-faint tabular-time"
                  style={{ top }}
                >
                  {minuteLabel(minute)}
                </span>
              );
            })}
          </div>

          {dayKeys.map((key) => {
            const events = eventsByDayKey[key] ?? [];
            const bands = workingBands(workingHours, dayOfWeek(key));
            const onLeave = Boolean(leaveByDayKey[key]);
            return (
              <div
                key={key}
                className={cx(
                  "relative border-l border-border-subtle",
                  onLeave && "bg-ink-50",
                  key === todayKey && "bg-brand-tint/25",
                )}
              >
                {/* Working hours, behind everything: the difference between an
                    empty column and an unavailable one. */}
                {!onLeave
                  ? bands.map((band) => (
                      <div
                        key={`${band.startMinute}-${band.endMinute}`}
                        aria-hidden="true"
                        className="absolute inset-x-0 bg-blue-50/60"
                        style={bandStyle(window, band.startMinute, band.endMinute)}
                      />
                    ))
                  : null}

                {window.hours.slice(1, -1).map((minute) => {
                  const { top } = bandStyle(window, minute, minute);
                  return (
                    <div
                      key={minute}
                      aria-hidden="true"
                      className="absolute inset-x-0 border-t border-border-subtle/70"
                      style={{ top }}
                    />
                  );
                })}

                {events.map((event) => (
                  <EventBlock
                    key={event.id}
                    event={event}
                    window={window}
                    href={hrefForEvent(event)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
