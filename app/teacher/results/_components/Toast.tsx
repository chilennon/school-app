"use client";

import type { ToastState } from "../_lib/types";

export function Toast({ toast }: { toast: ToastState }) {
  return (
    <div className={`toast ${toast.type} ${toast.show ? "show" : ""}`}>
      {toast.message}
    </div>
  );
}