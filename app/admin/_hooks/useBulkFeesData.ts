// app/admin/_hooks/useBulkFeesData.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { calculateFamilyBalances } from "@/lib/fees";
import type { BulkGridRow } from "../_components/BulkFeesGrid";

export function useBulkFeesData(currentTermId?: string) {
  const [data, setData] = useState<BulkGridRow[]>([]);
  const [loading, setLoading] = useState(true);
  const isFetching = useRef(false); // <-- Add a lock

  const fetchData = useCallback(async () => {
    // 1. Guard: Don't fetch if term isn't loaded yet
    if (!currentTermId) return; 
    
    // 2. Lock: Prevent double firing
    if (isFetching.current) return;
    isFetching.current = true;

    setLoading(true);
    const { data: families, error } = await supabase
      .from("families")
      .select(`
        *,
        students(name, classes(name)),
        charges(id, amount, description, term_id, created_at, terms(name, sequence)),
        payments(id, amount, method, reference, receipt_no, paid_on, note, created_at)
      `)
      .is("deleted_at", null)
      .order("name");

    if (error) {
      console.error("Failed to fetch bulk fees data", error);
      setLoading(false);
      isFetching.current = false;
      return;
    }

    if (families) {
      const processed = families.map((family) => {
        const calc = calculateFamilyBalances(family.charges || [], family.payments || []);
        
        let broughtForward = 0;
        let termFee = 0;

        calc.breakdown.forEach((charge: any) => {
          if (charge.term_id === currentTermId) {
            termFee += charge.amount; 
          } else {
            broughtForward += charge.remaining; 
          }
        });

        const sortedPayments = [...(family.payments || [])].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const latestPayment = sortedPayments[0];

        const childrenNames = family.students
          ?.map((s: any) => `${s.name} (${s.classes?.name || 'No Class'})`)
          .join(", ") || "";

        let status = "Not Paid";
        if (calc.currentBalance <= 0) status = "Fully Paid";
        else if (calc.totalPaid > 0) status = "Part Payment";

        return {
          familyId: family.id,
          familyName: family.name,
          guardianName: family.guardian_name,
          guardianPhone: family.guardian_phone,
          children: childrenNames,
          broughtForward: broughtForward,
          termFee: termFee,
          amountPaid: calc.totalPaid,
          amountOwed: calc.currentBalance,
          status: status,
          latestPaymentId: latestPayment?.id,
          latestPaymentNote: latestPayment?.note || "",
        };
      });

      setData(processed);
    }
    setLoading(false);
    isFetching.current = false;
  }, [currentTermId]);

  useEffect(() => {
    fetchData();

    // Only subscribe if we have a term loaded
    if (!currentTermId) return;

    const channel = supabase.channel("bulk_fees_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "charges" }, fetchData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData, currentTermId]);

  return { data, loading, refetch: fetchData };
}