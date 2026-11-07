import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Download, Euro, FileText, Plus, Receipt, TrendingUp } from "lucide-react";
import type { ExpenseRecord } from "@shared/schema";
import { monthlyExpenses } from "@shared/calc";
import Sidebar from "@/components/Sidebar";
import ReceiptOcrDialog from "@/components/ReceiptOcrDialog";
import ExpenseListItem from "@/components/ExpenseListItem";
import ExpenseFormDialog from "@/components/ExpenseFormDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVehicles } from "@/hooks/useVehicles";
import { get } from "@/lib/apiUtils";
import { EXPENSE_CATEGORIES, downloadExpensesCsv, expenseBreakdown, filterExpenses, type DateFilter } from "@/lib/expenses";
import { formatDate, formatEuro, formatNumber, localDateInput } from "@/lib/utils";

function StatCard({ title, icon: Icon, value, hint }: { title: string; icon: typeof Euro; value: string; hint: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold break-words">{value}</div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export default function ExpenseManagement() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const { data: vehicles = [] } = useVehicles();

  const { data: expenses = [] } = useQuery<ExpenseRecord[]>({
    queryKey: ["/api/expenses", selectedVehicle],
    queryFn: () => get<ExpenseRecord[]>(`/api/expenses?vehicleId=${encodeURIComponent(selectedVehicle)}`),
    enabled: !!selectedVehicle,
  });

  const filtered = useMemo(() => filterExpenses(expenses, dateFilter, categoryFilter), [expenses, dateFilter, categoryFilter]);
  const breakdown = useMemo(() => expenseBreakdown(filtered), [filtered]);
  // Média real: total dos últimos 12 meses ÷ 12 (mesma fórmula do servidor)
  const monthlyAverage = useMemo(() => monthlyExpenses(expenses), [expenses]);
  const lastDate = filtered.length ? filtered.reduce((max, e) => (new Date(e.date) > new Date(max) ? e.date : max), filtered[0].date) : null;
  const maxMonth = Math.max(...breakdown.months.map((m) => m.total), 1);
  const vehicle = vehicles.find((v) => v.id === selectedVehicle);

  const exportCsv = () =>
    downloadExpensesCsv(filtered, `despesas-${vehicle?.licensePlate ?? "veiculo"}-${localDateInput()}.csv`);

  return (
    <Sidebar>
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-card rounded-lg">
              <Receipt className="h-8 w-8 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Gestão de Despesas</h1>
              <p className="text-muted-foreground">Registe e analise as despesas dos seus veículos</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setIsAddOpen(true)} disabled={vehicles.length === 0}>
              <Plus className="h-4 w-4 mr-2" aria-hidden="true" /> Nova Despesa
            </Button>
            <ReceiptOcrDialog vehicles={vehicles} selectedVehicle={selectedVehicle} onSelectVehicle={setSelectedVehicle} />
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="expense-vehicle" className="text-base font-medium">Veículo</Label>
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger id="expense-vehicle" className="mt-2"><SelectValue placeholder="Escolher veículo" /></SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} — {v.licensePlate}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="expense-period" className="text-base font-medium">Período</Label>
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
              <SelectTrigger id="expense-period" className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="thisMonth">Este mês</SelectItem>
                <SelectItem value="lastMonth">Mês passado</SelectItem>
                <SelectItem value="thisYear">Este ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="expense-category" className="text-base font-medium">Categoria</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger id="expense-category" className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(EXPENSE_CATEGORIES).map(([key, c]) => <SelectItem key={key} value={key}>{c.icon} {c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-2" aria-hidden="true" /> Exportar CSV
            </Button>
          </div>
        </div>

        {selectedVehicle && (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="w-full sm:w-auto justify-start overflow-x-auto">
              <TabsTrigger value="overview" className="shrink-0">Resumo</TabsTrigger>
              <TabsTrigger value="expenses" className="shrink-0">Despesas</TabsTrigger>
              <TabsTrigger value="analytics" className="shrink-0">Análise</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              {filtered.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard title="Total Gasto" icon={Euro} value={formatEuro(breakdown.total)} hint={`${filtered.length} despesas`} />
                  <StatCard title="Média Mensal" icon={TrendingUp} value={formatEuro(monthlyAverage)} hint="últimos 12 meses" />
                  <StatCard title="Categoria Principal" icon={Receipt} value={breakdown.categories[0]?.label ?? "—"} hint={breakdown.categories[0] ? formatEuro(breakdown.categories[0].total) : ""} />
                  <StatCard title="Última Despesa" icon={Calendar} value={formatDate(lastDate, "—")} hint="data da última" />
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-12">
                    <Receipt className="h-16 w-16 mx-auto text-muted-foreground mb-4" aria-hidden="true" />
                    <p className="text-lg font-medium mb-2">Nenhuma despesa encontrada</p>
                    <p className="text-muted-foreground">Registe uma despesa ou altere os filtros</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="expenses">
              <Card>
                <CardHeader><CardTitle>Lista de Despesas</CardTitle></CardHeader>
                <CardContent>
                  {filtered.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" aria-hidden="true" />
                      <p>Nenhuma despesa encontrada</p>
                    </div>
                  ) : (
                    <div className="space-y-4">{filtered.map((e) => <ExpenseListItem key={e.id} expense={e} />)}</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              {filtered.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Sem despesas para analisar no período escolhido.</p>
              ) : (
                <>
                  <Card>
                    <CardHeader><CardTitle>Por Categoria</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      {breakdown.categories.map((c) => (
                        <div key={c.key} className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2 font-medium">
                              <span aria-hidden="true">{c.icon}</span> {c.label} <Badge variant="secondary">{c.count}</Badge>
                            </span>
                            <span className="text-right text-sm">
                              <span className="font-bold">{formatEuro(c.total)}</span>
                              <span className="text-muted-foreground ml-2">{formatNumber(c.percentage, 1)}%</span>
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted">
                            <div className="h-2 rounded-full bg-primary" style={{ width: `${c.percentage}%` }} />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>Por Mês</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {breakdown.months.map((m) => (
                        <div key={m.month} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="capitalize">{new Date(`${m.month}-01T00:00:00`).toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}</span>
                            <span className="font-medium">{formatEuro(m.total)}</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted">
                            <div className="h-2 rounded-full bg-gradient-to-r from-green-500 to-blue-500" style={{ width: `${(m.total / maxMonth) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}

        <ExpenseFormDialog open={isAddOpen} onOpenChange={setIsAddOpen} vehicles={vehicles} defaultVehicleId={selectedVehicle} />
      </div>
    </Sidebar>
  );
}
