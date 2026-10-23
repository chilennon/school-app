"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { addFamily } from "../actions";
import { ChevronLeft, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentTerm } from "@/hooks/useCurrentTerm"; 

export default function AddFamilyPage() {
  const router = useRouter();
  const { term } = useCurrentTerm(); 

  const [isSaving, setIsSaving] = useState(false);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);

  // Form State
  const [familyName, setFamilyName] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [initialCharge, setInitialCharge] = useState("");
  
  // Dynamic list of children
  const [students, setStudents] = useState([
    { name: "", classId: "", regNo: "" }
  ]);

  // Fetch classes for the dropdown
  useEffect(() => {
    supabase
      .from("classes")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) setClasses(data);
      });
  }, []); 

  const handleAddStudent = () => {
    setStudents([...students, { name: "", classId: "", regNo: "" }]);
  };

  const handleRemoveStudent = (index: number) => {
    if (students.length === 1) return; 
    setStudents(students.filter((_, i) => i !== index));
  };

  const updateStudent = (index: number, field: string, value: string) => {
    const updated = [...students];
    updated[index] = { ...updated[index], [field]: value };
    setStudents(updated);
  };

  const handleSubmit = async () => {
    if (!familyName || !guardianName || !guardianPhone) {
      toast.error("Please fill in the family and guardian details.");
      return;
    }
    if (students.some(s => !s.name || !s.classId || !s.regNo)) {
      toast.error("Please fill in all student details (Name, Reg No, Class).");
      return;
    }
    if (!term?.id) {
      toast.error("No active term found. Please ensure a term is set.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await addFamily({
        name: familyName,
        guardianName,
        guardianPhone,
        initialCharge: Number(initialCharge) || 0,
        termId: term.id,
        students: students.map(s => ({
          name: s.name,
          classId: s.classId,
          regNo: s.regNo,
        })),
      });

      if (res.success) {
        toast.success("Family added successfully!");
        router.push(`/admin/fees/family/${res.familyId}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to add family");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      
      <div className="max-w-lg mx-auto">
        
        {/* Sticky Header */}
        <div className="bg-white px-4 py-4 sticky top-0 z-10 border-b border-slate-100">
          <button 
            onClick={() => router.push("/admin?tab=fees")} 
            className="text-blue-600 text-sm font-bold mb-2 flex items-center gap-1 hover:underline"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Fees
          </button>
          <h1 className="text-2xl font-black text-slate-900">Add Family</h1>
        </div>

        <div className="p-4 space-y-5">
          
          {/* Family Details Section */}
          <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
            <h2 className="font-bold text-slate-900 border-b border-slate-50 pb-2">Family Details</h2>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Family Name</label>
              <input
                type="text"
                placeholder="e.g. Adeyemi Family"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Guardian Name</label>
              <input
                type="text"
                placeholder="e.g. Mr. Tunde Adeyemi"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Guardian Phone</label>
              <input
                type="tel"
                placeholder="e.g. 0803 123 4567"
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
              />
            </div>
          </section>

          {/* Children Section */}
          <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-50 pb-2">
              <h2 className="font-bold text-slate-900">Children</h2>
              <button onClick={handleAddStudent} className="text-blue-600 text-sm font-bold flex items-center gap-1 hover:underline">
                <Plus className="w-4 h-4" /> Add Child
              </button>
            </div>

            <div className="space-y-4">
              {students.map((student, index) => (
                <div key={index} className="relative space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  {students.length > 1 && (
                    <button 
                      onClick={() => handleRemoveStudent(index)}
                      className="absolute top-2 right-2 p-1.5 text-red-400 hover:text-red-600 bg-white rounded-md shadow-sm border border-slate-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Student Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Tobi Adeyemi"
                      value={student.name}
                      onChange={(e) => updateStudent(index, "name", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Reg No.</label>
                      <input
                        type="text"
                        placeholder="e.g. BP/24/01"
                        value={student.regNo}
                        onChange={(e) => updateStudent(index, "regNo", e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Class</label>
                      <select
                        value={student.classId}
                        onChange={(e) => updateStudent(index, "classId", e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-blue-500"
                      >
                        <option value="">Select</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Initial Charge Section */}
          <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
            <h2 className="font-bold text-slate-900 border-b border-slate-50 pb-2">Initial Bill</h2>
            <p className="text-xs text-slate-500 -mt-2">This will be logged as a charge for the current term.</p>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Fee Due (₦)</label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-slate-400 font-bold">₦</span>
                <input
                  type="number"
                  placeholder="0"
                  value={initialCharge}
                  onChange={(e) => setInitialCharge(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-4 py-3 text-lg font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 z-20">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {isSaving ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</> : "Save Family"}
          </button>
        </div>
      </div>
    </div>
  );
}