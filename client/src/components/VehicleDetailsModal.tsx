import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Car, Plus, Gauge, Pencil, Wrench, Droplet, CircleDot, ClipboardCheck, Settings, ExternalLink, type LucideIcon } from "lucide-react";
import type { Vehicle, MaintenanceRecord } from "@shared/schema";
import { fuelLabel } from "@shared/fuel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import MaintenanceRecordForm from "@/components/MaintenanceRecordForm";
import VehicleEditForm from "@/components/VehicleEditForm";
import { formatDate, formatEuro, formatNumber } from "@/lib/utils";

interface VehicleDetailsModalProps {
  vehicle: Vehicle;
  isOpen: boolean;
  onClose: () => void;
}

const MAINTENANCE_ICONS: Record<string, [LucideIcon, string]> = {
  oil_change: [Droplet, "text-secondary"],
  tire_change: [CircleDot, "text-primary"],
  inspection: [ClipboardCheck, "text-accent"],
  repair: [Wrench, "text-destructive"],
};

/** Percentagem (0–100) do intervalo já percorrido desde a última troca. */
const progressSince = (last: number | null | undefined, interval: number, current: number) =>
  last == null ? 0 : Math.max(0, Math.min(((current - last) / interval) * 100, 100));

function StatusBar({ label, value }: { label: string; value: number }) {
  const [text, color, bar] = value >= 85 ? ["Urgente", "text-destructive", "bg-destructive"] : value >= 70 ? ["Cuidado", "text-yellow-600 dark:text-yellow-400", "bg-yellow-500"] : ["Bom", "text-secondary", "bg-secondary"];
  return (
    <div>
      <div className="flex justify-between items-center mb-1 text-sm">
        <span className="font-medium">{label}</span>
        <span className={color}>{text}</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2" role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`${bar} h-2 rounded-full transition-all duration-300`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function InfoRow({ label, value, testId }: { label: string; value: React.ReactNode; testId?: string }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-words min-w-0" data-testid={testId}>{value}</span>
    </div>
  );
}

