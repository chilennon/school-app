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
    
    if (!config.familyName && (h.includes("family") || h.includes("parent") || h.includes("surname"))) config.familyName = header;
    else if (!config.guardianName && (h.includes("guardian") || h.includes("father") || h.includes("mother"))) config.guardianName = header;
    else if (!config.guardianPhone && (h.includes("phone") || h.includes("tel") || h.includes("contact"))) config.guardianPhone = header;
    else if (!config.children && (h.includes("child") || h.includes("pupil") || h.includes("student"))) config.children = header;
    else if (!config.totalDue && (h.includes("due") || h.includes("owed") || h.includes("total fee"))) config.totalDue = header;
    else if (!config.totalPaid && (h.includes("paid") || h.includes("amount"))) config.totalPaid = header;
  });

  return config;
}

// 2. PHONE CLEANER
export function cleanPhone(phoneStr: string | null | undefined): { primary: string; secondary: string } {
  if (!phoneStr) return { primary: "", secondary: "" };

  const parts = String(phoneStr).split(",").map(s => s.trim());
  
  const clean = (num: string) => {
    let n = num.replace(/[\s\-\(\)]/g, "");
    if (n.includes("E+") || n.includes("e+")) n = Number(n).toFixed(0);
    if (n.startsWith("+234")) n = "0" + n.slice(4);
    else if (n.startsWith("234") && n.length === 13) n = "0" + n.slice(3);
    if (n.length === 10 && /^[789]/.test(n)) n = "0" + n;
    return n;
  };

  return {
    primary: parts[0] ? clean(parts[0]) : "",
    secondary: parts[1] ? clean(parts[1]) : "",
  };
}

// 3. ROW PARSER WITH DUPLICATE DETECTION (Database & Excel-Internal)
export function parseRows(
  rawRows: RawRow[],
  mapping: MappingConfig,
  feeModel: "family" | "per-student",
  existingFamilies: { name: string; phone: string | null; phone2: string | null }[] = []
): ParsedRow[] {
  // 🚨 Track what we've seen in THIS file
  const seenNames = new Set<string>();
  const seenPhones = new Set<string>();

  const parsed = rawRows.map((row, index) => {
    let familyName = "";
    if (feeModel === "per-student" && mapping.children) {
      familyName = String(row[mapping.children] || "").trim();
    } else if (mapping.familyName) {
      familyName = String(row[mapping.familyName] || "").trim();
    }

    const rawPhone = mapping.guardianPhone ? String(row[mapping.guardianPhone] || "") : "";
    const { primary } = cleanPhone(rawPhone);

    let _isDuplicate = false;
    let _duplicateReason = "";

    // 1. Check against the DATABASE
    if (familyName) {
      const nameMatch = existingFamilies.find(
        f => f.name.toLowerCase().trim() === familyName.toLowerCase().trim()
      );
      if (nameMatch) {
        _isDuplicate = true;
        _duplicateReason = "Family name already exists in the system.";
      }
    }

    if (!_isDuplicate && primary) {
      const phoneMatch = existingFamilies.find(
        f => f.phone === primary || f.phone2 === primary
      );
      if (phoneMatch) {
        _isDuplicate = true;
        _duplicateReason = `Phone number belongs to "${phoneMatch.name}" in the system.`;
      }
    }

    // 2. Check against the EXCEL FILE ITSELF
    if (!_isDuplicate && familyName) {
      const lowerName = familyName.toLowerCase().trim();
      if (seenNames.has(lowerName)) {
        _isDuplicate = true;
        _duplicateReason = "Duplicate Family Name in this Excel file.";
      }
      seenNames.add(lowerName);
    }

    if (!_isDuplicate && primary) {
      if (seenPhones.has(primary)) {
        _isDuplicate = true;
        _duplicateReason = "Duplicate Phone Number in this Excel file.";
      }
      seenPhones.add(primary);
    }

    return {
      _rowNumber: index + 2,
      familyName,
      guardianName: mapping.guardianName ? String(row[mapping.guardianName] || "").trim() : "",
      guardianPhone: primary,
      children: mapping.children ? String(row[mapping.children] || "").trim() : "",
      totalDue: Number(mapping.totalDue ? row[mapping.totalDue] : 0) || 0,
      totalPaid: Number(mapping.totalPaid ? row[mapping.totalPaid] : 0) || 0,
      _isDuplicate,
      _duplicateReason,
    };
  });

  // Filter out completely empty "ghost" rows
  return parsed.filter((row) => {
    const hasName = row.familyName.length > 0;
    const hasPhone = row.guardianPhone.length > 0;
    const hasDue = row.totalDue > 0;
    const hasPaid = row.totalPaid > 0;
    const hasChildren = row.children.length > 0;

    return hasName || hasPhone || hasDue || hasPaid || hasChildren;
  });
}