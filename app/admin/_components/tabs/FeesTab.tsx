"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Plus, Loader2, Upload, Download, Wand2, Trash2, X } from "lucide-react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { importFamilies, generateTermCharges, updateFamilyDetails, mergeFamilies } from "../../fees/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useCurrentTerm } from "@/hooks/useCurrentTerm";
import type { AdminView } from "../../_lib/types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { supabase } from "@/lib/supabaseClient";

import { useBulkFeesData } from "../../_hooks/useBulkFeesData";
import { FeesSummaryDesktop } from "../FeesSummaryDesktop";
import { BulkFeesGrid } from "../BulkFeesGrid";

export function FeesTab({ onNavigate }: { onNavigate: (v: AdminView) => void }) {
  const router = useRouter();
  
  // 1. Destructure termLoading from the hook
  const { term, loading: termLoading } = useCurrentTerm(); 
  
  const { data, loading: dataLoading, refetch } = useBulkFeesData(term?.id);
  
  // 2. Combine loading states
  const isLoading = termLoading || dataLoading;

  const [filter, setFilter] = useState<"all" | "unpaid" | "partial" | "paid">("all");
  const [search, setSearch] = useState("");
  
  // Bulk Add Family State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [bulkFamilies, setBulkFamilies] = useState([
    { name: "", guardianName: "", guardianPhone: "", initialCharge: "" }
  ]);
  const [rowToDelete, setRowToDelete] = useState<number | null>(null);

  // Generate Charges State
  const [isOwner, setIsOwner] = useState(false);
  const [isGenOpen, setIsGenOpen] = useState(false);
  const [genAmount, setGenAmount] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenConfirm, setShowGenConfirm] = useState(false);

  // Edit/Merge State
  const [editingFamily, setEditingFamily] = useState<any>(null);
  const [mergingFamily, setMergingFamily] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editGuardian, setEditGuardian] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [isMerging, setIsMerging] = useState(false);
  const [otherFamilies, setOtherFamilies] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.app_metadata?.role === 'owner') setIsOwner(true);
    });
  }, []);

  // Moved filteredData UP to be accessible by handleExport
  const filteredData = data.filter((f) => {
    const matchesFilter = 
      filter === "all" || 
      (filter === "paid" && f.status === "Fully Paid") ||
      (filter === "partial" && f.status === "Part Payment") ||
      (filter === "unpaid" && f.status === "Not Paid");
      
    const matchesSearch = 
      f.familyName.toLowerCase().includes(search.toLowerCase()) || 
      f.children.toLowerCase().includes(search.toLowerCase());
      
    return matchesFilter && matchesSearch;
  });

  const handleAddRow = () => {
    setBulkFamilies([...bulkFamilies, { name: "", guardianName: "", guardianPhone: "", initialCharge: "" }]);
  };

  const handleRemoveRow = (index: number) => {
    if (bulkFamilies.length === 1) return;
    
    const row = bulkFamilies[index];
    const hasData = row.name.trim() !== "" || 
                    row.guardianName.trim() !== "" || 
                    row.guardianPhone.trim() !== "" || 
                    row.initialCharge.trim() !== "";

    if (hasData) {
      setRowToDelete(index);
    } else {
      setBulkFamilies(bulkFamilies.filter((_, i) => i !== index));
    }
  };

  const confirmRemoveRow = () => {
    if (rowToDelete !== null) {
      setBulkFamilies(bulkFamilies.filter((_, i) => i !== rowToDelete));
      setRowToDelete(null);
    }
  };

  const handleUpdateRow = (index: number, field: string, value: string) => {
    const updated = [...bulkFamilies];
    updated[index] = { ...updated[index], [field]: value };
    setBulkFamilies(updated);
  };

  const handleSaveFamilies = async () => {
    if (!term?.id) {
      toast.error("No active term found.");
      return;
    }

    const validRows = bulkFamilies.filter(f => f.name.trim() && f.guardianPhone.trim());
    
    if (validRows.length === 0) {
      toast.error("Please fill in at least one family name and phone number.");
      return;
    }

    setIsSaving(true);
    try {
      const rowsToImport = validRows.map(f => ({
        familyName: f.name.trim(),
        guardianName: f.guardianName.trim() || "Guardian",
        guardianPhone: f.guardianPhone.trim(),
        totalDue: Number(f.initialCharge) || 0,
        totalPaid: 0, 
      }));

      const res = await importFamilies(rowsToImport, term.id);
      
      if (res.success) {
        if (res.skipped > 0) {
          toast.success(`Added ${res.inserted} families. ${res.skipped} duplicates skipped.`);
        } else {
          toast.success(`Successfully added ${res.inserted} families!`);
        }
        setIsAddOpen(false);
        setBulkFamilies([{ name: "", guardianName: "", guardianPhone: "", initialCharge: "" }]);
        await refetch();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to add families");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateCharges = async () => {
    if (!term?.id || !genAmount || Number(genAmount) <= 0) return;
    setIsGenerating(true);
    try {
      const { data: schoolClasses, error } = await supabase.from('classes').select('id');
      if (error) throw error;

      const feesToGenerate = (schoolClasses || []).map(c => ({
        class_id: c.id,
        amount: Number(genAmount)
      }));

      const res = await generateTermCharges(term.id, feesToGenerate);
      
      if (res.success) {
        toast.success(`Successfully generated ${res.generatedCharges} tuition charges.`);
        setIsGenOpen(false);
        setGenAmount("");
        await refetch();
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsGenerating(false);
      setShowGenConfirm(false);
    }
  };

  const handleExport = () => {
    if (filteredData.length === 0) {
      toast.error("No data to export");
      return;
    }

    const exportData = filteredData.map((row) => ({
      "Family Name": row.familyName,
      "Children": row.children,
      "Brought Forward (NGN)": row.broughtForward,
      "Term Fee (NGN)": row.termFee,
      "Amount Paid (NGN)": row.amountPaid,
      "Amount Owed (NGN)": row.amountOwed,
      "Status": row.status,
      "Guardian Phone": row.guardianPhone,
      "Remarks": row.latestPaymentNote || "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fees Data");

    const wscols = [
      { wch: 25 }, { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }
    ];
    ws["!cols"] = wscols;

    const date = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Fees_Export_${date}.xlsx`);
    
    toast.success("Exported to Excel successfully");
  };

  const handleOpenEdit = (row: any) => {
    setEditingFamily(row);
    setEditName(row.familyName);
    setEditGuardian(row.guardianName);
    setEditPhone(row.guardianPhone);
  };

  const handleSaveEdit = async () => {
    setIsSavingEdit(true);
    try {
      await updateFamilyDetails(editingFamily.familyId, {
        name: editName,
        guardianName: editGuardian,
        guardianPhone: editPhone,
      });
      toast.success("Family details updated");
      setEditingFamily(null);
      await refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleOpenMerge = async (row: any) => {
    setMergingFamily(row);
    setMergeTargetId("");
    const { data } = await supabase
      .from("families")
      .select("id, name")
      .neq("id", row.familyId)
      .is("deleted_at", null)
      .order("name");
    if (data) setOtherFamilies(data);
  };

  const handleSaveMerge = async () => {
    if (!mergeTargetId) return;
    setIsMerging(true);
    try {
      await mergeFamilies(mergeTargetId, mergingFamily.familyId);
      toast.success("Families merged successfully");
      setMergingFamily(null);
      await refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="w-full">
      <div className="w-full px-4 pb-24 pt-4">
        
        <header className="flex items-center gap-2 mb-6">
          <button onClick={() => onNavigate("home")} className="p-2 -ml-2 rounded-lg hover:bg-slate-200 transition">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Fees</h1>
            <p className="text-sm text-slate-500">Manage family balances</p>
          </div>
        </header>

        {/* 3. Updated Conditional Rendering */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm font-medium animate-pulse">Loading fees data...</p>
          </div>
        ) : !term?.id ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-2">
            <p className="font-bold text-lg">No Active Term Found</p>
            <p className="text-sm">Please go to Settings and select a current term.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <FeesSummaryDesktop data={data} />
            </div>

            <div className="md:hidden max-w-lg mx-auto bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Collected this term</p>
              <div className="flex items-end gap-1.5 mb-3">
                <h2 className="text-[34px] leading-none font-black text-blue-600">
                  ₦{((data || []).reduce((sum, r) => sum + r.amountPaid, 0) / 1000000).toFixed(2)}M
                </h2>
                <span className="text-slate-400 text-sm font-medium mb-1">
                  of ₦{((data || []).reduce((sum, r) => sum + r.broughtForward + r.termFee, 0) / 1000000).toFixed(2)}M
                </span>
              </div>
              
              <div className="h-2 w-full bg-slate-100 rounded-full mb-4 overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full" 
                  style={{ 
                    width: `${((data || []).reduce((sum, r) => sum + r.amountPaid, 0) / Math.max(1, (data || []).reduce((sum, r) => sum + r.broughtForward + r.termFee, 0))) * 100}%` 
                  }}
                ></div>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-slate-800">
                  ₦{((data || []).reduce((sum, r) => sum + r.amountOwed, 0) / 1000000).toFixed(2)}M left to collect
                </span>
                <span className="text-slate-400 font-medium">{data.length} families</span>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mb-5 max-w-lg md:max-w-none mx-auto">
              {[
                { id: "all", label: "All", count: data.length, bg: "bg-blue-600", text: "text-white" },
                { id: "unpaid", label: "Not paid", count: data.filter(f => f.status === "Not Paid").length, bg: "bg-white", text: "text-red-500" },
                { id: "partial", label: "Part paid", count: data.filter(f => f.status === "Part Payment").length, bg: "bg-white", text: "text-orange-500" },
                { id: "paid", label: "Paid", count: data.filter(f => f.status === "Fully Paid").length, bg: "bg-white", text: "text-green-600" },
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

            <div className="flex flex-col md:flex-row gap-3 mb-5 max-w-lg md:max-w-none mx-auto">
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

              {/* Responsive Grid for buttons */}
              <div className="grid grid-cols-2 md:flex md:flex-row gap-2 w-full md:w-auto">
                {isOwner && (
                  <Dialog open={isGenOpen} onOpenChange={setIsGenOpen}>
                    <DialogTrigger asChild>
                      <button className="w-full md:w-auto bg-emerald-600 text-white font-bold px-4 py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm text-[15px] whitespace-nowrap">
                        <Wand2 className="w-4 h-4" /> Setup Term Fees
                      </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px] w-[90%] rounded-2xl">
                      <DialogHeader>
                        <DialogTitle>Generate Term Charges</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Base Tuition Amount (₦)</label>
                          <input 
                            type="number" 
                            value={genAmount} 
                            onChange={(e) => setGenAmount(e.target.value)} 
                            placeholder="e.g. 50000"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:border-emerald-500" 
                          />
                          <p className="text-xs text-slate-500 mt-2">
                            This amount will be applied to every active student for the current term. Previous debts remain on the ledger.
                          </p>
                        </div>
                        <button 
                          onClick={() => setShowGenConfirm(true)} 
                          disabled={!genAmount || Number(genAmount) <= 0}
                          className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl mt-2 disabled:opacity-50"
                        >
                          Generate Charges
                        </button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                <button 
                  onClick={() => router.push("/admin/fees/import")}
                  className="w-full md:w-auto bg-white border border-slate-200 text-slate-700 font-bold px-4 py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors shadow-sm text-[15px] whitespace-nowrap"
                >
                  <Download className="w-4 h-4" /> Import
                </button>

                <button 
                  onClick={handleExport}
                  className="w-full md:w-auto bg-white border border-slate-200 text-slate-700 font-bold px-4 py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors shadow-sm text-[15px] whitespace-nowrap"
                >
                  <Upload className="w-4 h-4" /> Export
                </button>

                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                  <DialogTrigger asChild>
                    <button className="w-full md:w-auto bg-blue-600 text-white font-bold px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-sm text-[15px] whitespace-nowrap">
                      <Plus className="w-4 h-4" /> Add Families
                    </button>
                  </DialogTrigger>
                  
                  <DialogContent className="sm:max-w-4xl w-[95%] max-h-[90vh] flex flex-col rounded-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-6 border-b border-slate-100">
                      <DialogTitle>Add Families</DialogTitle>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
                      <div className="hidden md:grid grid-cols-12 gap-3 px-2 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <div className="col-span-3">Family Name</div>
                        <div className="col-span-3">Guardian Name</div>
                        <div className="col-span-2">Phone</div>
                        <div className="col-span-2">Initial Fee (₦)</div>
                        <div className="col-span-1"></div>
                      </div>

                      {bulkFamilies.map((row, index) => (
                        <div key={index} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm md:shadow-none md:border-none md:bg-transparent md:p-0 md:grid md:grid-cols-12 md:gap-3 md:items-center relative space-y-3 md:space-y-0">
                          
                          <div className="md:col-span-3">
                            <label className="block md:hidden text-xs font-bold text-slate-500 mb-1">Family Name</label>
                            <input 
                              type="text" 
                              value={row.name} 
                              onChange={(e) => handleUpdateRow(index, "name", e.target.value)} 
                              placeholder="e.g. Adeyemi Family"
                              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" 
                            />
                          </div>
                          
                          <div className="md:col-span-3">
                            <label className="block md:hidden text-xs font-bold text-slate-500 mb-1">Guardian Name</label>
                            <input 
                              type="text" 
                              value={row.guardianName} 
                              onChange={(e) => handleUpdateRow(index, "guardianName", e.target.value)} 
                              placeholder="e.g. Mr. Tunde"
                              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" 
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block md:hidden text-xs font-bold text-slate-500 mb-1">Phone</label>
                            <input 
                              type="tel" 
                              value={row.guardianPhone} 
                              onChange={(e) => handleUpdateRow(index, "guardianPhone", e.target.value)} 
                              placeholder="080..."
                              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" 
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block md:hidden text-xs font-bold text-slate-500 mb-1">Initial Fee (₦)</label>
                            <input 
                              type="number" 
                              value={row.initialCharge} 
                              onChange={(e) => handleUpdateRow(index, "initialCharge", e.target.value)} 
                              placeholder="0"
                              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" 
                            />
                          </div>

                          <div className="md:col-span-2 flex justify-end md:justify-center pt-2 md:pt-0">
                            <button 
                              onClick={() => handleRemoveRow(index)}
                              disabled={bulkFamilies.length === 1}
                              className="p-2 text-red-400 hover:text-red-600 bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}

                      <button 
                        onClick={handleAddRow}
                        className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 font-bold rounded-xl hover:bg-slate-100 hover:border-slate-400 transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <Plus className="w-4 h-4" /> Add Another Row
                      </button>
                    </div>

                    <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center sticky bottom-0 z-10">
                      <p className="text-xs text-slate-500 font-medium hidden md:block">
                        Total rows: {bulkFamilies.length}
                      </p>
                      <div className="flex gap-3 w-full md:w-auto">
                        <button 
                          onClick={() => setIsAddOpen(false)} 
                          className="flex-1 md:flex-none px-6 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleSaveFamilies} 
                          disabled={isSaving}
                          className="flex-1 md:flex-none px-8 bg-blue-600 text-white font-bold py-3 rounded-xl disabled:opacity-50 hover:bg-blue-700 flex justify-center items-center gap-2"
                        >
                          {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : `Save ${bulkFamilies.length} Families`}
                        </button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="md:hidden max-w-lg mx-auto space-y-3">
              {filteredData.map((family) => (
                <Link href={`/admin/fees/family/${family.familyId}`} key={family.familyId} className="block bg-white rounded-3xl p-5 shadow-sm border border-slate-100 active:scale-[0.98] transition-transform">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-slate-900 text-[17px]">{family.familyName}</h3>
                    <div className="text-right">
                      {family.status === "Fully Paid" ? (
                        <span className="text-green-600 font-bold flex items-center justify-end gap-1 text-[15px]">✓ Paid</span>
                      ) : (
                        <>
                          <p className={`font-bold text-[17px] ${family.status === "Not Paid" ? "text-red-500" : "text-orange-500"}`}>₦{family.amountOwed.toLocaleString()}</p>
                          <p className={`text-[12px] font-bold mt-0.5 ${family.status === "Not Paid" ? "text-red-500" : "text-orange-500"}`}>{family.status === "Not Paid" ? "Not paid" : "Part payment"}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-[14px] text-slate-500 font-medium truncate">{family.children}</p>
                </Link>
              ))}
              {filteredData.length === 0 && (
                <div className="text-center py-10 text-slate-400 font-medium">No families found.</div>
              )}
            </div>

            <div className="hidden md:block w-full overflow-x-auto">
               <BulkFeesGrid 
                 data={filteredData} 
                 refetch={refetch} 
                 onEdit={handleOpenEdit}
                 onMerge={handleOpenMerge}
                 onRowClick={(row) => router.push(`/admin/fees/family/${row.familyId}`)}
               />
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={showGenConfirm}
        onOpenChange={setShowGenConfirm}
        title="Generate Term Charges?"
        description={`This will generate a charge of ₦${Number(genAmount).toLocaleString()} for all active families. Previous unpaid balances will remain on their ledger and be calculated automatically. This cannot be undone.`}
        confirmLabel="Yes, Generate"
        destructive={false}
        loading={isGenerating}
        onConfirm={handleGenerateCharges}
      />

      <ConfirmDialog
        open={rowToDelete !== null}
        onOpenChange={(open) => !open && setRowToDelete(null)}
        title="Delete this row?"
        description="Are you sure you want to delete this row? Any unsaved data you have typed will be lost."
        confirmLabel="Delete Row"
        destructive={true}
        onConfirm={confirmRemoveRow}
      />

      {/* EDIT FAMILY MODAL */}
      {editingFamily && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-black text-slate-900 mb-4">Edit Family Details</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Family Name</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Guardian Name</label>
                <input type="text" value={editGuardian} onChange={(e) => setEditGuardian(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Guardian Phone</label>
                <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingFamily(null)} className="flex-1 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl">Cancel</button>
              <button onClick={handleSaveEdit} disabled={isSavingEdit} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl disabled:opacity-50">
                {isSavingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MERGE FAMILY MODAL */}
      {mergingFamily && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-black text-slate-900 mb-4">Merge Family</h2>
            <p className="text-sm text-slate-500 mb-4">
              Merge <strong>{mergingFamily.familyName}</strong> into another family. All charges, payments, and children will be moved.
            </p>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Family</label>
            <select 
              value={mergeTargetId} 
              onChange={(e) => setMergeTargetId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 mb-6"
            >
              <option value="">Select a family...</option>
              {otherFamilies.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setMergingFamily(null)} className="flex-1 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl">Cancel</button>
              <button onClick={handleSaveMerge} disabled={!mergeTargetId || isMerging} className="flex-1 bg-purple-600 text-white font-bold py-3 rounded-xl disabled:opacity-50">
                {isMerging ? "Merging..." : "Merge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}