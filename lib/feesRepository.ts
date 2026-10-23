// lib/feesRepository.ts
import { updateFamilyDetails } from "@/app/admin/fees/actions";
import { supabase } from "@/lib/supabaseClient"; // Temporary until we create a Server Action for notes

export const feesRepository = {
  /**
   * Updates non-financial family details (e.g., Guardian Phone).
   */
  updateFamilyDetails: async (
    familyId: string,
    data: { name?: string; guardianName?: string; guardianPhone?: string }
  ) => {
    try {
      // In the future, this will check Dexie outbox first.
      const res = await updateFamilyDetails(familyId, {
        name: data.name || "", // Fallbacks if not provided
        guardianName: data.guardianName || "",
        guardianPhone: data.guardianPhone || "",
      });
      return { success: true, data: res };
    } catch (error: any) {
      console.error("Repository: Failed to update family", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Updates the remark/note on a specific payment.
   * Note: This is currently a direct client call, but should be moved to a Server Action later.
   */
  updatePaymentNote: async (paymentId: string, note: string) => {
    try {
      const { error } = await supabase
        .from("payments")
        .update({ note })
        .eq("id", paymentId);
        
      if (error) throw new Error(error.message);
      return { success: true };
    } catch (error: any) {
      console.error("Repository: Failed to update payment note", error);
      return { success: false, error: error.message };
    }
  },
};