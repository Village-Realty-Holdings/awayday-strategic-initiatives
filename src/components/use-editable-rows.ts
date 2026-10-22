"use client";

import { useState } from "react";
import { toast } from "sonner";

// Row state for the inline-edit grids (scorecard, Q2 board): edit a field,
// add a row (and remember it so its first field can autofocus), remove a row
// with an Undo toast, and a `dirty` flag against the initial rows.
export function useEditableRows<T extends object>(initial: T[], noun = "Row") {
  const [rows, setRows] = useState<T[]>(initial);
  const [addedIndex, setAddedIndex] = useState<number | null>(null);

  const update = <K extends keyof T>(i: number, key: K, value: T[K]) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));

  const add = (row: T) => {
    setAddedIndex(rows.length);
    setRows((rs) => [...rs, row]);
  };

  const remove = (i: number) => {
    const removed = rows[i];
    setAddedIndex(null);
    setRows((rs) => rs.filter((_, idx) => idx !== i));
    toast(`${noun} removed`, {
      action: {
        label: "Undo",
        onClick: () => setRows((rs) => [...rs.slice(0, i), removed, ...rs.slice(i)]),
      },
    });
  };

  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);

  return { rows, update, add, remove, addedIndex, dirty };
}
