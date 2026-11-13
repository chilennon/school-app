import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentTerm } from "@/hooks/useCurrentTerm";

export function useFeesSummary(isOwner: boolean) {
  const [feeSummary, setFeeSummary] = useState<{
    termLabel: string;
    collected: number;
    expected: number;
    outstandingStudents: number;
  } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const { term: currentTerm } = useCurrentTerm();

  useEffect(() => {
    if (!isOwner || !currentTerm?.id) {
      setFeeSummary(null);
      setLoading(false);
      return;
    }

    const fetchSummary = async () => {
      try {
        const { data: families, error } = await supabase
          .from("families")
          .select(`id, charges(amount, term_id), payments(amount)`)
          .is("deleted_at", null);

        if (error) throw error;

        let totalExpected = 0;
        let totalCollected = 0;
        let debtors = 0;

        if (families) {
          families.forEach((f) => {
            const charges = f.charges || [];
            const payments = f.payments || [];

            // 1. Charges for CURRENT term vs PAST terms
            const currentTermCharges = charges
              .filter((c: any) => c.term_id === currentTerm.id)
              .reduce((s: number, c: any) => s + Number(c.amount), 0);
              
            const pastTermCharges = charges
              .filter((c: any) => c.term_id !== currentTerm.id)
              .reduce((s: number, c: any) => s + Number(c.amount), 0);

            // 2. Total money paid by this family
            const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.amount), 0);

            // 3. FIFO Calculation (Money clears past debt first)
            const paidTowardsPast = Math.min(totalPaid, pastTermCharges);
            const remainingPayment = totalPaid - paidTowardsPast;
            const paidTowardsCurrent = Math.min(remainingPayment, currentTermCharges);

            // 4. Accumulate totals for the dashboard
            totalExpected += currentTermCharges;
            totalCollected += paidTowardsCurrent;

            // 5. Count debtors (anyone who owes anything, past or present)
            const totalBalance = (pastTermCharges + currentTermCharges) - totalPaid;
            if (totalBalance > 0) debtors++;
          });
        }

        setFeeSummary({
          termLabel: currentTerm.name,
          collected: Math.max(0, totalCollected),
          expected: Math.max(0, totalExpected),
          outstandingStudents: debtors,
        });
      } catch (error) {
        console.error("Failed to fetch fee summary", error);
        setFeeSummary(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [isOwner, currentTerm?.id]);

  return { feeSummary, loading };
}