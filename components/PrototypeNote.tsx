"use client";

import { resetFakeData } from "@/lib/data/fakeData";

export function PrototypeNote() {
  if (process.env.NEXT_PUBLIC_DATA_MODE === "live") return null;
  return (
    <footer className="mt-10 border-t border-line pt-4 text-center text-[13px] text-muted">
      Prototype with sample data. Nothing here is a real event yet.{" "}
      <button
        className="underline"
        onClick={() => {
          resetFakeData(window.localStorage);
          window.location.reload();
        }}
      >
        Reset sample data
      </button>
      {" · "}
      <a className="underline" href="/preview/email">
        Preview Monday email
      </a>
    </footer>
  );
}
