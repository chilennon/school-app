"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Plus, Phone } from "lucide-react";
import { calculateFamilyBalances } from "@/lib/fees";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { addFamily } from "./actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function FeesUI({ families, term }: { families: any[], term: any }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unpaid" | "partial" | "paid">("all");
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Add Family Form State
  const [familyName, setFamilyName] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [initialCharge, setInitialCharge] = useState("");

  // Process data with FIFO calculation
  const processedFamilies = useMemo(() => {
    return families.map((family) => {
      const calc = calculateFamilyBalances(family.charges || [], family.payments || []);
      return {
        ...family,
        balance: calc.currentBalance,
        status: calc.currentBalance <= 0 ? "paid" : calc.totalPaid > 0 ? "partial" : "unpaid",
        childrenNames: family.students.map((s: any) => `${s.name.split(" ")[0]} · ${s.classes?.name || "No Class"}`).join(", "),
      };
    }).sort((a, b) => b.balance - a.balance);
  }, [families]);

  const totalCollected = processedFamilies.reduce((sum, f) => sum + (f.totalPaid || 0), 0);
  const totalExpected = processedFamilies.reduce((sum, f) => sum + (f.totalCharged || 0), 0);
  const progressPercent = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

  const filteredFamilies = processedFamilies.filter((f) => {
    const matchesFilter = filter === "all" || f.status === filter;
    const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase()) || 
                          f.childrenNames.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleSaveFamily = async () => {
    if (!familyName || !guardianName || !guardianPhone) {
      toast.error("Please fill in all fields");
      return;
    }
    setIsSaving(true);
    try {
      const res = await addFamily({
        name: familyName,
        guardianName,
        guardianPhone,
        initialCharge: Number(initialCharge) || 0,
        termId: term?.id,
        students: [], 
      });
      if (res.success) {
        toast.success("Family added");
        setIsAddOpen(false);
        setFamilyName(""); setGuardianName(""); setGuardianPhone(""); setInitialCharge("");
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 w-full">
      {/* Changed max-w-lg to include md:max-w-6xl for desktop */}
      <main className="max-w-lg md:max-w-6xl mx-auto p-4 pb-24">
        
        {/* Standard Header */}
        <header className="flex items-center gap-2 mb-6">
          <Link href="/admin" className="p-2 -ml-2 rounded-lg hover:bg-slate-200 transition">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Fees</h1>
            <p className="text-sm text-slate-500">Manage family balances</p>
          </div>
        </header>

        {/* Summary Card */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Collected this term</p>
          <div className="flex items-end gap-1.5 mb-3">
            <h2 className="text-[34px] leading-none font-black text-blue-600">
              ₦{(totalCollected / 1000000).toFixed(2)}M
            </h2>
            <span className="text-slate-400 text-sm font-medium mb-1">
              of ₦{(totalExpected / 1000000).toFixed(2)}M
            </span>
          </div>
          
          <div className="h-2 w-full bg-slate-100 rounded-full mb-4 overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${progressPercent}%` }}></div>
          </div>
          
          <div className="flex justify-between items-center text-sm">
            <span className="font-bold text-slate-800">
              ₦{((totalExpected - totalCollected) / 1000000).toFixed(2)}M left to collect
            </span>
            <span className="text-slate-400 font-medium">{processedFamilies.length} families</span>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mb-5">
          {[
            { id: "all", label: "All", count: processedFamilies.length, bg: "bg-blue-600", text: "text-white" },
            { id: "unpaid", label: "Not paid", count: processedFamilies.filter(f => f.status === "unpaid").length, bg: "bg-white", text: "text-red-500" },
            { id: "partial", label: "Part paid", count: processedFamilies.filter(f => f.status === "partial").length, bg: "bg-white", text: "text-orange-500" },
            { id: "paid", label: "Paid", count: processedFamilies.filter(f => f.status === "paid").length, bg: "bg-white", text: "text-green-600" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`flex flex-col items-center justify-center min-w-[76px] py-2.5 px-3 rounded-2xl border transition-all ${
                filter === tab.id ? "bg-blue-600 border-blue-600 shadow-sm" : `${tab.bg} border-slate-200`
              }`}
            >
              <span className={`text-lg font-bold ${filter === tab.id ? "text-white" : tab.text}`}>{tab.count}</span>
              <span className={`text-[11px] font-semibold ${filter === tab.id ? "text-blue-100" : "text-slate-500"}`}>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Search & Actions Row */}
        <div className="flex flex-col md:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search family or child..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-[15px] font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
          </div>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <button className="bg-white border border-dashed border-blue-300 text-blue-600 font-bold px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors shadow-sm text-[15px] whitespace-nowrap">
                <Plus className="w-4 h-4" /> Add Family
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] w-[90%] rounded-2xl">
              <DialogHeader>
                <DialogTitle>Add New Family</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Family Name</label>
                  <input type="text" value={familyName} onChange={(e) => setFamilyName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Guardian Name</label>
                  <input type="text" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Guardian Phone</label>
                  <input type="tel" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Initial Fee (₦)</label>
                  <input type="number" value={initialCharge} onChange={(e) => setInitialCharge(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <button onClick={handleSaveFamily} disabled={isSaving} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl mt-2">
                  {isSaving ? "Saving..." : "Save Family"}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* ========================================== */}
        {/* MOBILE VIEW: Cards (Hidden on Desktop)     */}
        {/* ========================================== */}
        <div className="md:hidden space-y-3">
          {filteredFamilies.map((family) => (
            <Link href={`/admin/fees/family/${family.id}`} key={family.id} className="block bg-white rounded-3xl p-5 shadow-sm border border-slate-100 active:scale-[0.98] transition-transform">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-bold text-slate-900 text-[17px]">{family.name}</h3>
                <div className="text-right">
                  {family.status === "paid" ? (
                    <span className="text-green-600 font-bold flex items-center justify-end gap-1 text-[15px]">✓ Paid</span>
                  ) : (
                    <>
                      <p className={`font-bold text-[17px] ${family.status === "unpaid" ? "text-red-500" : "text-orange-500"}`}>₦{family.balance.toLocaleString()}</p>
                      <p className={`text-[12px] font-bold mt-0.5 ${family.status === "unpaid" ? "text-red-500" : "text-orange-500"}`}>{family.status === "unpaid" ? "Not paid" : "Part payment"}</p>
                    </>
                  )}
                </div>
              </div>
              <p className="text-[14px] text-slate-500 font-medium truncate">{family.childrenNames}</p>
            </Link>
          ))}
          {filteredFamilies.length === 0 && (
            <div className="text-center py-10 text-slate-400 font-medium">No families found.</div>
          )}
        </div>

        {/* ========================================== */}
        {/* DESKTOP VIEW: Data Table (Hidden on Mobile)*/}
        {/* ========================================== */}
        <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-6 py-4">Family Name</th>
                <th className="px-6 py-4">Children</th>
                <th className="px-6 py-4 text-right">Total Owed</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFamilies.map((family) => (
                <tr key={family.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 font-bold text-slate-900">
                    <Link href={`/admin/fees/family/${family.id}`} className="hover:text-blue-600">
                      {family.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{family.childrenNames}</td>
                  <td className={`px-6 py-4 text-right font-bold ${family.status === "paid" ? "text-green-600" : family.status === "unpaid" ? "text-red-500" : "text-orange-500"}`}>
                    ₦{family.balance.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      family.status === "paid" ? "bg-green-100 text-green-700" : 
                      family.status === "unpaid" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                    }`}>
                      {family.status === "paid" ? "Paid" : family.status === "unpaid" ? "Not paid" : "Part paid"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <a href={`tel:${family.guardian_phone}`} className="p-2 text-slate-400 hover:text-blue-600 bg-white rounded-md shadow-sm border border-slate-200">
                         <Phone className="w-4 h-4" />
                       </a>
                       <Link href={`/admin/fees/family/${family.id}/record-payment`} className="text-xs font-bold bg-blue-600 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-blue-700">
                         Record Payment
                       </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredFamilies.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No families found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </main>
    </div>
  );
}