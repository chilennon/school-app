"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import type { ClassRoom } from "@/types/school";
import { SectionHeader } from "../SectionHeader";

type PromotionStatus = "ready" | "waiting" | "done";

interface PromotionSectionProps {
  classes: ClassRoom[];
  currentSessionName: string;
  nextSessionName: string;
  onBack: () => void;
  onReviewClass: (classId: string) => void;
}

export function PromotionSection({
  classes,
  currentSessionName,
  nextSessionName,
  onBack,
  onReviewClass,
}: PromotionSectionProps) {
  // 🚨 In a real app, these statuses would be fetched from the DB.
  // For now, we are computing them based on the class data.
  // Later, we will add a DB check for pending approvals and existing next-session enrolments.

  const sortedClasses = [...classes].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));

  // Mocking statuses for the UI demo
  const getStatus = (index: number, className: string): PromotionStatus => {
    if (className.includes("Basic 5") || className.includes("Basic 6")) return "waiting";
    if (className.includes("KG 1") || className.includes("Playgroup")) return "done";
    return "ready";
  };

  const readyClasses = sortedClasses.filter((c, i) => getStatus(i, c.name) === "ready");
  const waitingClasses = sortedClasses.filter((c, i) => getStatus(i, c.name) === "waiting");
  const doneClasses = sortedClasses.filter((c, i) => getStatus(i, c.name) === "done");

  return (
    <div>
      <SectionHeader
        title="Promotion"
        subtitle={`${currentSessionName} to ${nextSessionName}`}
        onBack={onBack}
      />
      <div className="p-4 space-y-6 max-w-2xl mx-auto">
        
        {/* SUMMARY CARD */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h2 className="text-3xl font-black text-slate-900">
            {readyClasses.length + doneClasses.length} of {sortedClasses.length}
          </h2>
          <p className="text-slate-500 text-sm mt-1 mb-4">classes are ready to promote</p>
          <div className="flex gap-4 text-xs font-bold">
            <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {doneClasses.length} done</span>
            <span className="text-blue-600 flex items-center gap-1"><Clock className="w-4 h-4" /> {readyClasses.length} ready</span>
            <span className="text-orange-500 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {waitingClasses.length} waiting</span>
          </div>
        </div>

        {/* READY FOR YOU */}
        {readyClasses.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ready For You</p>
            {readyClasses.map((cls) => (
              <div key={cls.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 text-lg">{cls.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">to Next Class · 15 students</p>
                </div>
                <button
                  onClick={() => onReviewClass(cls.id)}
                  className="px-5 py-2.5 bg-blue-50 text-blue-700 font-bold rounded-xl text-sm active:bg-blue-100"
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        )}

        {/* WAITING FOR THE HEAD */}
        {waitingClasses.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Waiting For The Head</p>
            {waitingClasses.map((cls) => (
              <div key={cls.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between opacity-60">
                <div>
                  <p className="font-bold text-slate-900 text-lg">{cls.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Results pending approval</p>
                </div>
                <span className="px-3 py-1 bg-orange-50 text-orange-600 font-bold rounded-lg text-xs">Waiting</span>
              </div>
            ))}
          </div>
        )}

        {/* DONE */}
        {doneClasses.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Done</p>
            {doneClasses.map((cls) => (
              <div key={cls.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between opacity-60">
                <div>
                  <p className="font-bold text-slate-900 text-lg">{cls.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Students promoted</p>
                </div>
                <span className="px-3 py-1 bg-green-50 text-green-600 font-bold rounded-lg text-xs">Done</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}