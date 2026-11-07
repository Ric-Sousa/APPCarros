import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { openProtectedUrl, handleApiError } from "@/lib/apiUtils";
import { categoryInfo } from "@/lib/expenses";
import { formatDate, formatEuro, formatNumber } from "@/lib/utils";
import type { ExpenseRecord } from "@shared/schema";

export default function ExpenseListItem({ expense }: { expense: ExpenseRecord }) {
  const { toast } = useToast();
  const cat = categoryInfo(expense);

  const openReceipt = () =>
    openProtectedUrl(expense.receiptUrl!).catch((error) =>
      toast({ title: "Não foi possível abrir o recibo", description: handleApiError(error), variant: "destructive" }),
    );

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <Badge className={cat.color}>{cat.icon} {cat.label}</Badge>
        <span className="text-sm text-muted-foreground">{formatDate(expense.date)}</span>
      </div>
      {expense.description && <h3 className="font-medium text-lg break-words">{expense.description}</h3>}
      {expense.vendor && <p className="text-sm text-muted-foreground mt-1">Fornecedor: {expense.vendor}</p>}
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div><span className="text-muted-foreground">Valor:</span> <span className="font-medium">{formatEuro(expense.amount)}</span></div>
        {!!expense.mileage && <div><span className="text-muted-foreground">Km:</span> <span className="font-medium">{formatNumber(expense.mileage)}</span></div>}
        {expense.receiptUrl && (
          <div>
            <span className="text-muted-foreground">Recibo:</span>{" "}
            <button type="button" className="font-medium text-primary hover:underline" onClick={openReceipt}>Ver</button>
          </div>
        )}
      </div>
    </div>
  );
}
