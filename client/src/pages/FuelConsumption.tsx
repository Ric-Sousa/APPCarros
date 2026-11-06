import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { post, handleApiError } from "@/lib/apiUtils";
import { fuelFormSchema as fuelFieldsSchema, useFuelRecords } from "@/lib/fuelForm";
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
import { Plus, Fuel, TrendingUp, Calculator, MapPin, Calendar } from "lucide-react";
import FuelEfficiencyCalculator from "@/components/FuelEfficiencyCalculator";
import FuelStationComparator from "@/components/FuelStationComparator";
import FuelAnalysis from "@/components/FuelAnalysis";
import type { Vehicle, FuelRecord } from "@shared/schema";
import { z } from "zod";

const fuelFormSchema = fuelFieldsSchema.extend({
  vehicleId: z.string().min(1, "Veículo é obrigatório"),
});

export default function FuelConsumption() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isAddFuelModalOpen, setIsAddFuelModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");

    const { data: vehicles = [] } = useVehicles();
  const { data: fuelRecords = [] } = useFuelRecords(selectedVehicle);

  // Calcular estatísticas de combustível
  const calculateFuelStats = (records: FuelRecord[]) => {
    if (records.length === 0) return null;

    const sortedRecords = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Consumo médio
    let totalConsumption = 0;
    let totalDistance = 0;
    let consumptionCount = 0;
    
    for (let i = 1; i < sortedRecords.length; i++) {
      const current = sortedRecords[i];
      const previous = sortedRecords[i - 1];
      const distance = current.mileage - previous.mileage;
      
      if (distance > 0) {
        const consumption = (Number(current.liters) / distance) * 100;
        totalConsumption += consumption;
        totalDistance += distance;
        consumptionCount++;
      }
    }
    
    const avgConsumption = consumptionCount > 0 ? totalConsumption / consumptionCount : 0;
    const totalSpent = records.reduce((sum, record) => sum + Number(record.totalCost), 0);
    const avgCostPerLiter = records.reduce((sum, record) => sum + Number(record.costPerLiter), 0) / records.length;
    const totalLiters = records.reduce((sum, record) => sum + Number(record.liters), 0);
    
    // Consumo mensal
    const monthlyData = records.reduce((acc, record) => {
      const month = new Date(record.date).toISOString().substring(0, 7);
      if (!acc[month]) {
        acc[month] = { cost: 0, liters: 0, records: 0 };
      }
      acc[month].cost += Number(record.totalCost);
      acc[month].liters += Number(record.liters);
      acc[month].records += 1;
      return acc;
    }, {} as Record<string, { cost: number; liters: number; records: number }>);
    
    return {
      avgConsumption: avgConsumption.toFixed(2),
      totalSpent: totalSpent.toFixed(2),
      avgCostPerLiter: avgCostPerLiter.toFixed(3),
      totalLiters: totalLiters.toFixed(1),
      totalDistance,
      monthlyData,
      recordsCount: records.length
    };
  };

  const fuelStats = calculateFuelStats(fuelRecords);

  const form = useForm({
    resolver: zodResolver(fuelFormSchema),
    defaultValues: {
      vehicleId: "",
      date: new Date().toISOString().slice(0, 10),
      mileage: 0,
      liters: 0,
      costPerLiter: 1.65,
      totalCost: 0,
      fuelType: "gasoline",
      gasStationName: "",
      gasStationLocation: "",
      fullTank: true,
      notes: "",
    },
  });

  // Auto-calculate total cost
  const liters = form.watch("liters");
  const costPerLiter = form.watch("costPerLiter");
  useEffect(() => {
    const total = liters * costPerLiter;
    form.setValue("totalCost", Number(total.toFixed(2)));
  }, [liters, costPerLiter, form]);

  const addFuelMutation = useMutation({
        mutationFn: (data: z.infer<typeof fuelFormSchema>) => post("/api/fuel-records", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fuel-records"] });
      toast({
        title: "Abastecimento registado",
        description: "O abastecimento foi registado com sucesso!",
      });
      form.reset();
      setIsAddFuelModalOpen(false);
    },
        onError: (error) => {
      toast({
        title: "Erro",
        description: handleApiError(error, "Erro ao registar abastecimento. Tente novamente."),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof fuelFormSchema>) => {
    addFuelMutation.mutate(data);
  };

  // Cálculos de estatísticas
  const calculateStats = () => {
    if (fuelRecords.length < 2) return null;

    const sortedRecords = [...fuelRecords].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let totalLiters = 0;
    let totalCost = 0;
    let totalDistance = 0;
    let consumptions: number[] = [];

    for (let i = 1; i < sortedRecords.length; i++) {
      const current = sortedRecords[i];
      const previous = sortedRecords[i - 1];
      
      if (current.fullTank && previous.fullTank) {
        const distance = current.mileage - previous.mileage;
        if (distance > 0) {
          const consumption = (Number(current.liters) / distance) * 100;
          consumptions.push(consumption);
          totalDistance += distance;
        }
      }
      
      totalLiters += Number(current.liters);
      totalCost += Number(current.totalCost);
    }

    const avgConsumption = consumptions.length > 0 
      ? consumptions.reduce((a, b) => a + b, 0) / consumptions.length 
      : 0;

    const avgCostPerKm = totalDistance > 0 ? totalCost / totalDistance : 0;

    return {
      totalLiters: totalLiters.toFixed(1),
      totalCost: totalCost.toFixed(2),
      totalDistance,
      avgConsumption: avgConsumption.toFixed(1),
      avgCostPerKm: avgCostPerKm.toFixed(3),
      totalRecords: fuelRecords.length,
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
                <Fuel className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Consumo de Combustível</h1>
                <p className="text-muted-foreground">Registe e analise os seus abastecimentos</p>
              </div>
            </div>
            <Dialog open={isAddFuelModalOpen} onOpenChange={setIsAddFuelModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 self-start sm:self-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Abastecimento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Registar Abastecimento</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="vehicleId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Veículo</FormLabel>
                            <Select onValueChange={(value) => {
                              field.onChange(value);
                              setSelectedVehicle(value);
                            }}>
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
                        name="mileage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quilometragem</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="123000"
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
                        name="liters"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Litros</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.1"
                                placeholder="45.5"
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
                        name="costPerLiter"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Preço por Litro (€)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.001"
                                placeholder="1.650"
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
                        name="totalCost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Total (€)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01"
                                {...field}
                                value={field.value}
                                readOnly
                                className="bg-gray-50"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="fuelType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Combustível</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Tipo de combustível" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="gasoline">Gasolina 95</SelectItem>
                                <SelectItem value="gasoline_98">Gasolina 98</SelectItem>
                                <SelectItem value="diesel">Gasóleo</SelectItem>
                                <SelectItem value="electric">Elétrico</SelectItem>
                                <SelectItem value="hybrid">Híbrido</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="gasStationName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Posto de Combustível</FormLabel>
                            <FormControl>
                              <Input placeholder="Galp, Repsol, BP..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="gasStationLocation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Localização</FormLabel>
                          <FormControl>
                            <Input placeholder="Cidade, estrada..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notas (opcional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Observações sobre o abastecimento..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end space-x-4">
                      <Button type="button" variant="outline" onClick={() => setIsAddFuelModalOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={addFuelMutation.isPending}>
                        {addFuelMutation.isPending ? "A guardar..." : "Guardar"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Vehicle Selection */}
        <div className="mb-6">
          <Label htmlFor="vehicle-select" className="text-base font-medium">
            Selecionar Veículo
          </Label>
          <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
            <SelectTrigger className="w-full max-w-md mt-2">
              <SelectValue placeholder="Escolher veículo para analisar" />
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

        {selectedVehicle && (
          <Tabs defaultValue="stats" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="stats">Estatísticas</TabsTrigger>
              <TabsTrigger value="records">Histórico</TabsTrigger>
              <TabsTrigger value="analysis">Análise</TabsTrigger>
              <TabsTrigger value="calculator">Calculadora</TabsTrigger>
              <TabsTrigger value="stations">Postos</TabsTrigger>
            </TabsList>

            {/* Statistics Tab */}
            <TabsContent value="stats">
              {stats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Consumo Médio</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.avgConsumption}L</div>
                      <p className="text-xs text-muted-foreground">por 100km</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Custo por KM</CardTitle>
                      <Calculator className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">€{stats.avgCostPerKm}</div>
                      <p className="text-xs text-muted-foreground">custo médio</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Gasto</CardTitle>
                      <Fuel className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">€{stats.totalCost}</div>
                      <p className="text-xs text-muted-foreground">{stats.totalLiters}L consumidos</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Distância Total</CardTitle>
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.totalDistance.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground">quilómetros</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Abastecimentos</CardTitle>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.totalRecords}</div>
                      <p className="text-xs text-muted-foreground">registos</p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-12">
                    <Fuel className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-foreground mb-2">
                      Sem dados suficientes
                    </p>
                    <p className="text-muted-foreground">
                      Registe pelo menos 2 abastecimentos para ver estatísticas
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Records Tab */}
            <TabsContent value="records">
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Abastecimentos</CardTitle>
                </CardHeader>
                <CardContent>
                  {fuelRecords.length === 0 ? (
                    <div className="text-center py-8">
                      <Fuel className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-600">Nenhum abastecimento registado</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {fuelRecords.map((record) => (
                        <div key={record.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center space-x-4">
                                <Badge variant={record.fullTank ? "default" : "secondary"}>
                                  {record.fullTank ? "Depósito Cheio" : "Parcial"}
                                </Badge>
                                <span className="text-sm text-gray-500">
                                  {new Date(record.date).toLocaleDateString('pt-PT')}
                                </span>
                              </div>
                              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">Litros:</span>
                                  <span className="ml-1 font-medium">{record.liters}L</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Preço/L:</span>
                                  <span className="ml-1 font-medium">€{record.costPerLiter}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Total:</span>
                                  <span className="ml-1 font-medium">€{record.totalCost}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">KM:</span>
                                  <span className="ml-1 font-medium">{record.mileage.toLocaleString()}</span>
                                </div>
                              </div>
                              {record.gasStationName && (
                                <p className="mt-2 text-sm text-gray-600">
                                  <MapPin className="h-3 w-3 inline mr-1" />
                                  {record.gasStationName} {record.gasStationLocation && `- ${record.gasStationLocation}`}
                                </p>
                              )}
                              {record.notes && (
                                <p className="mt-2 text-sm text-gray-600">{record.notes}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analysis Tab */}
            <TabsContent value="analysis">
              <FuelAnalysis fuelStats={fuelStats} onAddRecord={() => setIsAddFuelModalOpen(true)} />
            </TabsContent>

            {/* Calculator Tab */}
            <TabsContent value="calculator">
              <FuelEfficiencyCalculator />
            </TabsContent>

            {/* Stations Tab */}
            <TabsContent value="stations">
              <FuelStationComparator />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Sidebar>
  );
}
