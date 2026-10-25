// lib/utils/phone.ts

/**
 * Normalizes a Nigerian phone number to a standard 13-character string starting with 234.
 * Logic perfectly mirrors the SQL backfill regex.
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";

  // 1. Strip all non-numeric characters
  const digits = phone.replace(/\D/g, "");

  if (!digits) return "";

  // 2. Match SQL logic:
  // Regex: ^0\d{10}$ -> '234' || SUBSTRING(digits FROM 2)
  if (/^0\d{10}$/.test(digits)) {
    return "234" + digits.substring(1);
  }

  // Regex: ^[789]\d{9}$ -> '234' || digits
  if (/^[789]\d{9}$/.test(digits)) {
    return "234" + digits;
  }

  // Regex: ^234\d{10}$ -> digits (already normalized)
  if (/^234\d{10}$/.test(digits)) {
    return digits;
  }

  // Fallback for unknown formats
  return digits;
}