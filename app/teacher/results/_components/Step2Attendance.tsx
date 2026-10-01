"use client";

import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field } from "./Field";
import { cardCls, cardTitleCls } from "../_lib/ui";
import type { CompilerForm } from "../_lib/types";

export function Step2Attendance({
  form, setField, readOnly,
}: {
  form: CompilerForm;
  setField: <K extends keyof CompilerForm>(k: K, v: CompilerForm[K]) => void;
  readOnly: boolean;
}) {
  return (
    <div className={cardCls}>
      <div className={cardTitleCls}>
        <Calendar className="h-4 w-4 text-slate-500" />
        <span>Attendance</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Opened">
          <Input className="h-11 text-base" type="number" min="0" disabled={readOnly}
            placeholder="112" value={form.daysOpened}
            onChange={(e) => setField("daysOpened", e.target.value)} />
        </Field>
        <Field label="Present">
          <Input className="h-11 text-base" type="number" min="0" disabled={readOnly}
            placeholder="110" value={form.daysPresent}
            onChange={(e) => setField("daysPresent", e.target.value)} />
        </Field>
        <Field label="Absent">
          <Input className="h-11 text-base" type="number" readOnly
            placeholder="auto" value={form.daysAbsent} />
        </Field>
      </div>
    </div>
  );
}