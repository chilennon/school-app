"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useParams } from "next/navigation";
import { recordPayment } from "../../../actions";
import { ChevronLeft, CheckCircle2, Download, Printer, Share2, FileImage, FileText } from "lucide-react";
import { calculateFamilyBalances } from "@/lib/fees";
import { useSchoolConfig } from "@/hooks/useSchoolConfig";
import { amountToWords } from "@/lib/utils/amountToWords";
import { Receipt } from "../../../_components/Receipt";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { toast } from "sonner";

export default function RecordPayment() {
  const router = useRouter();
  const params = useParams();
  const { config: school } = useSchoolConfig();
  const receiptRef = useRef<HTMLDivElement>(null);

  const [family, setFamily] = useState<any>(null);
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<"cash" | "transfer" | "pos">("transfer");
  const [reference, setReference] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  const [success, setSuccess] = useState<{
    receiptNo: string;
    amount: number;
    paymentObj: any;
    newBalance: number;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    supabase.from("families")
      .select("name, guardian_name, guardian_phone, charges(amount, created_at), payments(amount, created_at)")
      .eq("id", params.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const calc = calculateFamilyBalances(data.charges as any, data.payments as any);
          setFamily({ 
            name: data.name, 
            guardian_name: data.guardian_name,
            guardian_phone: data.guardian_phone,
            balance: calc.currentBalance 
          });
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
        const paymentObj = {
          receipt_no: res.receiptNo,
          amount: Number(amount),
          method: method,
          reference: reference,
          paid_on: new Date().toISOString(),
          note: "School Fees",
        };
        
        const newBalance = Math.max(0, (family.balance || 0) - Number(amount));
        
        setSuccess({ 
          receiptNo: res.receiptNo, 
          amount: Number(amount),
          paymentObj,
          newBalance
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save payment");
    } finally {
      setIsSaving(false);
    }
  };

  const downloadPdf = async () => {
    if (!receiptRef.current) return;
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(receiptRef.current, { scale: 2, backgroundColor: "#f8f6f0", useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`Receipt-${success?.receiptNo}.pdf`);
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
      link.download = `Receipt-${success?.receiptNo}.png`;
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
        file = new File([blob], `Receipt-${success?.receiptNo}.png`, { type: "image/png" });
      } else {
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width, canvas.height] });
        pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
        const pdfBlob = pdf.output('blob');
        file = new File([pdfBlob], `Receipt-${success?.receiptNo}.pdf`, { type: "application/pdf" });
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

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 py-12 print:hidden">
        <div className="flex flex-col items-center w-full mb-6">
          <CheckCircle2 className="w-16 h-16 text-green-500 mb-2" />
          <h1 className="text-2xl font-black text-slate-900">Payment Saved!</h1>
        </div>

        <Receipt 
          ref={receiptRef}
          school={school}
          family={family}
          payment={success.paymentObj}
          amountInWords={amountToWords(success.amount)}
          balance={success.newBalance}
        />

        <div className="w-full max-w-[500px] mt-6">
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
            <div className="grid grid-cols-2 gap-3">
              <button onClick={downloadImage} disabled={isGenerating} className="bg-slate-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-900 disabled:opacity-50">
                <Download className="w-4 h-4" /> Image
              </button>
              <button onClick={downloadPdf} disabled={isGenerating} className="bg-slate-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-900 disabled:opacity-50">
                <Download className="w-4 h-4" /> PDF
              </button>
              
              <button onClick={() => setShowShareMenu(true)} disabled={isGenerating} className="col-span-2 bg-blue-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50">
                <Share2 className="w-4 h-4" /> Share Receipt
              </button>
              
              <button onClick={() => window.print()} className="col-span-2 bg-slate-200 text-slate-800 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-300">
                <Printer className="w-4 h-4" /> Print Directly
              </button>
              <button onClick={() => router.push(`/admin/fees/family/${params.id}`)} className="col-span-2 text-blue-600 font-bold py-2 text-sm hover:underline mt-2">
                Back to Family
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-24">
      <div className="p-4 bg-white border-b border-slate-100">
        <button onClick={() => router.push(`/admin/fees/family/${params.id}`)} className="text-blue-600 font-bold mb-4 flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Cancel
        </button>
        <h1 className="text-2xl font-black text-slate-900 mb-1">Record payment</h1>
        <p className="text-slate-500 text-sm font-medium">{family?.name} · owes ₦{family?.balance?.toLocaleString()}</p>
      </div>

      <div className="p-4 flex-1 space-y-5">
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

        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm flex justify-between shadow-sm">
          <span className="text-slate-500 font-medium">Date</span>
          <span className="font-bold text-slate-900">Today, {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        </div>

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