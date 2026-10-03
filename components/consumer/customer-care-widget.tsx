"use client";

import { ArrowLeft, Headset, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Alert } from "@/components/consumer/ui/Alert";
import { Button } from "@/components/consumer/ui/Button";
import { Select } from "@/components/consumer/ui/Select";
import { Textarea } from "@/components/consumer/ui/Textarea";
import { browserApi } from "@/lib/consumer/api/client";
import { ApiError } from "@/lib/consumer/api/errors";
import type { Appointment, Paged } from "@/lib/consumer/api/types";
import { cx } from "@/lib/consumer/cx";
import { appointmentsListPath } from "@/lib/consumer/features/appointments";
import {
  CUSTOMER_CARE_CATEGORIES,
  CUSTOMER_CARE_CATEGORY_LABEL,
  canReplyToCustomerCare,
  customerCareListPath,
  customerCareMessagesPath,
  customerCarePath,
  customerCareStatusLabel,
  type CustomerCareCategory,
  type CustomerCareList,
  type CustomerCareMessage,
  type CustomerCareSummary,
  type CustomerCareThread,
} from "@/lib/consumer/features/customer-care";
import { formatVisitClock, formatVisitDate, statusLabel } from "@/lib/consumer/features/patient-appointment";

type Screen = "list" | "compose" | "thread";

