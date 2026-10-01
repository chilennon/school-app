"use client";

import { PenLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "./Field";
import { cardCls, cardTitleCls, selectCls } from "../_lib/ui";
import type { CompilerForm } from "../_lib/types";

export function Step5Remarks({
  form, setField, readOnly,
}: {
  form: CompilerForm;
  setField: <K extends keyof CompilerForm>(k: K, v: CompilerForm[K]) => void;
  readOnly: boolean;
}) {
  return (
    <div className={cardCls}>
      <div className={cardTitleCls}>
        <PenLine className="h-4 w-4 text-slate-500" />
        <span>Class Teacher&apos;s Remark</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <Field label="Class Teacher's Name">
          <Input className="h-11 text-base" disabled={readOnly}
            placeholder="e.g. Mrs. Adaeze Nwosu"
            value={form.teacherName}
            onChange={(e) => setField("teacherName", e.target.value)} />
        </Field>
        <Field label="Head Teacher's Name">
          <Input className="h-11 text-base" disabled={readOnly}
            placeholder="e.g. Mr. Emeka Obi"
            value={form.headTeacherName}
            onChange={(e) => setField("headTeacherName", e.target.value)} />
        </Field>
        <Field label="Class Teacher's Remark" full>
          <Textarea className="text-base min-h-[96px]" disabled={readOnly}
            placeholder="e.g. Giovanni has done well this term. Keep it up..."
            value={form.teacherRemark}
            onChange={(e) => setField("teacherRemark", e.target.value)} />
        </Field>
        <Field label="Head Teacher's Comment" full>
          <Textarea className="text-base min-h-[96px]" disabled={readOnly}
            placeholder="e.g. An excellent performance. Keep it up."
            value={form.headRemark}
            onChange={(e) => setField("headRemark", e.target.value)} />
        </Field>
        <Field label="Next Term Begins">
          <Input className="h-11 text-base" disabled={readOnly}
            placeholder="e.g. 4th May 2026"
            value={form.nextTerm}
            onChange={(e) => setField("nextTerm", e.target.value)} />
        </Field>
        <Field label="Promotion Status (optional)">
          <select className={selectCls} disabled={readOnly}
            value={form.promotion}
            onChange={(e) => setField("promotion", e.target.value)}>
            <option value="">— Select —</option>
            <option>Promoted to Next Class</option>
            <option>Repeated – Academic Performance</option>
            <option>Repeated – Attendance</option>
            <option>Graduated</option>
            <option>Pending Review</option>
          </select>
        </Field>
      </div>
    </div>
  );
}