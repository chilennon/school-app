"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { calculateFamilyBalances } from "@/lib/fees";
import { voidPayment } from "../../actions";
import { ArrowLeft, Phone, Loader2, X } from "lucide-react";
import { toast } from "sonner";

export default function FamilyDetail() {
  const params = useParams();
  const router = useRouter();
  const [family, setFamily] = useState<any>(null);

  const [voidingPayment, setVoidingPayment] = useState<{ id: string; amount: number } | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [isVoiding, setIsVoiding] = useState(false);

  const fetchFamily = async () => {
    const { data } = await supabase.from("families")
      .select(`
        *,
        students(name, classes(name)),
        charges(id, amount, description, term_id, created_at, terms(name, sequence)),
        payments(id, amount, method, reference, receipt_no, paid_on, note, created_at)
      `)
      .eq("id", params.id)
      .single();

    if (data) {
      const calc = calculateFamilyBalances(data.charges, data.payments);
      
      // Group by term (Oldest to Newest based on sequence)
      const groupedByTerm = calc.breakdown.reduce((acc: any, charge: any) => {
        const termName = charge.terms?.name || "Unknown Term";
        const sequence = charge.terms?.sequence || 0;
        
        if (!acc[termName]) {
          acc[termName] = { 
            total: 0, 
            paid: 0, 
            remaining: 0, 
            originalAmount: 0,
            sequence: sequence
          };
        }
        acc[termName].originalAmount += charge.amount;
        acc[termName].remaining += charge.remaining;
        acc[termName].paid += (charge.amount - charge.remaining);
        return acc;
      }, {});

      // Convert to array and sort by sequence (oldest first)
      const sortedTerms = Object.entries(groupedByTerm)
        .map(([name, data]: [string, any]) => ({ name, ...data }))
        .sort((a, b) => a.sequence - b.sequence);

      setFamily({ ...data, ...calc, groupedTerms: sortedTerms });
    }
  };

  useEffect(() => {
    fetchFamily();
    const channel = supabase.channel(`family_${params.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `family_id=eq.${params.id}` }, fetchFamily)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [params.id]);

  const handleVoidSubmit = async () => {
    if (!voidReason.trim()) {
      toast.error("Please provide a reason.");
      return;
    }
    setIsVoiding(true);
    try {
      await voidPayment(voidingPayment!.id, voidingPayment!.amount, voidReason, params.id as string);
      toast.success("Payment voided.");
      setVoidingPayment(null);
      setVoidReason("");
      fetchFamily();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsVoiding(false);
    }
  };

  if (!family) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading...</div>;

  const isPaid = family.currentBalance <= 0;
  const statusText = isPaid ? "Paid" : family.totalPaid > 0 ? "Part payment" : "Not paid";
  const statusColor = isPaid ? "bg-green-100 text-green-700" : family.totalPaid > 0 ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700";
  const amountColor = isPaid ? "text-green-600" : "text-red-600";

  return (
    <div className="min-h-screen bg-slate-50 w-full pb-28">
      <main className="max-w-lg mx-auto p-4">
        
        <header className="flex items-center gap-2 mb-6">
          <button onClick={() => router.push("/admin/fees")} className="p-2 -ml-2 rounded-lg hover:bg-slate-200 transition">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{family.name}</h1>
            <p className="text-sm text-slate-500">{family.guardian_phone}</p>
          </div>
          <a href={`tel:${family.guardian_phone}`} className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-blue-600 bg-white shadow-sm">
            <Phone className="w-5 h-5" />
          </a>
        </header>

        <div className="space-y-4">
          {/* Total Owed */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-1">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Owed</p>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColor}`}>{statusText}</span>
            </div>
            <h2 className={`text-4xl font-black mb-2 ${amountColor}`}>₦{family.currentBalance.toLocaleString()}</h2>
            <div className="h-2 w-full bg-slate-100 rounded-full mb-2 overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${(family.totalPaid / family.totalCharged) * 100}%` }}></div>
            </div>
            <p className="text-xs text-slate-500 font-medium">₦{family.totalPaid.toLocaleString()} paid of ₦{family.totalCharged.toLocaleString()}</p>
          </div>

          {/* Children */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-900 mb-3">Children</h3>
            <div className="space-y-3">
              {family.students.map((student: any, i: number) => (
                <div key={i} className="flex justify-between items-center border-b border-slate-50 last:border-0 pb-2 last:pb-0">
                  <span className="font-semibold text-slate-800">{student.name}</span>
                  <span className="text-slate-500 text-sm font-medium">{student.classes?.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By Term (Oldest to Newest) */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-900 mb-3">By term</h3>
            <div className="space-y-4">
              {family.groupedTerms.map((term: any, idx: number) => (
                <div key={idx} className="flex justify-between items-start border-b border-slate-50 last:border-0 pb-3 last:pb-0">
                  <div>
                    <p className="font-semibold text-slate-900">{term.name}</p>
                    <p className="text-xs text-slate-500 font-medium">
                      {term.paid > 0 ? `Paid ₦${term.paid.toLocaleString()} of ₦${term.originalAmount.toLocaleString()}` : "Carried over, unpaid"}
                    </p>
                  </div>
                  <p className={`font-bold ${term.remaining > 0 ? "text-orange-600" : "text-green-600"}`}>
                    ₦{term.remaining.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Payments */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-900 mb-3">Payments</h3>
            <div className="space-y-4">
              {family.payments.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((payment: any) => (
                <div key={payment.id} className="flex justify-between items-start border-b border-slate-50 last:border-0 pb-3 last:pb-0">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {new Date(payment.paid_on).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                    <p className="text-xs text-slate-500 capitalize font-medium">
                      {payment.method} {payment.reference ? `· Ref ${payment.reference}` : ""}
                    </p>
                    {payment.amount < 0 && <p className="text-xs text-red-500 mt-1">{payment.note}</p>}
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${payment.amount < 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {payment.amount < 0 ? '-' : '+'}₦{Math.abs(payment.amount).toLocaleString()}
                    </p>
                    {payment.amount > 0 && (
                      <button onClick={() => setVoidingPayment({ id: payment.id, amount: payment.amount })} className="text-xs text-red-500 font-bold mt-1 hover:underline">
                        Void
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4">
        <div className="max-w-lg mx-auto">
          <Link href={`/admin/fees/family/${family.id}/record-payment`} className="block w-full bg-blue-600 text-white text-center font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition-colors">
            Record Payment
          </Link>
        </div>
      </div>

      {/* Void Modal */}
      {voidingPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black text-slate-900">Void Payment</h2>
              <button onClick={() => setVoidingPayment(null)} className="p-2 bg-slate-100 rounded-full text-slate-500"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">This will insert a negative reversing entry of ₦{voidingPayment.amount.toLocaleString()}.</p>
            <label className="block text-sm font-bold text-slate-700 mb-2">Reason</label>
            <input type="text" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Wrong amount" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500 mb-6" />
            <div className="flex gap-3">
              <button onClick={() => setVoidingPayment(null)} className="flex-1 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl">Cancel</button>
              <button onClick={handleVoidSubmit} disabled={isVoiding || !voidReason.trim()} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl disabled:opacity-50">
                {isVoiding ? "Voiding..." : "Void"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}