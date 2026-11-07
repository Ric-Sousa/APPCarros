import { useMemo, useState } from "react";
import { Fuel, Plus } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FuelEfficiencyCalculator from "@/components/FuelEfficiencyCalculator";
import FuelStationComparator from "@/components/FuelStationComparator";
import FuelAnalysis from "@/components/FuelAnalysis";
import FuelRecordDialog from "@/components/FuelRecordDialog";
import VehicleFuelManagement from "@/components/VehicleFuelManagement";
import { useVehicles } from "@/hooks/useVehicles";
import { computeFuelStats, useFuelRecords } from "@/lib/fuelForm";

export default function FuelConsumption() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const { data: vehicles = [] } = useVehicles();
  const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const { data: fuelRecords = [] } = useFuelRecords(selectedVehicleId);
  const stats = useMemo(() => computeFuelStats(fuelRecords), [fuelRecords]);

  return (
    <Sidebar>
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-card rounded-lg">
              <Fuel className="h-8 w-8 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Consumo de Combustível</h1>
              <p className="text-muted-foreground">Registe e analise os seus abastecimentos</p>
            </div>
          </div>
          <Button onClick={() => setIsAddOpen(true)} disabled={vehicles.length === 0}>
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" /> Novo Abastecimento
          </Button>
        </div>

        <div className="mb-6">
          <Label htmlFor="fuel-vehicle-select" className="text-base font-medium">Selecionar Veículo</Label>
          <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
            <SelectTrigger id="fuel-vehicle-select" className="w-full max-w-md mt-2">
              <SelectValue placeholder={vehicles.length ? "Escolher veículo para analisar" : "Ainda não tem veículos"} />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} — {v.licensePlate}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {vehicle && (
          <Tabs defaultValue="records" className="space-y-6">
            <TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden">
              <TabsTrigger value="records" className="shrink-0">Abastecimentos</TabsTrigger>
              <TabsTrigger value="analysis" className="shrink-0">Análise</TabsTrigger>
              <TabsTrigger value="calculator" className="shrink-0">Calculadora</TabsTrigger>
              <TabsTrigger value="stations" className="shrink-0">Postos</TabsTrigger>
            </TabsList>
            <TabsContent value="records">
              <VehicleFuelManagement vehicle={vehicle} />
            </TabsContent>
            <TabsContent value="analysis">
              <FuelAnalysis stats={stats} onAddRecord={() => setIsAddOpen(true)} />
            </TabsContent>
            <TabsContent value="calculator">
              <FuelEfficiencyCalculator />
            </TabsContent>
            <TabsContent value="stations">
              <FuelStationComparator />
            </TabsContent>
          </Tabs>
        )}

        <FuelRecordDialog open={isAddOpen} onOpenChange={setIsAddOpen} vehicle={vehicle} vehicles={vehicles} />
      </div>
    </Sidebar>
  );
}
