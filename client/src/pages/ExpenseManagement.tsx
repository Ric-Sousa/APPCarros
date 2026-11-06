import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { get, post, handleApiError } from "@/lib/apiUtils";
import ReceiptOcrDialog from "@/components/ReceiptOcrDialog";
import ExpenseListItem, { expenseCategories } from "@/components/ExpenseListItem";
import { useVehicles } from "@/hooks/useVehicles";
import { useToast } from "@/hooks/use-toast";

import Sidebar from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Receipt, Euro, TrendingUp, Calendar, Filter, Download, FileText, Upload } from "lucide-react";
import type { Vehicle, ExpenseRecord } from "@shared/schema";
import { z } from "zod";

const expenseFormSchema = z.object({
  vehicleId: z.string().min(1, "Veículo é obrigatório"),
  type: z.string().optional(), // Will be set automatically from category
  category: z.string().min(1, "Categoria é obrigatória"),
  amount: z.coerce.number<number>().min(0.01, "Valor deve ser superior a 0"),
  date: z.string().min(1, "Data é obrigatória"),
  description: z.string().optional(),
  receiptUrl: z.string().optional(),
  vendor: z.string().optional(),
  mileage: z.coerce.number<number>().min(0, "Quilometragem deve ser positiva").optional(),
  isBusinessExpense: z.boolean().default(false),
});


