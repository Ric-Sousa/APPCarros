import { Badge } from "@/components/ui/badge";
import { openProtectedUrl } from "@/lib/apiUtils";
import type { ExpenseRecord } from "@shared/schema";

export const expenseCategories = {
  fuel: { label: "Combustível", color: "bg-blue-100 text-blue-800", icon: "⛽" },
  maintenance: { label: "Manutenção", color: "bg-green-100 text-green-800", icon: "🔧" },
  repair: { label: "Reparação", color: "bg-red-100 text-red-800", icon: "🛠️" },
  insurance: { label: "Seguro", color: "bg-purple-100 text-purple-800", icon: "🛡️" },
  tax: { label: "Imposto", color: "bg-yellow-100 text-yellow-800", icon: "📋" },
  inspection: { label: "Inspeção", color: "bg-orange-100 text-orange-800", icon: "✅" },
  parts: { label: "Peças", color: "bg-indigo-100 text-indigo-800", icon: "⚙️" },
  service: { label: "Serviço", color: "bg-teal-100 text-teal-800", icon: "🏪" },
  other: { label: "Outros", color: "bg-gray-100 text-gray-800", icon: "📝" },
};

export default function ExpenseListItem({ expense }: { expense: ExpenseRecord }) {
  const categoryInfo = expenseCategories[expense.type as keyof typeof expenseCategories];
  const categoryName = categoryInfo?.label || expense.type;
  const categoryIcon = categoryInfo?.icon || "📝";
  const categoryColor = categoryInfo?.color || "bg-gray-100 text-gray-800";

  return (
      <div className="border rounded-lg p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <Badge className={categoryColor}>
                {categoryIcon} {categoryName}
              </Badge>
              <span className="text-sm text-gray-500">
                {new Date(expense.date).toLocaleDateString('pt-PT')}
              </span>
            </div>
            <h3 className="font-medium text-lg">{expense.description}</h3>
            {expense.vendor && (
              <p className="text-sm text-gray-600 mt-1">
                Fornecedor: {expense.vendor}
              </p>
            )}
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Valor:</span>
                <span className="ml-1 font-medium">€{Number(expense.amount).toFixed(2)}</span>
              </div>
              {expense.mileage && (
                <div>
                  <span className="text-gray-500">KM:</span>
                  <span className="ml-1 font-medium">{expense.mileage.toLocaleString()}</span>
                </div>
              )}
              {expense.category && (
                <div>
                  <span className="text-gray-500">Categoria:</span>
                  <span className="ml-1 font-medium">{expenseCategories[expense.category as keyof typeof expenseCategories]?.label || expense.category}</span>
                </div>
              )}
              {expense.receiptUrl && (
                <div>
                  <span className="text-gray-500">Recibo:</span>
                  <button type="button" className="ml-1 font-medium text-blue-600 hover:underline" onClick={() => openProtectedUrl(expense.receiptUrl!).catch(() => {})}>Ver</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
  );
}
