"use client";

import { useLayoutEffect, useRef, type ComponentPropsWithoutRef } from "react";

function fit(element: HTMLTextAreaElement) {
  element.style.height = "0px";
  element.style.height = `${element.scrollHeight}px`;
}

export function DocumentTextarea({
  onInput,
  onBlur,
  className,
  ...props
}: ComponentPropsWithoutRef<"textarea">) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    fit(element);
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth !== width) {
        width = element.clientWidth;
        fit(element);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [props.defaultValue]);

  return (
    <textarea
      {...props}
      ref={ref}
      rows={1}
      className={`block min-h-6 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-xs leading-6 text-slate-700 disabled:opacity-60 ${className ?? ""}`}
      onInput={(event) => {
        fit(event.currentTarget);
        onInput?.(event);
      }}
      onBlur={(event) => {
        onBlur?.(event);
        fit(event.currentTarget);
      }}
    />
  );
}
