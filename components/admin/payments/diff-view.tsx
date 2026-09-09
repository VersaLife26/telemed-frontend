"use client";

import * as React from "react";

import { type DiffLine, collapseUnchanged, diffLines, summariseDiff } from "@/lib/admin/diff";
import { cn } from "@/lib/admin/utils";

/**
 * Side-by-side-in-one-column diff.
 *
 * Unified rather than split, because these documents are narrow and deeply
 * nested: a split view halves the width available to a line like
 * `"max_commission_cents": 250000` and wraps it, which is exactly the line a
 * reviewer most needs to read without wrapping.
 *
 * The `+`/`-` gutter carries the meaning, and background colour reinforces it.
 * Removing the colour entirely still leaves a readable diff — which is the test
 * for whether colour is decoration or information.
 */
export function DiffView({
  before,
  after,
  beforeLabel = "Current",
  afterLabel = "Proposed",
}: {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const lines = React.useMemo(() => diffLines(before, after), [before, after]);
  const summary = React.useMemo(() => summariseDiff(lines), [lines]);
  const rendered = React.useMemo(() => collapseUnchanged(lines, 3), [lines]);

  if (!summary.changed) {
    return (
      <p className="rounded-md border border-border bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
        No changes. The proposed document is identical to the current one.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/50 px-3 py-2 text-xs">
        <span className="text-muted-foreground">
          {beforeLabel} → {afterLabel}
        </span>
        <span className="tabular-nums">
          <span className="text-success">+{summary.added}</span>{" "}
          <span className="text-destructive">−{summary.removed}</span>
        </span>
      </div>

      <table className="w-full border-collapse font-mono text-xs">
        <caption className="sr-only">
          Line-by-line differences between the current and proposed documents:{" "}
          {summary.added} lines added, {summary.removed} removed.
        </caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Change</th>
            <th scope="col">{beforeLabel} line</th>
            <th scope="col">{afterLabel} line</th>
            <th scope="col">Content</th>
          </tr>
        </thead>
        <tbody>
          {rendered.map((entry, index) =>
            entry.kind === "gap" ? (
              <tr key={`gap-${index}`} className="bg-muted/30">
                <td colSpan={4} className="px-3 py-1 text-center text-muted-foreground">
                  … {entry.hidden} unchanged line{entry.hidden === 1 ? "" : "s"} …
                </td>
              </tr>
            ) : (
              <DiffRow key={`line-${index}`} line={entry} />
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  const marker = line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " ";
  const description =
    line.kind === "added" ? "Added" : line.kind === "removed" ? "Removed" : "Unchanged";

  return (
    <tr
      className={cn(
        line.kind === "added" && "bg-success/10",
        line.kind === "removed" && "bg-destructive/10",
      )}
    >
      <td className="w-6 select-none px-1 text-center text-muted-foreground">
        <span className="sr-only">{description}: </span>
        <span aria-hidden="true">{marker}</span>
      </td>
      <td className="w-10 select-none px-1 text-right text-muted-foreground">
        {line.beforeLine ?? ""}
      </td>
      <td className="w-10 select-none px-1 text-right text-muted-foreground">
        {line.afterLine ?? ""}
      </td>
      <td className="whitespace-pre-wrap break-all px-2 py-0.5">{line.text || " "}</td>
    </tr>
  );
}
