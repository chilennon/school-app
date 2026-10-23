"use client";

import { forwardRef } from "react";

interface ReceiptProps {
  school: any;
  family: any;
  payment: any;
  amountInWords: string;
  balance: number;
}

// Helper to format name to Title Case (e.g., "alex hunter" -> "Alex Hunter")
const toTitleCase = (str: string) => {
  if (!str) return "";
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
};

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(
  ({ school, family, payment, amountInWords, balance }, ref) => {
    const amount = Math.abs(payment.amount);
    const naira = Math.floor(amount);
    const kobo = Math.round((amount - naira) * 100);

    const initials = school.name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .substring(0, 3)
      .toUpperCase();

    // Apply Title Case to the payer's name
    const payerName = family.guardian_name 
      ? toTitleCase(family.guardian_name) 
      : toTitleCase(family.name);

    return (
      <div
        ref={ref}
        // Ensure background is explicitly set for PDF capture
        className="bg-[#f8f6f0] w-full max-w-[500px] mx-auto aspect-[1/1.4] shadow-xl relative overflow-hidden flex flex-col border border-[#d4d0c8]"
        style={{ fontFamily: "'Times New Roman', Times, serif" }}
      >
        {/* Watermark Background */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04] flex flex-wrap overflow-hidden leading-tight text-[10px] font-black uppercase text-[#1a237e] break-all z-0">
          {Array(150)
            .fill(`${school.name} ${school.school_type || ""} `)
            .map((text, i) => (
              <span key={i} className="mr-2">
                {text}
              </span>
            ))}
        </div>

        <div className="relative z-10 p-6 flex flex-col h-full">
          {/* HEADER */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 rounded-full border-2 border-[#1a237e] flex items-center justify-center flex-shrink-0 bg-white overflow-hidden">
              {school.logo_url ? (
                <img src={school.logo_url} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[#1a237e] font-black text-xl">{initials}</span>
              )}
            </div>

            <div className="text-center flex-1">
              <h1 className="text-[#1a237e] font-black text-2xl uppercase tracking-wider leading-none">
                {school.name}
              </h1>
              {school.school_type && (
                <div className="bg-[#1a237e] text-white text-[9px] font-bold uppercase tracking-widest py-0.5 px-2 inline-block mt-1">
                  {school.school_type}
                </div>
              )}
              {school.motto && (
                <p className="text-[9px] font-bold text-[#1a237e] mt-1 uppercase tracking-wider">Motto: {school.motto}</p>
              )}
              {school.address && <p className="text-[9px] text-[#1a237e] mt-0.5">{school.address}</p>}
              {school.phone && <p className="text-[9px] font-bold text-[#1a237e]">{school.phone}</p>}
            </div>
          </div>

          {/* RECEIPT METADATA */}
          <div className="flex justify-between items-end mb-4 mt-2">
            <div className="bg-[#1a237e] text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Official Receipt
            </div>
            <div className="flex flex-col items-end text-[#1a237e]">
              <div className="text-xl font-black font-mono tracking-tighter">
                Nº <span className="border-b border-[#1a237e] px-2">{payment.receipt_no}</span>
              </div>
            </div>
            <div className="text-[#1a237e] flex items-end">
              <span className="font-bold text-sm mr-1">Date</span>
              <span className="border-b border-[#1a237e] text-sm font-bold min-w-[80px] text-center">
                {new Date(payment.paid_on).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* BODY FIELDS */}
          <div className="space-y-4 text-[#1a237e] text-sm flex-1">
            <div className="flex items-end">
              <span className="font-bold whitespace-nowrap mr-2">Received From</span>
              <div className="border-b border-[#1a237e] flex-1 font-bold text-base pb-0.5">
                {payerName}
              </div>
            </div>

            <div className="flex items-end">
              <span className="font-bold whitespace-nowrap mr-2">The sum of</span>
              <div className="border-b border-[#1a237e] flex-1 font-bold text-[13px] pb-0.5 uppercase tracking-wide">
                {amountInWords}
              </div>
            </div>

            <div className="flex items-end justify-between">
              <div className="flex items-end flex-1 mr-4">
                <div className="border-b border-[#1a237e] flex-1 text-lg font-black text-center pb-0.5">₦{naira.toLocaleString()}</div>
                <span className="font-bold ml-2">Naira</span>
              </div>
              <div className="flex items-end w-24">
                <div className="border-b border-[#1a237e] flex-1 text-center pb-0.5 font-bold">{kobo.toString().padStart(2, "0")}</div>
                <span className="font-bold ml-2">Kobo</span>
              </div>
            </div>

            <div className="flex items-end">
              <span className="font-bold whitespace-nowrap mr-2">Being Part / Full Payment For</span>
              <div className="border-b border-[#1a237e] flex-1 font-bold text-xs pb-0.5 capitalize">{payment.note || "School Fees"}</div>
            </div>

            <div className="flex justify-between items-end pt-2">
              <div className="flex items-end flex-1 mr-4">
                <span className="font-bold mr-2">Advance</span>
                <div className="border border-[#1a237e] flex-1 p-1 text-sm font-bold text-center">₦0.00</div>
              </div>
              <div className="flex items-end flex-1">
                <span className="font-bold mr-2">Balance</span>
                <div className="border-b border-[#1a237e] flex-1 text-sm font-bold text-center pb-0.5">₦{balance.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="mt-6 flex flex-col items-end">
            <div className="w-48 border-b border-[#1a237e] mb-1"></div>
            <p className="text-[10px] font-bold text-[#1a237e] uppercase tracking-wider">For: {school.name}</p>
          </div>
        </div>
      </div>
    );
  }
);

Receipt.displayName = "Receipt";