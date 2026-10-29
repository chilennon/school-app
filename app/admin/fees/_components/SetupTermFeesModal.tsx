"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import type { ClassRoom } from "@/types/school";

interface SetupTermFeesModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClassRoom[];
  onSubmit: (classFees: { class_id: string; amount: number }[]) => Promise<void>;
  isSubmitting: boolean;
}

export function SetupTermFeesModal({
  isOpen,
  onClose,
  classes,
  onSubmit,
  isSubmitting,
}: SetupTermFeesModalProps) {
  const [fees, setFees] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleFeeChange = (classId: string, value: string) => {
    setFees((prev) => ({ ...prev, [classId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = Object.entries(fees)
      .filter(([_, amount]) => amount.trim() !== "")
      .map(([classId, amount]) => ({
        class_id: classId,
        amount: Number(amount),
      }));

    if (payload.length === 0) {
      return; // Or show a toast error
    }
    await onSubmit(payload);
  };

  // Sort classes by the ladder order before rendering
  const sortedClasses = [...classes].sort((a: any, b: any) => {
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center p-5 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">Setup Term Fees</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <p className="text-sm text-slate-500 mb-2">
            Enter the tuition amount for each class. Leave blank if a class has no fee this term.
          </p>
          
          {sortedClasses.map((cls) => (
            <div key={cls.id} className="flex items-center gap-3">
              <label className="flex-1 text-sm font-bold text-slate-700">
                {cls.name}
              </label>
              <div className="relative w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  ₦
                </span>
                <input
                  type="number"
                  placeholder="0"
                  value={fees[cls.id] || ""}
                  onChange={(e) => handleFeeChange(cls.id, e.target.value)}
                  className="w-full pl-7 pr-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="p-5 border-t border-slate-100">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</> : "Generate Charges"}
          </button>
        </div>
      </div>
    </div>
  );
}