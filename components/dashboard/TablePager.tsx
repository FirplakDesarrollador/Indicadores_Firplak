import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/dashboard/format";

export default function TablePager({ shown, total, page, totalPages, loading, noun, onPageChange }: {
  shown: number;
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  noun: string;
  onPageChange: (page: number) => void;
}) {
  return <div className="billing-table-footer"><span>Mostrando {shown} de {formatNumber(total)} {noun}</span><div><button onClick={() => onPageChange(page - 1)} disabled={loading || page <= 1} aria-label="Página anterior"><ChevronLeft size={15} /></button><strong>{page}</strong><button onClick={() => onPageChange(page + 1)} disabled={loading || page >= totalPages} aria-label="Página siguiente"><ChevronRight size={15} /></button></div></div>;
}
