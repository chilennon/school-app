// lib/utils/amountToWords.ts
import { toWords } from "number-to-words";

export function amountToWords(amount: number): string {
  if (amount === 0) return "Zero Naira Only";
  
  // Convert to words
  const words = toWords(amount);
  
  // Capitalize first letter of each word
  const capitalized = words.replace(/\b\w/g, (l) => l.toUpperCase());
  
  return `${capitalized} Naira Only`;
}