import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, BarChart3, Brain, Car, FileText, Fuel, Image as ImageIcon, LayoutDashboard, Share2, BookOpen, Wifi, Wrench, Zap } from 'lucide-react';
import { fuelLabel, isElectric } from '@shared/fuel';
import { VehicleImagePicker } from '../components/VehicleImagePicker';
import { patch, handleApiError } from '../lib/apiUtils';
import { useToast } from '../hooks/use-toast';
import { useConfig } from '../hooks/useConfig';
import { useVehicles, isOwner, type VehicleWithRole } from '../hooks/useVehicles';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { formatDate, formatNumber } from '../lib/utils';
import { toastApiError } from '../lib/planLimit';
import DocumentUpload from '../components/DocumentUpload';
import DocumentList from '../components/DocumentList';
import MaintenanceHistory from '../components/MaintenanceHistory';
import ComparativeAnalysis from '../components/ComparativeAnalysis';
import { EnhancedRecommendations } from '../components/EnhancedRecommendations';
import VehicleFuelManagement from '../components/VehicleFuelManagement';
import FuelPriceFinder from '../components/FuelPriceFinder';
import IoTDashboard from '../components/IoTDashboard';
import ElectricVehicleHub from '../components/ElectricVehicleHub';
import VehicleSummary from '../components/VehicleSummary';
import VehicleSharingDialog from '../components/VehicleSharingDialog';

export default function VehicleDetails() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const [, navigate] = useLocation();
  const config = useConfig();
  const { data: list = [] } = useVehicles();
  const { data, isLoading, error } = useQuery<VehicleWithRole>({ queryKey: ['/api/vehicles', vehicleId], enabled: !!vehicleId });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (isLoading) {
    return <div className="container mx-auto p-6 text-center" role="status">A carregar detalhes do veículo...</div>;
  }

  if (error || !data) {
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

  // O papel (dono/condutor) vem na lista de veículos; o detalhe pode não o trazer
  const fromList = list.find((v) => v.id === data.id);
  const vehicle: VehicleWithRole = { ...data, role: data.role ?? fromList?.role, ownerName: data.ownerName ?? fromList?.ownerName };
  const owner = isOwner(vehicle);
  const electric = isElectric(vehicle.fuelType);

  const tabs = [
    { value: 'summary', label: 'Resumo', icon: LayoutDashboard },
    { value: 'maintenance', label: 'Manutenção', icon: Wrench },
    { value: 'documents', label: 'Documentos', icon: FileText },
    { value: 'fuel', label: electric ? 'Energia' : 'Combustível', icon: electric ? Zap : Fuel },
    { value: 'analysis', label: 'Análise', icon: BarChart3 },
    { value: 'smart', label: 'Recomendações', icon: Brain },
    ...(electric ? [{ value: 'electric', label: 'Carregamento', icon: Zap }] : []),
    ...(config?.features.iot ? [{ value: 'iot', label: 'IoT', icon: Wifi }] : []),
  ];

  return (
    <div className="container mx-auto px-4 py-6 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => navigate('/dashboard')} variant="outline" size="sm" className="shrink-0">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" /> Voltar
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold break-words">{vehicle.brand} {vehicle.model}</h1>
          <p className="text-muted-foreground">
            {vehicle.licensePlate} • {vehicle.year} • {formatNumber(vehicle.currentMileage)} km • {fuelLabel(vehicle.fuelType)}
          </p>
          {!owner && (
            <Badge variant="secondary" className="mt-1">Partilhado{vehicle.ownerName ? ` por ${vehicle.ownerName}` : ''}</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/vehicle/${vehicle.id}/relatorio`} target="_blank" rel="noopener noreferrer">
              <BookOpen className="mr-1 h-4 w-4" aria-hidden="true" /> Livro de revisões (PDF)
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
            <Share2 className="mr-1 h-4 w-4" aria-hidden="true" /> {owner ? 'Partilhar' : 'Acesso'}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-start">
          <div className="w-full sm:w-64 shrink-0">
            {vehicle.imageUrl ? (
              <img src={vehicle.imageUrl} alt={`${vehicle.brand} ${vehicle.model}`} className="w-full aspect-[16/9] object-cover rounded-lg" decoding="async" />
            ) : (
              <div className="flex aspect-[16/9] w-full items-center justify-center rounded-lg bg-muted">
                <Car className="h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
              </div>
            )}
            {vehicle.imageCredit && (
              <a href={vehicle.imageCreditUrl ?? undefined} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-[11px] text-muted-foreground hover:underline" title={vehicle.imageCredit}>
                {vehicle.imageCredit}
              </a>
            )}
            {owner && (
              <>
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
                      toastApiError(toast, err, 'Erro ao mudar a foto');
                    }
                  }}
                />
              </>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm min-w-0">
            <div><dt className="text-muted-foreground">Óleo</dt><dd className="font-medium break-words">{vehicle.oilBrand || 'Não indicado'}</dd></div>
            <div><dt className="text-muted-foreground">Última mudança</dt><dd className="font-medium">{formatDate(vehicle.lastOilChange, '—')}</dd></div>
            <div><dt className="text-muted-foreground">Pneus</dt><dd className="font-medium break-words">{vehicle.tireBrand || 'Não indicado'}</dd></div>
            <div><dt className="text-muted-foreground">Matrícula desde</dt><dd className="font-medium">{formatDate(vehicle.registrationDate, '—')}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden">
          {tabs.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="flex items-center gap-2 shrink-0">
              <Icon className="h-4 w-4" aria-hidden="true" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="summary">
          <VehicleSummary vehicle={vehicle} onShare={() => setShareOpen(true)} />
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <MaintenanceHistory vehicle={vehicle} />
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DocumentUpload vehicleId={vehicle.id} />
            <DocumentList vehicleId={vehicle.id} />
          </div>
        </TabsContent>

        <TabsContent value="fuel" className="space-y-6">
          <VehicleFuelManagement vehicle={vehicle} />
          {!electric && <FuelPriceFinder fuelType={vehicle.fuelType} />}
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <ComparativeAnalysis vehicleId={vehicle.id} vehicleBrand={vehicle.brand} vehicleModel={vehicle.model} />
        </TabsContent>

        <TabsContent value="smart" className="space-y-4">
          <EnhancedRecommendations vehicleId={vehicle.id} />
        </TabsContent>

        {electric && (
          <TabsContent value="electric" className="space-y-4">
            <ElectricVehicleHub vehicleId={vehicle.id} />
          </TabsContent>
        )}

        {config?.features.iot && (
          <TabsContent value="iot" className="space-y-4">
            <IoTDashboard vehicleId={vehicle.id} />
          </TabsContent>
        )}
      </Tabs>

      <VehicleSharingDialog vehicle={vehicle} open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  );
}
