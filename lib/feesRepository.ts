// lib/feesRepository.ts
import { 
  updateFamilyDetails, 
  updatePaymentNote 
} from "@/app/admin/fees/actions";

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
   * Moved to a Server Action to ensure logAudit() is always called.
   */
  updatePaymentNote: async (paymentId: string, note: string) => {
    try {
      const res = await updatePaymentNote(paymentId, note);
      return { success: true, data: res };
    } catch (error: any) {
      console.error("Repository: Failed to update payment note", error);
      return { success: false, error: error.message };
    }
  },
};