export function CustomerCareWidget() {
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>("list");
  const [threads, setThreads] = useState<CustomerCareSummary[]>([]);
  const [thread, setThread] = useState<CustomerCareThread | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<CustomerCareCategory>("refund");
  const [appointmentId, setAppointmentId] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const messagesEnd = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    const data = await browserApi<CustomerCareList>(customerCareListPath());
    setThreads(data.items);
  }, []);

  const loadThread = useCallback(async (id: string) => {
    const next = await browserApi<CustomerCareThread>(customerCarePath(id));
    setThread(next);
    setScreen("thread");
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        await loadList();
        if (!cancelled) {
          const visits = await browserApi<Paged<Appointment>>(appointmentsListPath(20));
          if (!cancelled) setAppointments(visits.items);
        }
      } catch (cause) {
        if (!cancelled) setError(fail(cause, "Could not load customer care."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, loadList]);

  useEffect(() => {
    if (!open || screen !== "thread" || !thread?.id) return;
    const id = thread.id;
    const timer = window.setInterval(() => {
      void loadThread(id).catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [open, screen, thread?.id, loadThread]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ block: "end" });
  }, [thread?.messages.length]);

  async function openConversation(id: string) {
    setBusy(true);
    setError(null);
    try {
      await loadThread(id);
    } catch (cause) {
      setError(fail(cause, "Could not open this conversation."));
    } finally {
      setBusy(false);
    }
  }

  async function startConversation() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const opened = await browserApi<CustomerCareThread>(customerCarePath(), {
        method: "POST",
        body: {
          category,
          body: text,
          appointmentId: appointmentId || null,
        },
      });
      setBody("");
      setAppointmentId("");
      setThread(opened);
      setScreen("thread");
      await loadList();
    } catch (cause) {
      setError(fail(cause, "Could not send your message."));
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!thread || !canReplyToCustomerCare(thread.status)) return;
    const text = reply.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const message = await browserApi<CustomerCareMessage>(customerCareMessagesPath(thread.id), {
        method: "POST",
        body: { body: text },
      });
      setReply("");
      setThread({ ...thread, messages: [...thread.messages, message], updatedAt: message.createdAt });
      await loadList();
    } catch (cause) {
      setError(fail(cause, "Could not send your reply."));
    } finally {
      setBusy(false);
    }
  }

  function closePanel() {
    setOpen(false);
    setScreen("list");
    setThread(null);
    setError(null);
  }

  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-50 flex flex-col items-end gap-3 md:bottom-6">
      {open ? (
        <section
          className="pointer-events-auto flex h-[min(32rem,calc(100dvh-8rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-border-default bg-surface shadow-brand"
          aria-label="Customer care"
        >
          <header className="flex items-center gap-2 border-b border-border-default px-4 py-3">
            {screen !== "list" ? (
              <button
                type="button"
                className="grid size-9 place-items-center rounded-full text-muted can-hover:hover:bg-tint"
                aria-label="Back to conversations"
                onClick={() => {
                  setScreen("list");
                  setThread(null);
                  setError(null);
                }}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold">Customer care</p>
              <p className="truncate text-xs text-muted">
                {screen === "thread" && thread
                  ? thread.subject
                  : screen === "compose"
                    ? "New message"
                    : "We reply in this chat"}
              </p>
            </div>
            <button
              type="button"
              className="grid size-9 place-items-center rounded-full text-muted can-hover:hover:bg-tint"
              aria-label="Close customer care"
              onClick={closePanel}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {error ? (
              <Alert className="mb-3" tone="danger">
                {error}
              </Alert>
            ) : null}

            {screen === "list" ? (
              <div className="space-y-3">
                <Button size="sm" fullWidth onClick={() => setScreen("compose")}>
                  New message
                </Button>
                {threads.length === 0 ? (
                  <p className="pt-6 text-center text-sm text-muted">
                    Tell us about a refund, appointment, or anything else. Choose a topic so we can route it quickly.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {threads.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void openConversation(item.id)}
                          className="w-full rounded-2xl border border-border-default p-3 text-left can-hover:hover:border-border-strong"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-sm font-medium">{item.subject}</p>
                            <span className="shrink-0 text-[11px] text-faint">
                              {customerCareStatusLabel(item.status)}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted">{item.lastMessage}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {screen === "compose" ? (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void startConversation();
                }}
              >
                <Select
                  id="care-category"
                  label="What is this about"
                  required
                  value={category}
                  onChange={(event) => setCategory(event.target.value as CustomerCareCategory)}
                >
                  {CUSTOMER_CARE_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {CUSTOMER_CARE_CATEGORY_LABEL[value]}
                    </option>
                  ))}
                </Select>
                <Select
                  id="care-appointment"
                  label="Related visit (optional)"
                  value={appointmentId}
                  onChange={(event) => setAppointmentId(event.target.value)}
                >
                  <option value="">Not tied to a visit</option>
                  {appointments.map((visit) => (
                    <option key={visit.id} value={visit.id}>
                      {formatVisitDate(visit.startAt)} {formatVisitClock(visit.startAt)} · {statusLabel(visit.status)}
                    </option>
                  ))}
                </Select>
                <Textarea
                  id="care-body"
                  label="Message"
                  required
                  rows={5}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="What happened, and what would you like us to do?"
                />
                <Button type="submit" fullWidth busy={busy} disabled={body.trim().length === 0}>
                  Send
                </Button>
              </form>
            ) : null}

            {screen === "thread" && thread ? (
              <ol className="space-y-3">
                {thread.messages.map((message) => (
                  <li
                    key={message.id}
                    className={cx("max-w-[90%] rounded-2xl px-3 py-2 text-sm", message.fromSupport ? "bg-brand-tint text-ink" : "ml-auto bg-tint")}
                  >
                    <p className="text-[11px] font-medium text-muted">
                      {message.fromSupport ? "Customer care" : "You"}
                    </p>
                    <p className="whitespace-pre-wrap">{message.body}</p>
                  </li>
                ))}
                <div ref={messagesEnd} />
              </ol>
            ) : null}
          </div>

          {screen === "thread" && thread ? (
            <form
              className="flex gap-2 border-t border-border-default p-3"
              onSubmit={(event) => {
                event.preventDefault();
                void sendReply();
              }}
            >
              {canReplyToCustomerCare(thread.status) ? (
                <>
                  <Textarea
                    aria-label="Reply"
                    rows={2}
                    className="min-h-0"
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="Write a reply"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="self-end"
                    busy={busy}
                    disabled={reply.trim().length === 0}
                    leading={<Send className="size-4" aria-hidden="true" />}
                  >
                    Send
                  </Button>
                </>
              ) : (
                <p className="w-full py-2 text-center text-sm text-muted">This conversation is closed.</p>
              )}
            </form>
          ) : null}
        </section>
      ) : null}

      <button
        type="button"
        className="pointer-events-auto grid size-14 place-items-center rounded-full bg-[image:var(--gradient-cta)] text-on-brand shadow-brand can-hover:hover:brightness-[1.06] active:scale-[0.96]"
        aria-label={open ? "Hide customer care" : "Open customer care"}
        aria-expanded={open}
        onClick={() => (open ? closePanel() : setOpen(true))}
      >
        {open ? <X className="size-6" aria-hidden="true" /> : <Headset className="size-6" aria-hidden="true" />}
      </button>
    </div>
  );
}

function fail(cause: unknown, fallback: string): string {
  return cause instanceof ApiError ? cause.message : fallback;
}
