"use client";

import React from "react";
import MobileShell from "@/components/mobile/MobileShell";
import ListRow from "@/components/mobile/ListRow";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell } from "lucide-react";

export default function MobileTestPage() {
  return (
    <MobileShell
      title="My Classes"
      subtitle="Good morning"
      activeTab="home"
      onNavigate={(t) => console.log("nav:", t)}
      headerRight={
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-700">
          <Bell size={18} />
        </button>
      }
    >
      {/* Term pills */}
      <div className="-mx-5 px-5 pb-2 flex gap-2 overflow-x-auto">
        {["First Term", "Second Term", "Third Term"].map((t, i) => (
          <button
            key={t}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition ${
              i === 2
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Class card */}
      <Card className="mt-3 rounded-2xl border-0 shadow-sm">
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500">
                Primary 4A
              </p>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                24 students
              </h3>
            </div>
            <Badge className="rounded-full bg-amber-100 text-amber-800 hover:bg-amber-100">
              In progress
            </Badge>
          </div>
          <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full w-2/3 rounded-full bg-emerald-500" />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            18 of 24 scores entered
          </p>
        </div>
      </Card>

      {/* Roster list */}
      <Card className="mt-4 rounded-2xl border-0 shadow-sm">
        <div className="px-4 divide-y divide-slate-100">
          {[
            { name: "Giovanni Onwuneme", reg: "SSL-101", status: "Done" },
            { name: "Amara Okeke", reg: "SSL-102", status: "Draft" },
            { name: "David Adeleke", reg: "SSL-103", status: "New" },
          ].map((s) => (
            <ListRow
              key={s.reg}
              leading={
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-slate-100 text-slate-700 text-sm">
                    {s.name[0]}
                  </AvatarFallback>
                </Avatar>
              }
              title={s.name}
              subtitle={s.reg}
              onClick={() => alert(`Tap ${s.name}`)}
              trailing={
                <Badge
                  className={`rounded-full text-[10px] ${
                    s.status === "Done"
                      ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                      : s.status === "Draft"
                        ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {s.status}
                </Badge>
              }
            />
          ))}
        </div>
      </Card>

      {/* Sticky primary action */}
      <div className="mt-6">
        <Button className="w-full h-12 rounded-2xl text-base font-semibold">
          Submit Results
        </Button>
      </div>
    </MobileShell>
  );
}