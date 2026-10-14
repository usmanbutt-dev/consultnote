"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CircleAlert } from "lucide-react";

type Confirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export function useConfirmation() {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const pending = useRef<((accepted: boolean) => void) | null>(null);
  const [options, setOptions] = useState<Confirmation | null>(null);

  useEffect(() => {
    if (options && !dialog.current?.open) {
      dialog.current?.showModal();
      cancel.current?.focus();
    }
  }, [options]);

  useEffect(() => () => pending.current?.(false), []);

  function finish(accepted: boolean) {
    const resolve = pending.current;
    pending.current = null;
    dialog.current?.close();
    setOptions(null);
    resolve?.(accepted);
  }

  function confirm(next: Confirmation): Promise<boolean> {
    if (pending.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      pending.current = resolve;
      setOptions(next);
    });
  }

  return {
    confirm,
    confirmation: (
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-message`}
        onCancel={(event) => {
          event.preventDefault();
          finish(false);
        }}
        className="m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/35 backdrop:backdrop-blur-xs"
      >
        {options && (
          <div className="animate-enter p-6">
            <span className="mb-4 flex size-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <CircleAlert aria-hidden="true" size={22} />
            </span>
            <h2 id={`${id}-title`} className="text-xl font-semibold">
              {options.title}
            </h2>
            <p
              id={`${id}-message`}
              className="mt-2 text-sm leading-6 text-slate-600"
            >
              {options.message}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                ref={cancel}
                onClick={() => finish(false)}
                className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-50"
              >
                {options.cancelLabel ?? "Cancel"}
              </button>
              <button
                onClick={() => finish(true)}
                className={`min-h-11 rounded-lg px-4 text-sm font-semibold text-white ${options.destructive ? "bg-red-700 hover:bg-red-800" : "bg-teal-700 hover:bg-teal-800"}`}
              >
                {options.confirmLabel}
              </button>
            </div>
          </div>
        )}
      </dialog>
    ),
  };
}
