"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { calculateFamilyBalances } from "@/lib/fees";
import { amountToWords } from "@/lib/utils/amountToWords";
import { voidPayment, updateFamilyDetails, deleteFamily, mergeFamilies } from "../../actions";
import { ArrowLeft, Phone, X, Receipt as ReceiptIcon, Share2, Printer, Pencil, Trash2, Download, FileImage, FileText, GitMerge } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useSchoolConfig } from "@/hooks/useSchoolConfig";
import { Receipt } from "../../_components/Receipt";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

export default function FamilyDetail() {
  const params = useParams();
  const router = useRouter();
  const { config: school } = useSchoolConfig();
  const receiptRef = useRef<HTMLDivElement>(null);

  const [family, setFamily] = useState<any>(null);

  // Modals & Interaction State
  const [voidingPayment, setVoidingPayment] = useState<{ id: string; amount: number } | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [isVoiding, setIsVoiding] = useState(false);
  
  const [receiptPayment, setReceiptPayment] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editGuardian, setEditGuardian] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Merge State
  const [isMerging, setIsMerging] = useState(false);
  const [otherFamilies, setOtherFamilies] = useState<any[]>([]);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [isMergingSubmit, setIsMergingSubmit] = useState(false);
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);

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
      const groupedByTerm = calc.breakdown.reduce((acc: any, charge: any) => {
        const termName = charge.terms?.name || "Unknown Term";
        const sequence = charge.terms?.sequence || 0;
        if (!acc[termName]) acc[termName] = { total: 0, paid: 0, remaining: 0, originalAmount: 0, sequence };
        acc[termName].originalAmount += charge.amount;
        acc[termName].remaining += charge.remaining;
        acc[termName].paid += (charge.amount - charge.remaining);
        return acc;
      }, {});
      const sortedTerms = Object.entries(groupedByTerm)
        .map(([name, data]: [string, any]) => ({ name, ...data }))
        .sort((a, b) => a.sequence - b.sequence);

      setFamily({ ...data, ...calc, groupedTerms: sortedTerms });
      setEditName(data.name);
      setEditGuardian(data.guardian_name);
      setEditPhone(data.guardian_phone);
    }
  };

  const fetchOtherFamilies = async () => {
    const { data } = await supabase
      .from("families")
      .select("id, name")
      .neq("id", params.id)
      .is("deleted_at", null)
      .order("name");
    if (data) setOtherFamilies(data);
  };

  useEffect(() => {
    fetchFamily();
    fetchOtherFamilies();
    const channel = supabase.channel(`family_${params.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `family_id=eq.${params.id}` }, fetchFamily)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [params.id]);

  const handleVoidSubmit = async () => {
    if (!voidReason.trim()) return;
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

  const handleSaveEdit = async () => {
    if (!editName || !editGuardian || !editPhone) {
      toast.error("All fields are required.");
      return;
    }
    setIsSavingEdit(true);
    try {
      await updateFamilyDetails(params.id as string, {
        name: editName,
        guardianName: editGuardian,
        guardianPhone: editPhone,
      });
      toast.success("Family details updated.");
      setIsEditing(false);
      fetchFamily();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteFamily(params.id as string);
      toast.success("Family deleted.");
      router.push("/admin?tab=fees");
    } catch (err: any) {
      toast.error(err.message);
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMergeSubmit = async () => {
    if (!mergeTargetId) return;
    setIsMergingSubmit(true);
    try {
      await mergeFamilies(mergeTargetId, params.id as string);
      toast.success("Families merged successfully.");
      router.push(`/admin/fees/family/${mergeTargetId}`);
    } catch (err: any) {
      toast.error(err.message);
      setIsMergingSubmit(false);
      setShowMergeConfirm(false);
    }
  };

  // --- GENERATION LOGIC ---
  const downloadPdf = async () => {
    if (!receiptRef.current) return;
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(receiptRef.current, { scale: 2, backgroundColor: "#f8f6f0", useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`Receipt-${receiptPayment.receipt_no}.pdf`);
      toast.success("PDF Downloaded");
    } catch (err) {
      console.error("PDF Error:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = async () => {
    if (!receiptRef.current) return;
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(receiptRef.current, { scale: 2, backgroundColor: "#f8f6f0", useCORS: true });
      const link = document.createElement("a");
      link.download = `Receipt-${receiptPayment.receipt_no}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Image Downloaded");
    } catch (err) {
      console.error("Image Error:", err);
      toast.error("Failed to generate Image");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async (format: 'image' | 'pdf') => {
    if (!receiptRef.current) return;
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(receiptRef.current, { scale: 2, backgroundColor: "#f8f6f0", useCORS: true });
      let file: File;

      if (format === 'image') {
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
        file = new File([blob], `Receipt-${receiptPayment.receipt_no}.png`, { type: "image/png" });
      } else {
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width, canvas.height] });
        pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
        const pdfBlob = pdf.output('blob');
        file = new File([pdfBlob], `Receipt-${receiptPayment.receipt_no}.pdf`, { type: "application/pdf" });
      }

      const shareData = {
        files: [file],
        title: 'Payment Receipt',
        text: `Receipt for ${family?.name}`,
      };

      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        const link = document.createElement("a");
        link.download = file.name;
        link.href = URL.createObjectURL(file);
        link.click();
        toast.success(`${format.toUpperCase()} saved (Share not supported)`);
      }
      setShowShareMenu(false);
    } catch (err) {
      console.error("Share Error:", err);
      toast.error("Failed to share file");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!family || !school) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading...</div>;

  const isSafeToDelete = family.charges.length === 0 && family.payments.length === 0;
  const isPaid = family.currentBalance <= 0;
  const statusText = isPaid ? "Paid" : family.totalPaid > 0 ? "Part payment" : "Not paid";
  const statusColor = isPaid ? "bg-green-100 text-green-700" : family.totalPaid > 0 ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700";
  const amountColor = isPaid ? "text-green-600" : "text-red-600";

  return (
    <div className="min-h-screen bg-slate-50 w-full pb-28 print:hidden">
      <main className="max-w-lg mx-auto p-4">
        
        <header className="flex items-start gap-2 mb-6">
          <button onClick={() => router.push("/admin?tab=fees")} className="p-2 -ml-2 mt-1 rounded-lg hover:bg-slate-200 transition">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 truncate">{family.name}</h1>
            <p className="text-sm text-slate-500">{family.guardian_phone}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => setIsMerging(true)} className="p-2 rounded-full border border-slate-200 bg-white text-slate-600 hover:text-purple-600 shadow-sm" title="Merge Family">
              <GitMerge className="w-4 h-4" />
            </button>
            <button onClick={() => setIsEditing(true)} className="p-2 rounded-full border border-slate-200 bg-white text-slate-600 hover:text-blue-600 shadow-sm">
              <Pencil className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setShowDeleteConfirm(true)} 
              disabled={!isSafeToDelete}
              className="p-2 rounded-full border border-slate-200 bg-white text-slate-600 hover:text-red-600 shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <a href={`tel:${family.guardian_phone}`} className="p-2 rounded-full border border-slate-200 bg-white text-blue-600 shadow-sm">
              <Phone className="w-4 h-4" />
            </a>
          </div>
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
              {family.students.length === 0 && <p className="text-sm text-slate-500">No children linked yet.</p>}
            </div>
          </div>

          {/* By Term */}
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
                      <div className="flex items-center justify-end gap-3 mt-1.5">
                        <button 
                          onClick={() => setReceiptPayment(payment)} 
                          className="text-xs text-blue-600 font-bold flex items-center gap-1 hover:underline"
                        >
                          <ReceiptIcon className="w-3 h-3" /> Receipt
                        </button>
                        <button 
                          onClick={() => setVoidingPayment({ id: payment.id, amount: payment.amount })} 
                          className="text-xs text-red-500 font-bold hover:underline"
                        >
                          Void
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {family.payments.length === 0 && <p className="text-sm text-slate-500">No payments recorded yet.</p>}
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4">
        <div className="max-w-lg mx-auto">
          <Link href={`/admin/fees/family/${family.id}/record-payment`} className="block w-full bg-blue-600 text-white text-center font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition-colors">
            Record Payment
          </Link>
        </div>
      </div>

      {/* RECEIPT MODAL */}
      {receiptPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 flex items-center justify-center p-4 print:bg-white print:p-0 overflow-y-auto">
          <div className="w-full max-w-md my-8">
            
            <div className="print:hidden flex justify-between items-center mb-4">
              <h2 className="text-white font-bold text-lg">Receipt Preview</h2>
              <button onClick={() => { setReceiptPayment(null); setShowShareMenu(false); }} className="p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <Receipt 
              ref={receiptRef}
              school={school}
              family={family}
              payment={receiptPayment}
              amountInWords={amountToWords(Math.abs(receiptPayment.amount))}
              balance={family.currentBalance}
            />

            <div className="print:hidden mt-4">
              {showShareMenu ? (
                <div className="bg-slate-800 p-4 rounded-xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                  <p className="text-white text-sm text-center font-medium">How do you want to share this?</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleShare('image')} disabled={isGenerating} className="flex-1 bg-slate-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-600 disabled:opacity-50">
                      <FileImage className="w-4 h-4" /> Image
                    </button>
                    <button onClick={() => handleShare('pdf')} disabled={isGenerating} className="flex-1 bg-slate-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-600 disabled:opacity-50">
                      <FileText className="w-4 h-4" /> PDF
                    </button>
                  </div>
                  <button onClick={() => setShowShareMenu(false)} className="text-xs text-slate-300 mt-1 hover:text-white">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setShowShareMenu(true)} disabled={isGenerating} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50">
                    <Share2 className="w-4 h-4" /> Share
                  </button>
                  <button onClick={downloadImage} disabled={isGenerating} className="flex-1 bg-slate-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-900 disabled:opacity-50">
                    <Download className="w-4 h-4" /> Image
                  </button>
                  <button onClick={downloadPdf} disabled={isGenerating} className="flex-1 bg-slate-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-900 disabled:opacity-50">
                    <Download className="w-4 h-4" /> PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditing && (
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
                <input type="tel" value={editPhone || ""} onChange={(e) => setEditPhone(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsEditing(false)} className="flex-1 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl">Cancel</button>
              <button onClick={handleSaveEdit} disabled={isSavingEdit} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl disabled:opacity-50">
                {isSavingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOID MODAL */}
      {voidingPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 print:hidden">
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

      {/* MERGE MODAL */}
      {isMerging && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black text-slate-900">Merge Family</h2>
              <button onClick={() => setIsMerging(false)} className="p-2 bg-slate-100 rounded-full text-slate-500"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Merge this family into another. All charges, payments, and children will be moved to the target family. This family will be hidden.
            </p>
            
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Merge Into (Target Family)</label>
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
              <button onClick={() => setIsMerging(false)} className="flex-1 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl">Cancel</button>
              <button 
                onClick={() => setShowMergeConfirm(true)} 
                disabled={!mergeTargetId}
                className="flex-1 bg-purple-600 text-white font-bold py-3 rounded-xl disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM DIALOG */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete this family?"
        description="This will hide the family from the dashboard. It will not delete any historical financial records. You can restore them later if needed."
        confirmLabel="Delete Family"
        destructive={true}
        loading={isDeleting}
        onConfirm={handleDelete}
      />

      {/* MERGE CONFIRM DIALOG */}
      <ConfirmDialog
        open={showMergeConfirm}
        onOpenChange={setShowMergeConfirm}
        title="Confirm Merge"
        description="Are you sure? This will move all financial history to the target family and soft-delete this family. This action cannot be undone easily."
        confirmLabel="Yes, Merge Families"
        destructive={true}
        loading={isMergingSubmit}
        onConfirm={handleMergeSubmit}
      />
    </div>
  );
}