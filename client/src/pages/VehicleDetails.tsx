import React from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image as ImageIcon } from 'lucide-react';
import { VehicleImagePicker } from '../components/VehicleImagePicker';
import { patch, handleApiError } from '../lib/apiUtils';
import { useToast } from '../hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ArrowLeft, Car, FileText, Wrench, BarChart3, Fuel, Brain, Wifi, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';
import { AlertCircle } from 'lucide-react';
import type { Vehicle } from '@shared/schema';

import DocumentUpload from '../components/DocumentUpload';
import DocumentList from '../components/DocumentList';
import MaintenanceHistory from '../components/MaintenanceHistory';
import ComparativeAnalysis from '../components/ComparativeAnalysis';
import { EnhancedRecommendations } from '../components/EnhancedRecommendations';
import VehicleFuelManagement from '../components/VehicleFuelManagement';
import IoTDashboard from '../components/IoTDashboard';
import ElectricVehicleHub from '../components/ElectricVehicleHub';

const VehicleDetails: React.FC = () => {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const [, navigate] = useLocation();
  const { data: vehicle, isLoading: loading, error } = useQuery<Vehicle>({
    queryKey: ['/api/vehicles', vehicleId],
    enabled: !!vehicleId,
  });
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

    const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'Não definido';
    return new Date(date).toLocaleDateString('pt-PT');
  };

  // Check if vehicle is electric
  const isElectricVehicle = (vehicle: Vehicle | undefined): boolean => {
    return vehicle?.fuelType === 'electric' || vehicle?.fuelType === 'Elétrico';
  };

  // Get fuel type display name
  const getFuelTypeDisplay = (fuelType: string | null | undefined): string => {
    const fuelTypes: { [key: string]: string } = {
      'electric': '⚡ Elétrico',
      'hybrid': '🔋 Híbrido',
      'gasoline95': '⛽ Gasolina 95',
      'gasoline98': '⛽ Gasolina 98',
      'diesel': '🛢️ Gasóleo',
      'lpg': '🔥 GPL',
      'cng': '💨 GNC'
    };
    return fuelTypes[fuelType || ''] || fuelType || 'Não especificado';
  };

  // Calculate grid columns based on whether vehicle is electric
  const getTabsGridCols = (): string => {
    return isElectricVehicle(vehicle) ? 'grid-cols-7' : 'grid-cols-6';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">A carregar detalhes do veículo...</div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error?.message || 'Veículo não encontrado'}
          </AlertDescription>
        </Alert>
        <Button 
          onClick={() => navigate('/dashboard')} 
          className="mt-4"
          variant="outline"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao Dashboard
        </Button>
      </div>
    );
  }

  return (
    <>
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            onClick={() => navigate('/dashboard')} 
            variant="outline" 
            size="sm"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {vehicle.brand} {vehicle.model}
            </h1>
            <p className="text-muted-foreground">
              {vehicle.licensePlate} • {vehicle.year} • {vehicle.currentMileage.toLocaleString()} km
            </p>
          </div>
        </div>
      </div>

      {/* Vehicle Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Informações do Veículo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="md:col-span-2 lg:col-span-1">
                {vehicle.imageUrl ? (
                  <img
                    src={vehicle.imageUrl}
                    alt={`${vehicle.brand} ${vehicle.model}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                ) : (
                  <div className="flex h-32 w-full items-center justify-center rounded-lg bg-muted">
                    <Car className="h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
                  </div>
                )}
                {vehicle.imageCredit && (
                  <a
                    href={vehicle.imageCreditUrl ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block truncate text-[11px] text-muted-foreground hover:underline"
                    title={vehicle.imageCredit}
                  >
                    {vehicle.imageCredit}
                  </a>
                )}
                <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setPickerOpen(true)} data-testid="button-change-photo">
                  <ImageIcon className="mr-1 h-4 w-4" aria-hidden="true" />
                  Mudar foto
                </Button>
                <VehicleImagePicker
                  open={pickerOpen}
                  onOpenChange={setPickerOpen}
                  vehicle={vehicle}
                  onSelect={async (photo) => {
                    try {
                      await patch(`/api/vehicles/${vehicle.id}`, photo);
                      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
                      toast({ title: 'Foto atualizada' });
                    } catch (error) {
                      toast({ title: 'Erro ao mudar a foto', description: handleApiError(error), variant: 'destructive' });
                    }
                  }}
                />
            </div>
            
            <div className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Tipo de Combustível</p>
                <p className="font-medium">{getFuelTypeDisplay(vehicle.fuelType)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Marca do Óleo</p>
                <p className="font-medium">{vehicle.oilBrand || 'Não especificado'}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Última Mudança de Óleo</p>
                <p className="font-medium">{formatDate(vehicle.lastOilChange)}</p>
                {vehicle.lastOilChangeMileage && (
                  <p className="text-xs text-muted-foreground">
                    {vehicle.lastOilChangeMileage.toLocaleString()} km
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Marca dos Pneus</p>
                <p className="font-medium">{vehicle.tireBrand || 'Não especificado'}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Inspeção</p>
                <p className="font-medium">{formatDate(vehicle.inspectionDue)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">IUC</p>
                <p className="font-medium">{formatDate(vehicle.iucDue)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Seguro</p>
                <p className="font-medium">{formatDate(vehicle.insuranceDue)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different sections */}
      <Tabs defaultValue="maintenance" className="space-y-4">
        <TabsList className={`grid w-full ${getTabsGridCols()}`}>
          <TabsTrigger value="maintenance" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Manutenção
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documentos
          </TabsTrigger>
          <TabsTrigger value="fuel" className="flex items-center gap-2">
            <Fuel className="h-4 w-4" />
            Combustível
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Análise
          </TabsTrigger>
          <TabsTrigger value="smart" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Inteligente
          </TabsTrigger>
          
          <TabsTrigger value="iot" className="flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            IoT
          </TabsTrigger>
          {isElectricVehicle(vehicle) && (
            <TabsTrigger value="electric" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Elétrico
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="maintenance" className="space-y-4">
          <MaintenanceHistory vehicleId={vehicle.id} />
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DocumentUpload vehicleId={vehicle.id} />
            <DocumentList vehicleId={vehicle.id} />
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <ComparativeAnalysis 
            vehicleId={vehicle.id}
            vehicleBrand={vehicle.brand}
            vehicleModel={vehicle.model}
            showFleetComparison={false}
          />
        </TabsContent>

        <TabsContent value="smart" className="space-y-4">
          <EnhancedRecommendations 
            vehicleId={vehicle.id}
            location="Porto"
          />
        </TabsContent>

        <TabsContent value="fuel" className="space-y-4">
          <VehicleFuelManagement 
            vehicleId={vehicle.id}
            vehicleInfo={{
              brand: vehicle.brand,
              model: vehicle.model,
              licensePlate: vehicle.licensePlate,
              fuelType: vehicle.fuelType || 'gasoline95'
            }}
          />
        </TabsContent>

        

        <TabsContent value="iot" className="space-y-4">
          <IoTDashboard vehicleId={vehicle.id} />
        </TabsContent>

        {isElectricVehicle(vehicle) && (
          <TabsContent value="electric" className="space-y-4">
            <ElectricVehicleHub vehicleId={vehicle.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
    </>
  );
};

export default VehicleDetails;
