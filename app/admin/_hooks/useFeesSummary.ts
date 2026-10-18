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
    // 1. If not owner or no term, hide the card immediately
    if (!isOwner || !currentTerm?.id) {
      setFeeSummary(null);
      setLoading(false);
      return;
    }

    const fetchSummary = async () => {
      try {
        // 2. Fetch expected charges for the current term
        const { data: charges } = await supabase
          .from("charges")
          .select("amount")
          .eq("term_id", currentTerm.id);

        // 3. Fetch all payments (since FIFO applies them to oldest debts)
        const { data: payments } = await supabase
          .from("payments")
          .select("amount");

        // 4. Fetch families to count debtors
        const { data: families } = await supabase
          .from("families")
          .select(`id, charges(amount), payments(amount)`);

        let debtors = 0;
        if (families) {
          families.forEach((f) => {
            const fCharges = f.charges.reduce((s: number, c: any) => s + Number(c.amount), 0);
            const fPayments = f.payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
            if (fCharges - fPayments > 0) debtors++;
          });
        }

        const expected = (charges || []).reduce((sum, c) => sum + Number(c.amount), 0);
        const collected = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);

        setFeeSummary({
          termLabel: currentTerm.name, // <-- Fixed to match FeeSummary
          collected: Math.max(0, collected),
          expected: Math.max(0, expected),
          outstandingStudents: debtors, // <-- Fixed to match FeeSummary
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