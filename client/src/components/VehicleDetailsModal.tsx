import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMaintenanceRecordSchema, insertVehicleSchema } from "@shared/schema";
import { post, patch, get, handleApiError } from "@/lib/apiUtils";
import { Link } from "wouter";
import { Car, Plus, Gauge, Pencil, Save, Wrench, Droplet, CircleDot, ClipboardCheck, Settings, ExternalLink, type LucideIcon } from "lucide-react";

import { useToast } from "@/hooks/use-toast";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Vehicle, MaintenanceRecord } from "@shared/schema";
import { useState, useEffect } from "react";
import MaintenanceRecordForm from "@/components/MaintenanceRecordForm";
import VehicleEditForm from "@/components/VehicleEditForm";
import { z } from "zod";

interface VehicleDetailsModalProps {
  vehicle: Vehicle;
  isOpen: boolean;
  onClose: () => void;
  openInEditMode?: boolean;
}

const maintenanceFormSchema = z.object({
  vehicleId: z.string().min(1, "ID do veículo é obrigatório"),
  type: z.string().min(1, "Tipo é obrigatório"),
  description: z.string().min(1, "Descrição é obrigatória"),
  mileage: z.coerce.number<number>().min(0, "Quilometragem deve ser positiva").optional(),
  cost: z.coerce.number<number>().min(0, "Custo deve ser positivo").optional(),
  performedAt: z.string(),
  notes: z.string().optional(),
});

const editVehicleFormSchema = z.object({
  id: z.string().min(1, "ID é obrigatório"),
    userId: z.string().min(1, "ID do utilizador é obrigatório"),
  licensePlate: z.string().min(1, "Matrícula é obrigatória"),
  brand: z.string().min(1, "Marca é obrigatória"),
  model: z.string().min(1, "Modelo é obrigatório"),
  year: z.coerce.number<number>().min(1900).max(new Date().getFullYear() + 1),
  fuelType: z.string().optional(),
  currentMileage: z.coerce.number<number>().min(0, "Quilometragem deve ser positiva"),
  
  // InformAtrículas data
  originalColor: z.string().optional(),
  origin: z.string().optional(),
  registrationLocation: z.string().optional(),
  iucCategory: z.string().optional(),
  powerCV: z.coerce.number<number>().optional(),
  powerKW: z.coerce.number<number>().optional(),
  engineDisplacement: z.coerce.number<number>().optional(),
  certifyingEntity: z.string().optional(),
  vehicleCategory: z.string().optional(),
  
  // Oil and maintenance
  oilBrand: z.string().optional(),
  lastOilChange: z.string().optional(),
  lastOilChangeMileage: z.coerce.number<number>().min(0, "Quilometragem deve ser positiva").optional(),
  oilChangeInterval: z.coerce.number<number>().min(1000, "Intervalo deve ser pelo menos 1000 km").optional(),
  tireBrand: z.string().optional(),
  lastTireChange: z.string().optional(),
  lastTireChangeMileage: z.coerce.number<number>().min(0, "Quilometragem deve ser positiva").optional(),
  tireChangeInterval: z.coerce.number<number>().min(10000, "Intervalo deve ser pelo menos 10000 km").optional(),
  inspectionDue: z.string().optional(),
  iucDue: z.string().optional(),
  insuranceDue: z.string().optional(),
  registrationDate: z.string().optional(),
  imageUrl: z.string().optional().or(z.literal("")),
});

