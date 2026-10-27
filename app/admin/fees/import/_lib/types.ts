export type FeeModel = "family" | "per-student";

// The raw, unparsed row from Excel
export type RawRow = Record<string, any>;

// The configuration for how columns map to our DB
export type MappingConfig = {
  familyName: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  children: string | null;
  totalDue: string | null;
  totalPaid: string | null;
};

// The row after mapping and cleaning, ready for validation
export type ParsedRow = {
  _rowNumber: number;
  familyName: string;
  guardianName: string;
  guardianPhone: string;
  children: string;
  totalDue: number;
  totalPaid: number;
};

// The row after validation (with inline edits applied)
export type ValidatedRow = ParsedRow & {
  _isValid: boolean;
  _errors: string[];
};