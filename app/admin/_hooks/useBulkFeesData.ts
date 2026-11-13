import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { BulkGridRow } from "../_components/BulkFeesGrid";

export function useBulkFeesData(currentTermId?: string) {
  const [data, setData] = useState<BulkGridRow[]>([]);
  const [loading, setLoading] = useState(true);
  const isFetching = useRef(false);

  const fetchData = useCallback(async () => {
    if (!currentTermId) {
      setLoading(false);
      return;
    }
    
    if (isFetching.current) return;
    isFetching.current = true;
    setLoading(true);
    
    try {
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

      if (error) throw error;

      if (families) {
        const processed = families.map((family) => {
          const childrenNames = family.students
            ?.map((s: any) => `${s.name} (${s.classes?.name || 'No Class'})`)
            .join(", ") || "";

          // --- MANUAL FIFO CALCULATION (Bulletproof) ---
          const allCharges = family.charges || [];
          const allPayments = family.payments || [];

          // 1. Total billed for THIS term
          const termCharges = allCharges.filter((c: any) => c.term_id === currentTermId);
          const termFee = termCharges.reduce((sum: number, c: any) => sum + Number(c.amount), 0);

          // 2. Total billed for PREVIOUS terms
          const pastCharges = allCharges.filter((c: any) => c.term_id !== currentTermId);
          const pastTotalFee = pastCharges.reduce((sum: number, c: any) => sum + Number(c.amount), 0);

          // 3. Total money paid by this family EVER
          const allTimePayments = allPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

          // 4. FIFO Logic: Payments clear old debt first
          const paidTowardsPast = Math.min(allTimePayments, pastTotalFee);
          const broughtForward = Math.max(0, pastTotalFee - paidTowardsPast); // Old debt remaining

          // 5. Any money left over goes to the current term
          const remainingPayment = Math.max(0, allTimePayments - pastTotalFee);
          const amountPaidThisTerm = Math.min(remainingPayment, termFee);

          // 6. What is left to pay for this term?
          const currentTermBalance = termFee - amountPaidThisTerm;
          const totalBalanceOwed = broughtForward + currentTermBalance;

          const sortedPayments = [...allPayments].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          const latestPayment = sortedPayments[0];

          // Determine Status
          let status = "Not Paid";
          if (termFee === 0 && broughtForward > 0) {
             status = "Not Paid"; // Owes old debt, nothing billed yet
          } else if (termFee > 0 && currentTermBalance <= 0) {
             status = "Fully Paid";
          } else if (amountPaidThisTerm > 0) {
             status = "Part Payment";
          }

          return {
            familyId: family.id,
            familyName: family.name,
            guardianName: family.guardian_name,
            guardianPhone: family.guardian_phone,
            children: childrenNames,
            broughtForward: broughtForward,
            termFee: termFee,
            amountPaid: amountPaidThisTerm, // 🚨 NOW IT ONLY SHOWS MONEY FOR THIS TERM
            totalPaidOverall: allTimePayments, 
            amountOwed: totalBalanceOwed,
            status: status,
            latestPaymentId: latestPayment?.id,
            latestPaymentNote: latestPayment?.note || "",
          };
        }); // 🚨 FIXED: Closed the .map() function properly here

        setData(processed);
      }
    } catch (err) {
      console.error("Failed to fetch bulk fees data:", err);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [currentTermId]);

  useEffect(() => {
    fetchData();

    if (!currentTermId) return;

    const channel = supabase.channel("bulk_fees_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "charges" }, fetchData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData, currentTermId]);

  return { data, loading, refetch: fetchData };
}