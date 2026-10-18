"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useParams } from "next/navigation";
import { recordPayment } from "../../../actions";
import { ChevronLeft, CheckCircle2 } from "lucide-react";
import { calculateFamilyBalances } from "@/lib/fees";

export default function RecordPayment() {
  const router = useRouter();
  const params = useParams();

  const [family, setFamily] = useState<any>(null);
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<"cash" | "transfer" | "pos">("transfer");
  const [reference, setReference] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState<{ receiptNo: string; amount: number } | null>(null);

  useEffect(() => {
    if (!params.id) return;
    
    supabase.from("families")
      .select("name, charges(amount, created_at), payments(amount, created_at)")
      .eq("id", params.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const calc = calculateFamilyBalances(data.charges as any, data.payments as any);
          setFamily({ name: data.name, balance: calc.currentBalance });
        }
      });
  }, [params.id]);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return;
    setIsSaving(true);
    try {
      const res = await recordPayment({
        familyId: params.id as string,
        amount: Number(amount),
        method,
        reference,
      });
      if (res.success) {
        setSuccess({ receiptNo: res.receiptNo, amount: Number(amount) });
      }
    } catch (err: any) {
      alert(err.message || "Failed to save payment");
    } finally {
      setIsSaving(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="print:hidden flex flex-col items-center w-full">
          <CheckCircle2 className="w-20 h-20 text-green-500 mb-4" />
          <h1 className="text-2xl font-black text-slate-900 mb-2">Payment Saved!</h1>
          <p className="text-slate-500 font-medium mb-8">Receipt {success.receiptNo} generated.</p>
        </div>

        {/* Receipt Container */}
        <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-sm border border-slate-100 mb-6 print:border-none print:shadow-none print:max-w-full">
          <p className="text-sm font-bold text-slate-500 mb-1">Amount Paid</p>
          <p className="text-3xl font-black text-slate-900 mb-4">₦{success.amount.toLocaleString()}</p>
          <p className="text-sm text-slate-500 font-medium mb-4">For {family?.name}</p>
          
          <div className="border-t border-dashed border-slate-200 pt-4 text-left space-y-1">
            <p className="text-xs text-slate-500">Receipt No: <span className="font-bold text-slate-800">{success.receiptNo}</span></p>
            <p className="text-xs text-slate-500">Date: <span className="font-bold text-slate-800">{new Date().toLocaleDateString()}</span></p>
            <p className="text-xs text-slate-500">Method: <span className="font-bold text-slate-800 capitalize">{method}</span></p>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-3 print:hidden">
          <button onClick={() => window.print()} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-md">
            Print / Download Receipt
          </button>
          <button onClick={() => router.push(`/admin/fees/family/${params.id}`)} className="w-full bg-slate-200 text-slate-800 font-bold py-4 rounded-2xl">
            Back to Family
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-24">
      <div className="p-4 bg-white border-b border-slate-100">
        <button onClick={() => router.back()} className="text-blue-600 font-bold mb-4 flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Cancel
        </button>
        <h1 className="text-2xl font-black text-slate-900 mb-1">Record payment</h1>
        <p className="text-slate-500 text-sm font-medium">{family?.name} · owes ₦{family?.balance?.toLocaleString()}</p>
      </div>

      <div className="p-4 flex-1 space-y-5">
        {/* Amount Input */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-4 text-2xl font-black text-slate-400">₦</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full text-4xl font-black pl-12 pr-4 py-4 rounded-2xl border-2 border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
            />
          </div>
        </div>

        {/* Quick Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setAmount(family?.balance?.toString() || "")}
            className="whitespace-nowrap bg-white border border-slate-200 text-sm font-bold px-4 py-2 rounded-full text-slate-700 shadow-sm"
          >
            Full balance ₦{family?.balance?.toLocaleString()}
          </button>
          <button
            onClick={() => setAmount((family?.balance / 2).toString())}
            className="whitespace-nowrap bg-white border border-slate-200 text-sm font-bold px-4 py-2 rounded-full text-slate-700 shadow-sm"
          >
            Half ₦{(family?.balance / 2)?.toLocaleString()}
          </button>
        </div>

        {/* Method */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Paid by</label>
          <div className="flex gap-2">
            {["cash", "transfer", "pos"].map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m as any)}
                className={`flex-1 py-3 rounded-xl border text-sm font-bold capitalize transition-colors ${
                  method === m 
                    ? "border-blue-600 text-blue-700 bg-blue-50" 
                    : "border-slate-200 text-slate-600 bg-white"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Reference */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Reference or note (optional)</label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. transfer ref, or a remark"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-blue-500 shadow-sm"
          />
        </div>

        {/* Date */}
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm flex justify-between shadow-sm">
          <span className="text-slate-500 font-medium">Date</span>
          <span className="font-bold text-slate-900">Today, {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        </div>

        {/* Preview Box */}
        {amount && Number(amount) > 0 && (
          <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
            <p className="text-xs font-black text-blue-800 uppercase tracking-wider mb-2">After this payment</p>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-2xl font-black text-orange-600">Owes ₦{Math.max(0, (family?.balance || 0) - Number(amount)).toLocaleString()}</p>
                <p className="text-xs text-blue-800 font-medium mt-1">Applied to oldest outstanding charges first</p>
              </div>
              <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded-md">Part payment</span>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 w-full z-10">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSave}
            disabled={!amount || Number(amount) <= 0 || isSaving}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl disabled:opacity-50 shadow-lg hover:bg-blue-700 transition-colors"
          >
            {isSaving ? "Saving..." : "Save payment"}
          </button>
        </div>
      </div>
    </div>
  );
}