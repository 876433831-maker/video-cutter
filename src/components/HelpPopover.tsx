"use client";

import { useEffect, useRef, useState } from "react";

type HelpPopoverProps = {
  title?: string;
  items: string[];
};

export default function HelpPopover({
  title = "使用说明",
  items
}: HelpPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const container = containerRef.current;

      if (!container) {
        return;
      }

      if (!container.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
        aria-label={title}
      >
        ?
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-[320px] rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
          <p className="font-semibold text-slate-900">{title}</p>
          <ul className="mt-3 space-y-2">
            {items.map((item) => (
              <li key={item} className="leading-6">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
