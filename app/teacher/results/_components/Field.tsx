"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", full && "md:col-span-2")}>
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      {children}
    </div>
  );
}