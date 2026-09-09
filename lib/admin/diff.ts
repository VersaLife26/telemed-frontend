/**
 * Line diff.
 *
 * Used by the commission rule editor. An admin editing the money rules by hand
 * must see exactly what changes before it is saved — "GP went from 20% to 2%"
 * is a typo somebody will make, and the only reliable way to catch it is to
 * show the two lines next to each other rather than trusting a re-read of a
 * forty-line JSON blob.
 *
 * A Myers diff would be shorter in the pathological cases; this is a
 * straightforward LCS, which is exact, obvious to read, and irrelevant in cost
 * for a config document that is never more than a few hundred lines.
 */

export type DiffKind = "unchanged" | "added" | "removed";

export interface DiffLine {
  kind: DiffKind;
  /** 1-based line number in the previous document, if the line exists there. */
  beforeLine: number | null;
  /** 1-based line number in the next document, if the line exists there. */
  afterLine: number | null;
  text: string;
}

export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");

  // lcs[i][j] = length of the longest common subsequence of a[i:] and b[j:].
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const row = lcs[i];
      const nextRow = lcs[i + 1];
      if (!row || !nextRow) continue;
      row[j] = a[i] === b[j] ? (nextRow[j + 1] ?? 0) + 1 : Math.max(nextRow[j] ?? 0, row[j + 1] ?? 0);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: "unchanged", beforeLine: i + 1, afterLine: j + 1, text: a[i] ?? "" });
      i++;
      j++;
    } else if ((lcs[i + 1]?.[j] ?? 0) >= (lcs[i]?.[j + 1] ?? 0)) {
      out.push({ kind: "removed", beforeLine: i + 1, afterLine: null, text: a[i] ?? "" });
      i++;
    } else {
      out.push({ kind: "added", beforeLine: null, afterLine: j + 1, text: b[j] ?? "" });
      j++;
    }
  }
  while (i < a.length) {
    out.push({ kind: "removed", beforeLine: i + 1, afterLine: null, text: a[i] ?? "" });
    i++;
  }
  while (j < b.length) {
    out.push({ kind: "added", beforeLine: null, afterLine: j + 1, text: b[j] ?? "" });
    j++;
  }
  return out;
}

export interface DiffSummary {
  added: number;
  removed: number;
  changed: boolean;
}

export function summariseDiff(lines: readonly DiffLine[]): DiffSummary {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.kind === "added") added++;
    if (line.kind === "removed") removed++;
  }
  return { added, removed, changed: added > 0 || removed > 0 };
}

/**
 * Collapses long runs of unchanged lines, keeping `context` lines either side
 * of each change. A forty-line document with one edit should not require
 * scrolling past thirty-nine identical lines to find it.
 */
export function collapseUnchanged(
  lines: readonly DiffLine[],
  context = 3,
): Array<DiffLine | { kind: "gap"; hidden: number }> {
  const keep = new Set<number>();
  lines.forEach((line, index) => {
    if (line.kind === "unchanged") return;
    for (let offset = -context; offset <= context; offset++) {
      const target = index + offset;
      if (target >= 0 && target < lines.length) keep.add(target);
    }
  });

  const out: Array<DiffLine | { kind: "gap"; hidden: number }> = [];
  let hidden = 0;
  lines.forEach((line, index) => {
    if (keep.has(index)) {
      if (hidden > 0) {
        out.push({ kind: "gap", hidden });
        hidden = 0;
      }
      out.push(line);
    } else {
      hidden++;
    }
  });
  if (hidden > 0) out.push({ kind: "gap", hidden });
  return out;
}
