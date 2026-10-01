"use client";

import { School } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field } from "./Field";
import { cardCls, cardTitleCls, selectCls } from "../_lib/ui";
import type { CompilerForm } from "../_lib/types";

export function Step1StudentDetails({
  form,
  setField,
  readOnly,
}: {
  form: CompilerForm;
  setField: <K extends keyof CompilerForm>(k: K, v: CompilerForm[K]) => void;
  readOnly: boolean;
}) {
  const ro = readOnly;
  return (
    <div className={cardCls}>
      <div className={cardTitleCls}>
        <School className="h-4 w-4 text-slate-500" />
        <span>School &amp; Student Information</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <Field label="School Name" full>
          <Input className="h-11 text-base" disabled={ro}
            placeholder="e.g. Smart Start Private School"
            value={form.schoolName}
            onChange={(e) => setField("schoolName", e.target.value)} />
        </Field>
        <Field label="School Address" full>
          <Input className="h-11 text-base" disabled={ro}
            placeholder="e.g. 20 Gbenga Olatunji Street, Bucknor Lagos"
            value={form.schoolAddress}
            onChange={(e) => setField("schoolAddress", e.target.value)} />
        </Field>
        <Field label="School Email">
          <Input className="h-11 text-base" disabled={ro}
            placeholder="school@example.com"
            value={form.schoolEmail}
            onChange={(e) => setField("schoolEmail", e.target.value)} />
        </Field>
        <Field label="School Phone">
          <Input className="h-11 text-base" disabled={ro}
            placeholder="e.g. 09012293099"
            value={form.schoolPhone}
            onChange={(e) => setField("schoolPhone", e.target.value)} />
        </Field>
      </div>

      <div className="my-5 h-px bg-slate-100" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <Field label="Student Full Name">
          <Input className="h-11 text-base" disabled={ro}
            placeholder="e.g. Giovanni Onwuneme"
            value={form.studentName}
            onChange={(e) => setField("studentName", e.target.value)} />
        </Field>
        <Field label="Student ID">
          <Input className="h-11 text-base" disabled={ro}
            placeholder="e.g. SSL1799"
            value={form.studentId}
            onChange={(e) => setField("studentId", e.target.value)} />
        </Field>
        <Field label="Sex">
          <select className={selectCls} disabled={ro}
            value={form.sex}
            onChange={(e) => setField("sex", e.target.value)}>
            <option value="">— Select —</option>
            <option>Male</option>
            <option>Female</option>
          </select>
        </Field>
        <Field label="Age">
          <Input className="h-11 text-base" disabled={ro}
            placeholder="e.g. 5"
            value={form.age}
            onChange={(e) => setField("age", e.target.value)} />
        </Field>
        <Field label="Class / Form">
          <Input className="h-11 text-base" disabled={ro}
            placeholder="e.g. Nursery 2, JSS3A"
            value={form.className}
            onChange={(e) => setField("className", e.target.value)} />
        </Field>
        <Field label="Academic Session">
          <Input className="h-11 text-base" disabled={ro}
            placeholder="e.g. 2025/2026"
            value={form.session}
            onChange={(e) => setField("session", e.target.value)} />
        </Field>
        <Field label="Term">
          <select className={selectCls} disabled={ro}
            value={form.term}
            onChange={(e) => setField("term", e.target.value)}>
            <option value="">— Select —</option>
            <option>First Term</option>
            <option>Second Term</option>
            <option>Third Term</option>
          </select>
        </Field>
        <Field label="Class Average Score (%)">
          <Input className="h-11 text-base" type="number" min="0" max="100" step="0.1"
            disabled={ro} placeholder="e.g. 85.7"
            value={form.classAvg}
            onChange={(e) => setField("classAvg", e.target.value)} />
        </Field>
      </div>
    </div>
  );
}