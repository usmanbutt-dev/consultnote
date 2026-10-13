"use client";
import { FolderOpen, Trash2 } from "lucide-react";
import type { z } from "zod";
import type { consultationSummarySchema } from "@/lib/consultation";
type Summary = z.infer<typeof consultationSummarySchema>;
export function ConsultationHistory({
  items,
  activeId,
  busy,
  onOpen,
  onDelete,
  emptyLabel = "No consultations yet",
}: {
  items: Summary[];
  activeId?: string;
  busy: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  emptyLabel?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          Recent consultations
        </h2>
      </div>
      {items.length ? (
        <ul className="mt-4 max-h-[45vh] space-y-2 overflow-y-auto">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white"
            >
              <button
                type="button"
                aria-label={item.title}
                aria-current={item.id === activeId ? "true" : undefined}
                disabled={busy}
                onClick={() => onOpen(item.id)}
                className="min-h-12 min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                <span className="block truncate font-medium">{item.title}</span>
                <span className="mt-1 block text-xs text-slate-600">
                  {new Date(item.updatedAt).toLocaleDateString()}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Delete ${item.title}`}
                disabled={busy}
                onClick={() => onDelete(item.id)}
                className="flex size-10 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 aria-hidden="true" size={15} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center">
          <FolderOpen
            aria-hidden="true"
            size={22}
            className="mx-auto text-slate-400"
          />
          <p className="mt-3 text-sm font-medium text-slate-700">
            {emptyLabel}
          </p>
          <p className="mt-1.5 text-sm leading-6 text-slate-700">
            Save reviewed notes to return to them here.
          </p>
        </div>
      )}
    </div>
  );
}