export default function VehicleDetailsModal({ vehicle: initialVehicle, isOpen, onClose }: VehicleDetailsModalProps) {
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const { data: vehicle = initialVehicle } = useQuery<Vehicle>({ queryKey: ["/api/vehicles", initialVehicle.id], enabled: isOpen });
  const { data: maintenanceRecords = [], isLoading: recordsLoading } = useQuery<MaintenanceRecord[]>({
    queryKey: ["/api/vehicles", vehicle.id, "maintenance"],
    enabled: isOpen,
  });
  const { data: predictiveStatus } = useQuery<{ oilRisk: number; tireRisk: number; inspectionRisk: number }>({
    queryKey: ["/api/vehicles", vehicle.id, "predictive-status"],
    enabled: isOpen,
  });

  useEffect(() => {
    if (!isOpen) {
      setShowMaintenanceForm(false);
      setIsEditMode(false);
    }
  }, [isOpen]);

  const oilProgress = progressSince(vehicle.lastOilChangeMileage, vehicle.oilChangeInterval || 15000, vehicle.currentMileage);
  const tireProgress = progressSince(vehicle.lastTireChangeMileage, vehicle.tireChangeInterval || 50000, vehicle.currentMileage);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm -mx-6 -mt-6 px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-4 text-left">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center shrink-0">
              <Car className="w-5 h-5 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="min-w-0">
              <span className="block text-lg sm:text-xl font-semibold break-words leading-snug" data-testid="text-vehicle-details-title">
                {vehicle.brand} {vehicle.model}
              </span>
              <span className="block text-sm font-normal text-muted-foreground" data-testid="text-vehicle-details-plate">{vehicle.licensePlate}</span>
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">Resumo, estado da manutenção e histórico do veículo</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4 space-y-2">
                  <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Informações do Veículo</h4>
                  <InfoRow label="Ano" value={vehicle.year} testId="text-vehicle-year" />
                  <InfoRow label="Combustível" value={fuelLabel(vehicle.fuelType)} testId="text-vehicle-fuel" />
                  <InfoRow label="KMs Atuais" value={`${formatNumber(vehicle.currentMileage)} km`} testId="text-vehicle-mileage" />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Estado da Manutenção</h4>
                  <StatusBar label="Óleo" value={oilProgress} />
                  <StatusBar label="Pneus" value={tireProgress} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Previsão de Manutenção</h4>
                  {predictiveStatus ? (
                    <>
                      <StatusBar label="Óleo" value={predictiveStatus.oilRisk * 100} />
                      <StatusBar label="Pneus" value={predictiveStatus.tireRisk * 100} />
                      <StatusBar label="Inspeção" value={predictiveStatus.inspectionRisk * 100} />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem dados de previsão.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-2">
                  <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Datas Importantes</h4>
                  <InfoRow label="Inspeção" value={formatDate(vehicle.inspectionDue, "—")} testId="text-inspection-due" />
                  <InfoRow label="IUC" value={formatDate(vehicle.iucDue, "—")} testId="text-iuc-due" />
                  <InfoRow label="Seguro" value={formatDate(vehicle.insuranceDue, "—")} testId="text-insurance-due" />
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-6 border-t border-border">
              <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90 w-full sm:w-auto" onClick={() => setShowMaintenanceForm((v) => !v)} data-testid="button-add-maintenance">
                <Plus className="w-4 h-4 mr-2" aria-hidden="true" /> Adicionar Manutenção
              </Button>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90 w-full sm:w-auto" onClick={() => setIsEditMode(true)} data-testid="button-update-mileage">
                <Gauge className="w-4 h-4 mr-2" aria-hidden="true" /> Atualizar KMs
              </Button>
              <Button variant="outline" onClick={() => setIsEditMode(true)} data-testid="button-edit-vehicle" className="w-full sm:w-auto">
                <Pencil className="w-4 h-4 mr-2" aria-hidden="true" /> Editar
              </Button>
              <Button variant="outline" asChild className="w-full sm:w-auto" data-testid="link-vehicle-page">
                <Link href={`/vehicle/${vehicle.id}`}>
                  <ExternalLink className="w-4 h-4 mr-2" aria-hidden="true" /> Ver página completa
                </Link>
              </Button>
            </div>

            {showMaintenanceForm && (
              <Card className="mt-6">
                <CardContent className="p-4 sm:p-6">
                  <h4 className="font-semibold mb-4">Adicionar Manutenção</h4>
                  <MaintenanceRecordForm vehicle={vehicle} onDone={() => setShowMaintenanceForm(false)} />
                </CardContent>
              </Card>
            )}

            {isEditMode && <VehicleEditForm key={vehicle.id} vehicle={vehicle} onDone={() => setIsEditMode(false)} />}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <h4 className="font-semibold">Histórico de Manutenções</h4>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recordsLoading ? (
                <p className="text-sm text-muted-foreground" role="status">A carregar...</p>
              ) : maintenanceRecords.length === 0 ? (
                <div className="text-center py-8">
                  <Wrench className="w-8 h-8 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
                  <p className="text-muted-foreground">Nenhuma manutenção registada</p>
                </div>
              ) : (
                maintenanceRecords.map((record) => {
                  const [Icon, color] = MAINTENANCE_ICONS[record.type] ?? [Settings, "text-muted-foreground"];
                  return (
                    <div key={record.id} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg" data-testid={`maintenance-record-${record.id}`}>
                      <div className="w-8 h-8 bg-secondary/20 rounded-lg flex items-center justify-center shrink-0">
                        <Icon className={`w-5 h-5 ${color}`} aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm break-words">{record.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(record.performedAt)}
                          {!!record.mileage && ` · ${formatNumber(record.mileage)} km`}
                        </p>
                      </div>
                      {Number(record.cost) > 0 && <p className="text-sm font-medium shrink-0">{formatEuro(record.cost)}</p>}
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
