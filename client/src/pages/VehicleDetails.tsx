import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, BarChart3, Brain, Car, FileText, Fuel, Image as ImageIcon, Wifi, Wrench, Zap } from 'lucide-react';
import type { Vehicle } from '@shared/schema';
import { fuelLabel, isElectric } from '@shared/fuel';
import { VehicleImagePicker } from '../components/VehicleImagePicker';
import { patch, handleApiError } from '../lib/apiUtils';
import { useToast } from '../hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { formatDate, formatNumber } from '../lib/utils';
import DocumentUpload from '../components/DocumentUpload';
import DocumentList from '../components/DocumentList';
import MaintenanceHistory from '../components/MaintenanceHistory';
import ComparativeAnalysis from '../components/ComparativeAnalysis';
import { EnhancedRecommendations } from '../components/EnhancedRecommendations';
import VehicleFuelManagement from '../components/VehicleFuelManagement';
import IoTDashboard from '../components/IoTDashboard';
import ElectricVehicleHub from '../components/ElectricVehicleHub';
import EVComparisonCalculator from '../components/EVComparisonCalculator';

function Field({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium break-words">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const TABS = [
  { value: 'maintenance', label: 'Manutenção', icon: Wrench },
  { value: 'documents', label: 'Documentos', icon: FileText },
  { value: 'fuel', label: 'Combustível', icon: Fuel },
  { value: 'analysis', label: 'Análise', icon: BarChart3 },
  { value: 'smart', label: 'Recomendações', icon: Brain },
  { value: 'iot', label: 'IoT', icon: Wifi },
  { value: 'electric', label: 'Elétrico', icon: Zap },
];

export default function VehicleDetails() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const [, navigate] = useLocation();
  const { data: vehicle, isLoading, error } = useQuery<Vehicle>({ queryKey: ['/api/vehicles', vehicleId], enabled: !!vehicleId });
  const [pickerOpen, setPickerOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (isLoading) {
    return <div className="container mx-auto p-6 text-center" role="status">A carregar detalhes do veículo...</div>;
  }

  if (error || !vehicle) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{error ? handleApiError(error) : 'Veículo não encontrado'}</AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/dashboard')} className="mt-4" variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" /> Voltar ao Dashboard
        </Button>
      </div>
    );
  }

  const electric = isElectric(vehicle.fuelType);

  return (
    <div className="container mx-auto px-4 py-6 sm:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={() => navigate('/dashboard')} variant="outline" size="sm" className="shrink-0">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" /> Voltar
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">{vehicle.brand} {vehicle.model}</h1>
          <p className="text-muted-foreground">{vehicle.licensePlate} • {vehicle.year} • {formatNumber(vehicle.currentMileage)} km</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" aria-hidden="true" /> Informações do Veículo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="md:col-span-2 lg:col-span-1">
              {vehicle.imageUrl ? (
                <img src={vehicle.imageUrl} alt={`${vehicle.brand} ${vehicle.model}`} className="w-full h-32 object-cover rounded-lg" />
              ) : (
                <div className="flex h-32 w-full items-center justify-center rounded-lg bg-muted">
                  <Car className="h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
                </div>
              )}
              {vehicle.imageCredit && (
                <a href={vehicle.imageCreditUrl ?? undefined} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-[11px] text-muted-foreground hover:underline" title={vehicle.imageCredit}>
                  {vehicle.imageCredit}
                </a>
              )}
              <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setPickerOpen(true)} data-testid="button-change-photo">
                <ImageIcon className="mr-1 h-4 w-4" aria-hidden="true" /> Mudar foto
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
                  } catch (err) {
                    toast({ title: 'Erro ao mudar a foto', description: handleApiError(err), variant: 'destructive' });
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Field label="Tipo de Combustível" value={fuelLabel(vehicle.fuelType)} />
              <Field label="Marca do Óleo" value={vehicle.oilBrand || 'Não especificado'} />
            </div>
            <div className="space-y-2">
              <Field
                label="Última Mudança de Óleo"
                value={formatDate(vehicle.lastOilChange)}
                sub={vehicle.lastOilChangeMileage ? `${formatNumber(vehicle.lastOilChangeMileage)} km` : undefined}
              />
              <Field label="Marca dos Pneus" value={vehicle.tireBrand || 'Não especificado'} />
            </div>
            <div className="space-y-2">
              <Field label="Inspeção" value={formatDate(vehicle.inspectionDue)} />
              <Field label="IUC" value={formatDate(vehicle.iucDue)} />
              <Field label="Seguro" value={formatDate(vehicle.insuranceDue)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="maintenance" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="flex items-center gap-2 shrink-0">
              <Icon className="h-4 w-4" aria-hidden="true" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="maintenance" className="space-y-4">
          <MaintenanceHistory vehicle={vehicle} />
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DocumentUpload vehicleId={vehicle.id} />
            <DocumentList vehicleId={vehicle.id} />
          </div>
        </TabsContent>

        <TabsContent value="fuel" className="space-y-4">
          <VehicleFuelManagement vehicle={vehicle} />
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <ComparativeAnalysis vehicleId={vehicle.id} vehicleBrand={vehicle.brand} vehicleModel={vehicle.model} />
        </TabsContent>

        <TabsContent value="smart" className="space-y-4">
          <EnhancedRecommendations vehicleId={vehicle.id} />
        </TabsContent>

        <TabsContent value="iot" className="space-y-4">
          <IoTDashboard vehicleId={vehicle.id} />
        </TabsContent>

        <TabsContent value="electric" className="space-y-4">
          {/* Elétricos: postos e carregamentos. Combustão: compensa mudar? */}
          {electric ? <ElectricVehicleHub vehicleId={vehicle.id} /> : <EVComparisonCalculator vehicleId={vehicle.id} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
