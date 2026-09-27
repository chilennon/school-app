import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-sm sm:max-w-md text-center space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-bold text-xl sm:text-2xl shadow-md mb-3">
            GF
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">House Of Angels School</h1>
          <p className="text-xs text-slate-500 font-medium">K-12 School Management System</p>
        </div>

        <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
          Select how you want to sign in
        </p>

        {/* Portals List */}
        <div className="space-y-3 sm:space-y-4 text-left">
          {/* Parent Portal */}
          <Link
            href="/sign-in/parent"
            className="block p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-md transition group"
          >
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-blue-600">
                Parent & Guardian Portal
              </h2>
              <span className="text-[9px] sm:text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold">
                Fast Access
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
              View child&apos;s report cards, pay school fees, and track attendance.
            </p>
          </Link>

          {/* Staff Portal */}
          <Link
            href="/sign-in/staff"
            className="block p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-md transition group"
          >
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-blue-600 mb-1">
              Staff & Teacher Portal
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
              Enter marks, manage lesson notes, assign classes, and record daily attendance.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
