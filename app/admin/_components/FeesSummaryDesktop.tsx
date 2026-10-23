// app/admin/_components/FeesSummaryDesktop.tsx
import type { BulkGridRow } from "./BulkFeesGrid";

export function FeesSummaryDesktop({ data }: { data: BulkGridRow[] }) {
  const totalDue = data.reduce((sum, r) => sum + r.broughtForward + r.termFee, 0);
  const totalPaid = data.reduce((sum, r) => sum + r.amountPaid, 0);
  const leftToPay = data.reduce((sum, r) => sum + r.amountOwed, 0);
  
  const broughtForwardTotal = data.reduce((sum, r) => sum + r.broughtForward, 0);
  const progressPercent = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;

  const fullyPaid = data.filter(r => r.status === "Fully Paid").length;
  const partPaid = data.filter(r => r.status === "Part Payment").length;
  const notPaid = data.filter(r => r.status === "Not Paid").length;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
      
      {/* Top Row: Financials */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Due</p>
          <p className="text-2xl font-black text-slate-900">₦{totalDue.toLocaleString()}</p>
          {broughtForwardTotal > 0 && (
            <p className="text-[11px] text-orange-600 font-medium mt-1">
              incl. ₦{broughtForwardTotal.toLocaleString()} brought forward
            </p>
          )}
        </div>

        <div className="bg-green-50 p-4 rounded-xl border border-green-100">
          <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">Total Paid</p>
          <p className="text-2xl font-black text-green-700">₦{totalPaid.toLocaleString()}</p>
          <div className="h-1.5 w-full bg-green-200 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-green-600 rounded-full" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>

        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
          <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-1">Left to Pay</p>
          <p className="text-2xl font-black text-red-700">₦{leftToPay.toLocaleString()}</p>
          <p className="text-[11px] text-red-500 font-medium mt-1">
            {Math.round(progressPercent)}% collected
          </p>
        </div>
      </div>

      {/* Bottom Row: Status Counts */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
          <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Paid in Full</p>
          <p className="text-2xl font-black text-slate-900">{fullyPaid} <span className="text-sm font-medium text-slate-500">families</span></p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
          <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-1">Part Payment</p>
          <p className="text-2xl font-black text-slate-900">{partPaid} <span className="text-sm font-medium text-slate-500">families</span></p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
          <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">No Payment</p>
          <p className="text-2xl font-black text-slate-900">{notPaid} <span className="text-sm font-medium text-slate-500">families</span></p>
        </div>
      </div>

    </div>
  );
}