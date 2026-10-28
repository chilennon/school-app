import * as XLSX from "xlsx";
import { MappingConfig, ParsedRow, RawRow } from "./types";

// 1. THE SMART HEURISTIC
export function autoMapHeaders(headers: string[]): MappingConfig {
  const config: MappingConfig = {
    familyName: null,
    guardianName: null,
    guardianPhone: null,
    children: null,
    totalDue: null,
    totalPaid: null,
  };

  headers.forEach((header) => {
    const h = header.toLowerCase();
    
    // Family Name checks
    if (!config.familyName && (h.includes("family") || h.includes("parent") || h.includes("surname"))) {
      config.familyName = header;
    }
    // Guardian checks
    else if (!config.guardianName && (h.includes("guardian") || h.includes("father") || h.includes("mother"))) {
      config.guardianName = header;
    }
    // Phone checks
    else if (!config.guardianPhone && (h.includes("phone") || h.includes("tel") || h.includes("contact"))) {
      config.guardianPhone = header;
    }
    // Children checks
    else if (!config.children && (h.includes("child") || h.includes("pupil") || h.includes("student"))) {
      config.children = header;
    }
    // Due checks
    else if (!config.totalDue && (h.includes("due") || h.includes("owed") || h.includes("total fee"))) {
      config.totalDue = header;
    }
    // Paid checks
    else if (!config.totalPaid && (h.includes("paid") || h.includes("amount"))) {
      config.totalPaid = header;
    }
  });

  return config;
}

// 2. PHONE CLEANER (Fixes Excel issues & splits multiple numbers)
export function cleanPhone(phoneStr: string | null | undefined): { primary: string; secondary: string } {
  if (!phoneStr) return { primary: "", secondary: "" };

  // Split by comma if they put two numbers in one cell
  const parts = String(phoneStr).split(",").map(s => s.trim());
  
  const clean = (num: string) => {
    // Remove spaces, dashes, brackets
    let n = num.replace(/[\s\-\(\)]/g, "");
    
    // Handle scientific notation (e.g., 8.03123E+10)
    if (n.includes("E+") || n.includes("e+")) {
      n = Number(n).toFixed(0);
    }
    
    // Convert +234 or 234 to local 0 format
    if (n.startsWith("+234")) n = "0" + n.slice(4);
    else if (n.startsWith("234") && n.length === 13) n = "0" + n.slice(3);
    
    // Add missing zero if it's 10 digits starting with 7, 8, or 9
    if (n.length === 10 && /^[789]/.test(n)) {
      n = "0" + n;
    }
    return n;
  };

  return {
    primary: parts[0] ? clean(parts[0]) : "",
    secondary: parts[1] ? clean(parts[1]) : "",
  };
}

// 3. ROW PARSER
// 3. ROW PARSER
export function parseRows(
  rawRows: RawRow[],
  mapping: MappingConfig,
  feeModel: "family" | "per-student"
): ParsedRow[] {
  const parsed = rawRows.map((row, index) => {
    // If we are per-student, we use the "children" column as the family name.
    // Otherwise, we use the "familyName" column.
    let familyName = "";
    if (feeModel === "per-student" && mapping.children) {
      familyName = String(row[mapping.children] || "").trim();
    } else if (mapping.familyName) {
      familyName = String(row[mapping.familyName] || "").trim();
    }

    const rawPhone = mapping.guardianPhone ? String(row[mapping.guardianPhone] || "") : "";
    const { primary } = cleanPhone(rawPhone); // We will use primary for now

    return {
      _rowNumber: index + 2, // Assuming header is row 1
      familyName,
      guardianName: mapping.guardianName ? String(row[mapping.guardianName] || "").trim() : "",
      guardianPhone: primary,
      children: mapping.children ? String(row[mapping.children] || "").trim() : "",
      totalDue: Number(mapping.totalDue ? row[mapping.totalDue] : 0) || 0,
      totalPaid: Number(mapping.totalPaid ? row[mapping.totalPaid] : 0) || 0,
    };
  });

  // 🚨 THE FIX: Filter out completely empty "ghost" rows
  return parsed.filter((row) => {
    const hasName = row.familyName.length > 0;
    const hasPhone = row.guardianPhone.length > 0;
    const hasDue = row.totalDue > 0;
    const hasPaid = row.totalPaid > 0;
    const hasChildren = row.children.length > 0;

    // Keep the row ONLY if it has at least one piece of real data
    return hasName || hasPhone || hasDue || hasPaid || hasChildren;
  });
}