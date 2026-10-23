"use client";

import { useState, useRef, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type HeaderGroup,
  type Header,
  type Row,
  type Cell,
} from "@tanstack/react-table";
import { toast } from "sonner";
import { feesRepository } from "@/lib/feesRepository";
import { Loader2, Pencil, GitMerge } from "lucide-react";

export type BulkGridRow = {
  familyId: string;
  familyName: string;
  guardianName: string;
  guardianPhone: string;
  children: string;
  broughtForward: number;
  termFee: number;
  amountPaid: number;
  amountOwed: number;
  status: string;
  latestPaymentId?: string;
  latestPaymentNote?: string;
};

function EditableCell({
  initialValue,
  rowId,
  columnId,
  onSave,
}: {
  initialValue: string;
  rowId: string;
  columnId: string;
  onSave: (rowId: string, columnId: string, value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initialValue || "");
  const [isSaving, setIsSaving] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setValue(initialValue || "");
  }, [initialValue]);

  const handleBlur = () => {
    if (value === initialValue) return; 
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setIsSaving(true);
    timeoutRef.current = setTimeout(async () => {
      await onSave(rowId, columnId, value);
      setIsSaving(false);
    }, 800);
  };

  return (
    <div className="relative group flex items-center min-w-[120px]">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        className="w-full bg-transparent px-2 py-1 border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white rounded outline-none transition-colors"
      />
      {isSaving && <Loader2 className="w-3 h-3 text-blue-500 animate-spin absolute right-2" />}
    </div>
  );
}

export function BulkFeesGrid({
  data,
  refetch,
  onEdit,
  onMerge,
}: {
  data: BulkGridRow[];
  refetch: () => Promise<void>;
  onEdit: (row: BulkGridRow) => void;
  onMerge: (row: BulkGridRow) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [isGlobalSaving, setIsGlobalSaving] = useState(false);

  const handleSaveCell = async (rowId: string, columnId: string, value: string) => {
    setIsGlobalSaving(true);
    let res;

    if (columnId === "guardianPhone") {
      const row = data.find((r) => r.familyId === rowId);
      if (!row) return;

      res = await feesRepository.updateFamilyDetails(rowId, {
        name: row.familyName,
        guardianName: row.guardianName,
        guardianPhone: value,
      });
    } else if (columnId === "latestPaymentNote") {
      const row = data.find((r) => r.familyId === rowId);
      if (!row?.latestPaymentId) {
        toast.error("No recent payment found to attach a note to.");
        setIsGlobalSaving(false);
        return;
      }
      res = await feesRepository.updatePaymentNote(row.latestPaymentId, value);
    }

    if (res?.success) {
      toast.success("Saved successfully", { id: "grid-save" });
      await refetch(); 
    } else {
      toast.error(res?.error || "Failed to save. Reverting...");
      await refetch(); 
    }
    setIsGlobalSaving(false);
  };

  const columns: ColumnDef<BulkGridRow, any>[] = [
    {
      accessorKey: "familyName",
      header: "Family Name",
      cell: (info) => <span className="font-bold text-slate-900">{info.getValue() as string}</span>,
    },
    {
      accessorKey: "children",
      header: "Pupils / Children",
      cell: (info) => <span className="text-sm text-slate-600">{info.getValue() as string}</span>,
    },
    {
      accessorKey: "broughtForward",
      header: "Brought Fwd",
      cell: (info) => {
        const val = info.getValue() as number;
        if (val === 0) return <span className="text-slate-400">—</span>;
        return <span className="font-medium text-orange-600">₦{val.toLocaleString()}</span>;
      },
    },
    {
      accessorKey: "termFee",
      header: "Term Fee",
      cell: (info) => <span className="font-medium text-slate-700">₦{(info.getValue() as number).toLocaleString()}</span>,
    },
    {
      accessorKey: "amountPaid",
      header: "Amount Paid",
      cell: (info) => <span className="font-medium text-green-600">₦{(info.getValue() as number).toLocaleString()}</span>,
    },
    {
      accessorKey: "amountOwed",
      header: "Amount Owed",
      cell: (info) => {
        const val = info.getValue() as number;
        return <span className={`font-bold ${val > 0 ? "text-red-500" : "text-green-600"}`}>₦{val.toLocaleString()}</span>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: (info) => {
        const status = info.getValue() as string;
        let color = "bg-slate-100 text-slate-700";
        if (status === "Fully Paid") color = "bg-green-100 text-green-700";
        if (status === "Part Payment") color = "bg-orange-100 text-orange-700";
        if (status === "Not Paid") color = "bg-red-100 text-red-700";
        return <span className={`px-2 py-1 rounded-md text-xs font-bold ${color}`}>{status}</span>;
      },
    },
    {
      accessorKey: "guardianPhone",
      header: "Guardian Phone",
      cell: (info) => (
        <EditableCell
          initialValue={info.getValue() as string}
          rowId={info.row.original.familyId}
          columnId="guardianPhone"
          onSave={handleSaveCell}
        />
      ),
    },
    {
      accessorKey: "latestPaymentNote",
      header: "Remarks",
      cell: (info) => (
        <EditableCell
          initialValue={info.getValue() as string}
          rowId={info.row.original.familyId}
          columnId="latestPaymentNote"
          onSave={handleSaveCell}
        />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: (info) => {
        const row = info.row.original;
        return (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onEdit(row)}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
              title="Edit Family"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onMerge(row)}
              className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded"
              title="Merge Family"
            >
              <GitMerge className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
      
      {isGlobalSaving && (
        <div className="absolute top-2 right-4 flex items-center gap-2 text-xs font-bold text-blue-600 bg-white/80 px-2 py-1 rounded">
          <Loader2 className="w-3 h-3 animate-spin" /> Saving...
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
            {table.getHeaderGroups().map((headerGroup: HeaderGroup<BulkGridRow>) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header: Header<BulkGridRow, unknown>) => (
                  <th 
                    key={header.id} 
                    className="px-4 py-3 cursor-pointer hover:bg-slate-100"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{
                      asc: " 🔼",
                      desc: " 🔽",
                    }[header.column.getIsSorted() as string] ?? null}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.map((row: Row<BulkGridRow>) => (
              <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                {row.getVisibleCells().map((cell: Cell<BulkGridRow, unknown>) => (
                  <td key={cell.id} className="px-4 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500">
                  No families found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}