export default function ExpenseManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  

    const { data: vehicles = [] } = useVehicles();

  const { data: expenses = [] } = useQuery<ExpenseRecord[]>({
    queryKey: ["/api/expenses", selectedVehicle],
    queryFn: async () => {
            if (!selectedVehicle) return [];
      return get<ExpenseRecord[]>(`/api/expenses?vehicleId=${selectedVehicle}`);
    },
    enabled: !!selectedVehicle,
  });

  const form = useForm({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      vehicleId: "",
      type: "",
      date: new Date().toISOString().slice(0, 10),
      category: "",
      amount: 0,
      description: "",
      mileage: 0,
      vendor: "",
      receiptUrl: "",
      isBusinessExpense: false,
    },
  });

  const addExpenseMutation = useMutation({
        mutationFn: (data: z.infer<typeof expenseFormSchema>) => post("/api/expenses", data),
    onSuccess: () => {
      // Invalidate all expense queries
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({
        title: "Despesa registada",
        description: "A despesa foi registada com sucesso!",
      });
      form.reset();
      setIsAddExpenseModalOpen(false);
    },
        onError: (error) => {
      toast({
        title: "Erro",
        description: handleApiError(error, "Erro ao registar despesa. Tente novamente."),
        variant: "destructive",
      });
    },
  });

  // Update form vehicleId when selectedVehicle changes
  useEffect(() => {
    if (selectedVehicle) {
      form.setValue('vehicleId', selectedVehicle);
    }
  }, [selectedVehicle, form]);

  const onSubmit = (data: z.infer<typeof expenseFormSchema>) => {
    
    const expenseData = {
      ...data,
      type: data.category
    };
    
    addExpenseMutation.mutate(expenseData);
  };

  // Filter expenses
  const filteredExpenses = expenses.filter((expense) => {
    if (categoryFilter !== "all" && expense.category !== categoryFilter) return false;
    
    if (dateFilter !== "all") {
      const expenseDate = new Date(expense.date);
      const now = new Date();
      
      switch (dateFilter) {
        case "thisMonth":
          if (expenseDate.getMonth() !== now.getMonth() || 
              expenseDate.getFullYear() !== now.getFullYear()) return false;
          break;
        case "thisYear":
          if (expenseDate.getFullYear() !== now.getFullYear()) return false;
          break;
        case "lastMonth":
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
          if (expenseDate.getMonth() !== lastMonth.getMonth() ||
              expenseDate.getFullYear() !== lastMonth.getFullYear()) return false;
          break;
      }
    }
    
    return true;
  });

  // Calculate statistics
  const calculateStats = () => {
    if (filteredExpenses.length === 0) return null;

    const totalAmount = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    const categoryStats = Object.keys(expenseCategories).map(categoryKey => {
      const categoryExpenses = filteredExpenses.filter(e => e.category === categoryKey);
      const total = categoryExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
      return {
        category: categoryKey,
        total,
        count: categoryExpenses.length,
        percentage: totalAmount > 0 ? (total / totalAmount) * 100 : 0,
      };
    }).filter(stat => stat.count > 0).sort((a, b) => b.total - a.total);

    const averagePerMonth = filteredExpenses.length > 0 ? 
      totalAmount / Math.max(1, Math.ceil(filteredExpenses.length / 4)) : 0;

    return {
      totalAmount,
      totalExpenses: filteredExpenses.length,
      categoryStats,
      averagePerMonth,
    };
  };

  const stats = calculateStats();

  

  return (
    <Sidebar>
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-card rounded-lg">
                <Receipt className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Gestão de Despesas</h1>
                <p className="text-muted-foreground">Registe e analise todas as despesas dos seus veículos</p>
              </div>
            </div>
            <Dialog open={isAddExpenseModalOpen} onOpenChange={setIsAddExpenseModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700 self-start sm:self-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Despesa
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Registar Despesa</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
                  })} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="vehicleId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Veículo</FormLabel>
                            <Select onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecionar veículo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {vehicles.map((vehicle) => (
                                  <SelectItem key={vehicle.id} value={vehicle.id}>
                                    {vehicle.brand} {vehicle.model} - {vehicle.licensePlate}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Categoria</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Tipo de despesa" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="fuel">⛽ Combustível</SelectItem>
                                <SelectItem value="maintenance">🔧 Manutenção</SelectItem>
                                <SelectItem value="insurance">🛡️ Seguro</SelectItem>
                                <SelectItem value="tax">📋 Imposto</SelectItem>
                                <SelectItem value="toll">🛣️ Portagem</SelectItem>
                                <SelectItem value="parking">🅿️ Estacionamento</SelectItem>
                                <SelectItem value="other">📝 Outros</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valor (€)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01"
                                placeholder="0.00"
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="vendor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fornecedor</FormLabel>
                            <FormControl>
                              <Input placeholder="Local da despesa" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="mileage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quilometragem (opcional)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number"
                                placeholder="123000"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="receiptUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>URL do Recibo (opcional)</FormLabel>
                            <FormControl>
                              <Input placeholder="https://..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descrição</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Descrição da despesa" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end space-x-4">
                      <Button type="button" variant="outline" onClick={() => setIsAddExpenseModalOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={addExpenseMutation.isPending}>
                        {addExpenseMutation.isPending ? "A guardar..." : "Guardar"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <ReceiptOcrDialog vehicles={vehicles} selectedVehicle={selectedVehicle} onSelectVehicle={setSelectedVehicle} />
          </div>
        </div>

        {/* Vehicle and Filters */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="vehicle-select" className="text-base font-medium">
              Veículo
            </Label>
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Escolher veículo" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.brand} {vehicle.model} - {vehicle.licensePlate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-base font-medium">Período</Label>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="thisMonth">Este Mês</SelectItem>
                <SelectItem value="lastMonth">Mês Passado</SelectItem>
                <SelectItem value="thisYear">Este Ano</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-base font-medium">Categoria</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="fuel">⛽ Combustível</SelectItem>
                <SelectItem value="maintenance">🔧 Manutenção</SelectItem>
                <SelectItem value="insurance">🛡️ Seguro</SelectItem>
                <SelectItem value="tax">📋 Imposto</SelectItem>
                <SelectItem value="toll">🛣️ Portagem</SelectItem>
                <SelectItem value="parking">🅿️ Estacionamento</SelectItem>
                <SelectItem value="other">📝 Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {selectedVehicle && (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Resumo</TabsTrigger>
              <TabsTrigger value="expenses">Despesas</TabsTrigger>
              <TabsTrigger value="analytics">Análise</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview">
              {stats ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Gasto</CardTitle>
                        <Euro className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">€{stats.totalAmount.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">
                          {stats.totalExpenses} despesas
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Média Mensal</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">€{stats.averagePerMonth.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">estimativa</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Categoria Principal</CardTitle>
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {stats.categoryStats[0] ? 
                            expenseCategories[stats.categoryStats[0].category as keyof typeof expenseCategories]?.label || stats.categoryStats[0].category : 
                            "N/A"
                          }
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {stats.categoryStats[0] ? `€${stats.categoryStats[0].total.toFixed(2)}` : ""}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Última Despesa</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {filteredExpenses.length > 0 ? 
                            new Date(Math.max(...filteredExpenses.map(e => new Date(e.date).getTime()))).toLocaleDateString('pt-PT') : 
                            "N/A"
                          }
                        </div>
                        <p className="text-xs text-muted-foreground">data da última</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Category Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Distribuição por Categoria</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {stats.categoryStats.map((stat) => {
                          const categoryInfo = expenseCategories[stat.category as keyof typeof expenseCategories];
                          const categoryName = categoryInfo?.label || stat.category;
                          const categoryIcon = categoryInfo?.icon || "📝";
                          
                          return (
                            <div key={stat.category} className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <span className="text-lg">{categoryIcon}</span>
                                <span className="font-medium">{categoryName}</span>
                                <Badge variant="secondary">{stat.count}</Badge>
                              </div>
                              <div className="text-right">
                                <div className="font-bold">€{stat.total.toFixed(2)}</div>
                                <div className="text-sm text-gray-500">
                                  {stat.percentage.toFixed(1)}%
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-12">
                    <Receipt className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-foreground mb-2">
                      Nenhuma despesa encontrada
                    </p>
                    <p className="text-muted-foreground">
                      Registe a sua primeira despesa para ver estatísticas
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Expenses Tab */}
            <TabsContent value="expenses">
              <Card>
                <CardHeader>
                  <CardTitle>Lista de Despesas</CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredExpenses.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-600">Nenhuma despesa encontrada</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredExpenses.map((expense) => (
                        <ExpenseListItem key={expense.id} expense={expense} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics">
              <Card>
                <CardHeader>
                  <CardTitle>Análise de Gastos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <TrendingUp className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">Gráficos e tendências em desenvolvimento</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Sidebar>
  );
}