export default function VehicleDetailsModal({ vehicle: initialVehicle, isOpen, onClose, openInEditMode = false }: VehicleDetailsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Fetch fresh vehicle data to ensure we have the latest information
  const { data: vehicle = initialVehicle } = useQuery<Vehicle>({
    queryKey: ["/api/vehicles", initialVehicle.id],
    enabled: isOpen,
  });

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowMaintenanceForm(false);
      setIsEditMode(false);
    }
  }, [isOpen]);

  // Set edit mode when openInEditMode is true
  useEffect(() => {
    if (isOpen && openInEditMode) {
      setIsEditMode(true);
    }
  }, [isOpen, openInEditMode]);

  const { data: maintenanceRecords = [], isLoading: recordsLoading } = useQuery<MaintenanceRecord[]>({
    queryKey: ["/api/vehicles", vehicle.id, "maintenance"],
    enabled: isOpen,
  });

  // Predictive maintenance POC

  const { data: predictiveStatus } = useQuery<{ oilRisk: number; tireRisk: number; inspectionRisk: number } | null>({
    queryKey: ["/api/vehicles", vehicle.id, "predictive-status"],
    enabled: isOpen,
        queryFn: () => get(`/api/vehicles/${vehicle.id}/predictive-status`),
  });

  const maintenanceForm = useForm({
    resolver: zodResolver(maintenanceFormSchema),
    defaultValues: {
      vehicleId: vehicle.id,
      type: "",
      description: "",
      mileage: vehicle.currentMileage,
      cost: 0,
      notes: "",
      performedAt: new Date().toISOString().slice(0, 16),
    },
  });

  const editVehicleForm = useForm({
    resolver: zodResolver(editVehicleFormSchema),
    defaultValues: {
      id: vehicle.id,
      userId: vehicle.userId,
      licensePlate: vehicle.licensePlate,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      fuelType: vehicle.fuelType || "",
      currentMileage: vehicle.currentMileage,
      oilBrand: vehicle.oilBrand || "",
      lastOilChange: vehicle.lastOilChange ? new Date(vehicle.lastOilChange).toISOString().slice(0, 10) : "",
      lastOilChangeMileage: vehicle.lastOilChangeMileage || 0,
      oilChangeInterval: vehicle.oilChangeInterval || 15000,
      tireBrand: vehicle.tireBrand || "",
      lastTireChange: vehicle.lastTireChange ? new Date(vehicle.lastTireChange).toISOString().slice(0, 10) : "",
      lastTireChangeMileage: vehicle.lastTireChangeMileage || 0,
      tireChangeInterval: vehicle.tireChangeInterval || 50000,
      inspectionDue: vehicle.inspectionDue ? new Date(vehicle.inspectionDue).toISOString().slice(0, 10) : "",
      iucDue: vehicle.iucDue ? new Date(vehicle.iucDue).toISOString().slice(0, 10) : "",
      insuranceDue: vehicle.insuranceDue ? new Date(vehicle.insuranceDue).toISOString().slice(0, 10) : "",
      imageUrl: vehicle.imageUrl || "",
    },
  });

  // Reset forms when vehicle data changes
  useEffect(() => {
    if (vehicle) {
      maintenanceForm.reset({
        vehicleId: vehicle.id,
        type: "",
        description: "",
        mileage: vehicle.currentMileage,
        cost: 0,
        notes: "",
        performedAt: new Date().toISOString().slice(0, 16),
      });

      editVehicleForm.reset({
        id: vehicle.id,
        userId: vehicle.userId,
        licensePlate: vehicle.licensePlate,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        fuelType: vehicle.fuelType || "",
        currentMileage: vehicle.currentMileage,
        oilBrand: vehicle.oilBrand || "",
        lastOilChange: vehicle.lastOilChange ? new Date(vehicle.lastOilChange).toISOString().slice(0, 10) : "",
        lastOilChangeMileage: vehicle.lastOilChangeMileage || 0,
        oilChangeInterval: vehicle.oilChangeInterval || 15000,
        tireBrand: vehicle.tireBrand || "",
        lastTireChange: vehicle.lastTireChange ? new Date(vehicle.lastTireChange).toISOString().slice(0, 10) : "",
        lastTireChangeMileage: vehicle.lastTireChangeMileage || 0,
        tireChangeInterval: vehicle.tireChangeInterval || 50000,
        inspectionDue: vehicle.inspectionDue ? new Date(vehicle.inspectionDue).toISOString().slice(0, 10) : "",
        iucDue: vehicle.iucDue ? new Date(vehicle.iucDue).toISOString().slice(0, 10) : "",
        insuranceDue: vehicle.insuranceDue ? new Date(vehicle.insuranceDue).toISOString().slice(0, 10) : "",
        imageUrl: vehicle.imageUrl || "",
      });
    }
  }, [vehicle, maintenanceForm, editVehicleForm]);

  const addMaintenanceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof maintenanceFormSchema>) => {
            // cost is a DECIMAL column: the server expects it as a string
      return post(`/api/vehicles/${vehicle.id}/maintenance`, {
        ...data,
        cost: data.cost === undefined ? undefined : String(data.cost),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", vehicle.id, "maintenance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Manutenção adicionada",
        description: "Registo de manutenção adicionado com sucesso!",
      });
      maintenanceForm.reset();
      setShowMaintenanceForm(false);
    },
        onError: (error) => {
      toast({
        title: "Erro",
        description: handleApiError(error, "Erro ao adicionar manutenção. Tente novamente."),
        variant: "destructive",
      });
    },
  });

  const updateVehicleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editVehicleFormSchema>) => {
            // id/userId are never sent: the server does not allow changing them
      const { id, userId, ...changes } = data;
      return patch(`/api/vehicles/${vehicle.id}`, changes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", vehicle.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Veículo atualizado",
        description: "Dados do veículo atualizados com sucesso!",
      });
      setIsEditMode(false);
    },
        onError: (error) => {
      toast({
        title: "Erro",
        description: handleApiError(error, "Erro ao atualizar veículo. Tente novamente."),
        variant: "destructive",
      });
    },
  });

  const calculateProgress = (lastMileage: number | null, interval: number, current: number) => {
    if (!lastMileage) return 0;
    const kmsSince = current - lastMileage;
    return Math.min((kmsSince / interval) * 100, 100);
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 85) return 'bg-destructive';
    if (progress >= 70) return 'bg-yellow-500';
    return 'bg-secondary';
  };

  const oilProgress = calculateProgress(
    vehicle.lastOilChangeMileage ?? null, 
    vehicle.oilChangeInterval || 15000, 
    vehicle.currentMileage
  );
  
  const tireProgress = calculateProgress(
    vehicle.lastTireChangeMileage ?? null, 
    vehicle.tireChangeInterval || 50000, 
    vehicle.currentMileage
  );

    const MAINTENANCE_ICONS: Record<string, [LucideIcon, string]> = {
    oil_change: [Droplet, 'text-secondary'],
    tire_change: [CircleDot, 'text-primary'],
    inspection: [ClipboardCheck, 'text-accent'],
    repair: [Wrench, 'text-destructive'],
  };

  const onMaintenanceSubmit = (data: z.infer<typeof maintenanceFormSchema>) => {
    addMaintenanceMutation.mutate(data);
  };

  const onEditSubmit = (data: z.infer<typeof editVehicleFormSchema>) => {
    // Clean the data before sending to avoid validation issues
    const cleanedData = {
      ...data,
      imageUrl: data.imageUrl === "" ? undefined : data.imageUrl,
    };
    updateVehicleMutation.mutate(cleanedData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden">
  <DialogHeader className="sticky top-0 z-20 bg-background/95/90 backdrop-blur-sm px-4 sm:px-6 pt-6">
          <DialogTitle className="flex flex-col sm:flex-row items-center sm:items-start sm:space-x-4 space-y-2 sm:space-y-0">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center flex-shrink-0 mx-auto sm:mx-0">
              <Car className="w-5 h-5 text-primary-foreground" aria-hidden="true" />
            </div>
            <div className="min-w-0 w-full sm:w-auto text-center sm:text-left">
              <h3 className="text-lg sm:text-xl font-semibold whitespace-normal break-words max-w-[48rem] leading-snug" data-testid="text-vehicle-details-title">
                {vehicle.brand} {vehicle.model}
              </h3>
              <p className="text-muted-foreground" data-testid="text-vehicle-details-plate">
                {vehicle.licensePlate}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Vehicle Info */}
              <Card>
                <CardContent className="p-4 max-[504px]:p-1 max-[420px]:p-2 space-y-3 text-xxs max-[504px]:text-xxs max-[420px]:text-xs sm:text-sm md:text-base min-w-0">
                  <h4 className="font-semibold text-xxs max-[504px]:text-xxs max-[420px]:text-xs sm:text-sm uppercase tracking-wide text-muted-foreground">
                    Informações do Veículo
                  </h4>
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-xxs max-[504px]:text-xxs max-[420px]:text-xs sm:text-sm text-muted-foreground">Ano:</span>
                      <span className="text-xxs max-[504px]:text-xxs max-[420px]:text-xs sm:text-sm font-medium mt-1 sm:mt-0 text-right sm:text-left break-words min-w-0" data-testid="text-vehicle-year">
                        {vehicle.year}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-xxs max-[504px]:text-xxs max-[420px]:text-xs sm:text-sm text-muted-foreground">Combustível:</span>
                      <span className="text-xxs max-[504px]:text-xxs max-[420px]:text-xs sm:text-sm font-medium mt-1 sm:mt-0 text-right sm:text-left break-words min-w-0" data-testid="text-vehicle-fuel">
                        {vehicle.fuelType || 'N/A'}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-xxs max-[504px]:text-xxs max-[420px]:text-xs sm:text-sm text-muted-foreground">KMs Atuais:</span>
                      <span className="text-xxs max-[504px]:text-xxs max-[420px]:text-xs sm:text-sm font-medium mt-1 sm:mt-0 text-right sm:text-left break-words min-w-0" data-testid="text-vehicle-mileage">
                        {vehicle.currentMileage?.toLocaleString() || '0'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Maintenance Status */}
              <Card>
                <CardContent className="p-4 max-[504px]:p-1 max-[420px]:p-2 space-y-3 text-xxs max-[504px]:text-xxs max-[420px]:text-xs sm:text-sm md:text-base min-w-0">
                  <h4 className="font-semibold text-xxs max-[504px]:text-xxs max-[420px]:text-xs sm:text-sm uppercase tracking-wide text-muted-foreground">
                    Estado da Manutenção
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center mb-1">
                        <span className="text-xxs max-[504px]:text-xxs max-[420px]:text-xs sm:text-sm font-medium">Óleo</span>
                        <span className={`text-xxs max-[504px]:text-xxs ${oilProgress >= 85 ? 'text-destructive' : oilProgress >= 70 ? 'text-yellow-600' : 'text-secondary'}`}>
                          {oilProgress >= 85 ? 'Urgente' : oilProgress >= 70 ? 'Cuidado' : 'Bom'}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className={`${getProgressColor(oilProgress)} h-2 rounded-full transition-all duration-300`}
                          style={{ width: `${oilProgress}%` }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center mb-1">
                        <span className="text-xxs max-[504px]:text-xxs max-[420px]:text-xs sm:text-sm font-medium">Pneus</span>
                        <span className={`text-xxs max-[504px]:text-xxs ${tireProgress >= 85 ? 'text-destructive' : tireProgress >= 70 ? 'text-yellow-600' : 'text-secondary'}`}>
                          {tireProgress >= 85 ? 'Urgente' : tireProgress >= 70 ? 'Cuidado' : 'Bom'}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className={`${getProgressColor(tireProgress)} h-2 rounded-full transition-all duration-300`}
                          style={{ width: `${tireProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Predictive POC Card */}
              <Card>
                <CardContent className="p-4 space-y-2">
                  <h4 className="font-semibold text-xxs uppercase tracking-wide text-muted-foreground">Previsão de Manutenção (POC)</h4>
                  {predictiveStatus ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Óleo</span>
                        <span className="font-medium">{Math.round(predictiveStatus.oilRisk * 100)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-accent h-2 rounded-full" style={{ width: `${predictiveStatus.oilRisk * 100}%` }} />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm">Pneus</span>
                        <span className="font-medium">{Math.round(predictiveStatus.tireRisk * 100)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-accent h-2 rounded-full" style={{ width: `${predictiveStatus.tireRisk * 100}%` }} />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm">Inspeção</span>
                        <span className="font-medium">{Math.round(predictiveStatus.inspectionRisk * 100)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-accent h-2 rounded-full" style={{ width: `${predictiveStatus.inspectionRisk * 100}%` }} />
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Sem dados de previsão.</p>
                  )}
                </CardContent>
              </Card>

              {/* Important Dates */}
              <Card>
                <CardContent className="p-4 max-[504px]:p-1 max-[420px]:p-2 space-y-3 text-xxs max-[504px]:text-xxs max-[420px]:text-xs sm:text-sm md:text-base min-w-0">
                  <h4 className="font-semibold text-xxs max-[504px]:text-xxs max-[420px]:text-xs sm:text-sm uppercase tracking-wide text-muted-foreground">
                    Datas Importantes
                  </h4>
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-xxs max-[504px]:text-xxs max-[420px]:text-xs sm:text-sm text-muted-foreground">Inspeção:</span>
                      <span className="text-xxs max-[504px]:text-xxs max-[420px]:text-xs sm:text-sm font-medium mt-1 sm:mt-0 text-right sm:text-left break-words min-w-0" data-testid="text-inspection-due">
                        {vehicle.inspectionDue ? 
                          new Date(vehicle.inspectionDue).toLocaleDateString('pt-PT') : 
                          'N/A'
                        }
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-xxs max-[504px]:text-xxs max-[420px]:text-xs sm:text-sm text-muted-foreground">IUC:</span>
                      <span className="text-xxs max-[504px]:text-xxs max-[420px]:text-xs sm:text-sm font-medium mt-1 sm:mt-0 text-right sm:text-left break-words min-w-0" data-testid="text-iuc-due">
                        {vehicle.iucDue ? 
                          new Date(vehicle.iucDue).toLocaleDateString('pt-PT') : 
                          'N/A'
                        }
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-xxs max-[504px]:text-xxs max-[420px]:text-xs sm:text-sm text-muted-foreground">Seguro:</span>
                      <span className="text-xxs max-[504px]:text-xxs max-[420px]:text-xs sm:text-sm font-medium mt-1 sm:mt-0 text-right sm:text-left break-words min-w-0" data-testid="text-insurance-due">
                        {vehicle.insuranceDue ? 
                          new Date(vehicle.insuranceDue).toLocaleDateString('pt-PT') : 
                          'N/A'
                        }
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border">
              <Button 
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90 w-full sm:w-auto max-[420px]:py-2"
                onClick={() => setShowMaintenanceForm(!showMaintenanceForm)}
                data-testid="button-add-maintenance"
              >
                                <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                Adicionar Manutenção
              </Button>
              <Button 
                className="bg-accent text-accent-foreground hover:bg-accent/90 w-full sm:w-auto max-[420px]:py-2"
                                data-testid="button-update-mileage"
                onClick={() => setIsEditMode(true)}
              >
                <Gauge className="w-4 h-4 mr-2" aria-hidden="true" />
                Atualizar KMs
              </Button>
              <Button 
                variant="outline"
                onClick={() => setIsEditMode(true)}
                data-testid="button-edit-vehicle"
                className="w-full sm:w-auto max-[420px]:py-2"
              >
                                <Pencil className="w-4 h-4 mr-2" aria-hidden="true" />
                Editar
              </Button>
              <Button variant="outline" asChild className="w-full sm:w-auto max-[420px]:py-2" data-testid="link-vehicle-page">
                <Link href={`/vehicle/${vehicle.id}`}>
                  <ExternalLink className="w-4 h-4 mr-2" aria-hidden="true" />
                  Ver página completa
                </Link>
              </Button>
            </div>

            {/* Add Maintenance Form */}
            {showMaintenanceForm && (
              <MaintenanceRecordForm form={maintenanceForm} onSubmit={onMaintenanceSubmit} onCancel={() => setShowMaintenanceForm(false)} isPending={addMaintenanceMutation.isPending} />
            )}

            {/* Edit Vehicle Form */}
            {isEditMode && (
              <VehicleEditForm form={editVehicleForm} onSubmit={onEditSubmit} onCancel={() => setIsEditMode(false)} isPending={updateVehicleMutation.isPending} />
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <h4 className="font-semibold">Histórico de Manutenções</h4>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recordsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-3 bg-muted/30 rounded-lg">
                    <div className="w-8 h-8 bg-muted rounded-lg animate-pulse"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded animate-pulse mb-1"></div>
                      <div className="h-3 bg-muted rounded animate-pulse w-2/3"></div>
                    </div>
                    <div className="w-16 h-4 bg-muted rounded animate-pulse"></div>
                  </div>
                ))
              ) : maintenanceRecords.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Wrench className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <p className="text-muted-foreground">Nenhuma manutenção registada</p>
                </div>
              ) : (
                maintenanceRecords.map((record: MaintenanceRecord) => (
                  <div key={record.id} className="flex items-center space-x-4 p-3 bg-muted/30 rounded-lg" data-testid={`maintenance-record-${record.id}`}>
                    <div className="w-8 h-8 bg-secondary/20 rounded-lg flex items-center justify-center">
                      {(() => {
                        const [Icon, color] = MAINTENANCE_ICONS[record.type] ?? [Settings, 'text-muted-foreground'];
                        return <Icon className={`w-5 h-5 ${color}`} aria-hidden="true" />;
                      })()}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm" data-testid={`text-maintenance-description-${record.id}`}>
                        {record.description}
                      </p>
                      <p className="text-xs text-muted-foreground" data-testid={`text-maintenance-date-${record.id}`}>
                        {new Date(record.performedAt).toLocaleDateString('pt-PT')}
                        {record.mileage && ` - ${record.mileage.toLocaleString()} km`}
                      </p>
                    </div>
                    {record.cost && (
                      <div className="text-right">
                        <p className="text-sm font-medium" data-testid={`text-maintenance-cost-${record.id}`}>
                          €{parseFloat(String(record.cost)).toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
