"use client";

import { useState, useEffect } from "react";
import { MappingConfig, FeeModel } from "../_lib/types";
import { autoMapHeaders } from "../_lib/parser";
import { ArrowRight, User, Users } from "lucide-react";

type Props = {
  headers: string[];
  initialMapping: MappingConfig;
  onConfirm: (mapping: MappingConfig, feeModel: FeeModel) => void;
  onCancel: () => void;
};

const FIELD_LABELS: Record<keyof MappingConfig, string> = {
  familyName: "Family Name",
  guardianName: "Guardian Name",
  guardianPhone: "Guardian Phone",
  children: "Children / Pupils",
  totalDue: "Total Due (₦)",
  totalPaid: "Total Paid (₦)",
};

export function MappingStep({ headers, initialMapping, onConfirm, onCancel }: Props) {
  const [mapping, setMapping] = useState<MappingConfig>(initialMapping);
  const [feeModel, setFeeModel] = useState<FeeModel>("family");

  // If they switch to per-student, we clear the familyName mapping to avoid confusion
  useEffect(() => {
    if (feeModel === "per-student") {
      setMapping((prev) => ({ ...prev, familyName: null }));
    }
  }, [feeModel]);

  const handleMapChange = (field: keyof MappingConfig, value: string) => {
    setMapping((prev) => ({
      ...prev,
      [field]: value === "" ? null : value,
    }));
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Map Columns</h2>
        <p className="text-sm text-slate-500 mt-1">
          We've auto-detected your columns. Please confirm they are correct.
        </p>
      </div>

      {/* FEE MODEL TOGGLE */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <label className="text-sm font-bold text-slate-900 block mb-3">
          How does this school charge fees?
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setFeeModel("family")}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
              feeModel === "family"
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <Users className="w-5 h-5 mb-1" />
            <span className="font-bold text-sm">Family-Based</span>
            <span className="text-[10px] text-center mt-1 opacity-80">
              Siblings share one ledger
            </span>
          </button>
          
          <button
            onClick={() => setFeeModel("per-student")}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
              feeModel === "per-student"
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <User className="w-5 h-5 mb-1" />
            <span className="font-bold text-sm">Per-Student</span>
            <span className="text-[10px] text-center mt-1 opacity-80">
              Each child billed separately
            </span>
          </button>
        </div>
      </div>

      {/* COLUMN DROPDOWNS */}
      <div className="space-y-4">
        {(Object.keys(FIELD_LABELS) as Array<keyof MappingConfig>).map((field) => {
          // Hide Family Name if Per-Student is selected
          if (field === "familyName" && feeModel === "per-student") return null;

          // Rename "Children" to "Student Name" if Per-Student
          const label =
            field === "children" && feeModel === "per-student"
              ? "Student Name (Required)"
              : FIELD_LABELS[field];

          const isRequired = ["children", "totalDue", "totalPaid"].includes(field) || 
                            (field === "familyName" && feeModel === "family");

          return (
            <div key={field} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <label className="sm:w-1/3 text-sm font-medium text-slate-700">
                {label} {isRequired && <span className="text-red-500">*</span>}
              </label>
              <select
                value={mapping[field] || ""}
                onChange={(e) => handleMapChange(field, e.target.value)}
                className="sm:w-2/3 w-full p-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">— Ignore this field —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {/* ACTIONS */}
      <div className="flex gap-3 pt-4 border-t border-slate-100">
        <button
          onClick={onCancel}
          className="px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(mapping, feeModel)}
          className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          Continue to Preview <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}