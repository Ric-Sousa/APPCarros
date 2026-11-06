import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Plus, 
  Fuel, 
  TrendingUp, 
  Calendar, 
  MapPin, 
  Euro,
  BarChart3,
  Clock,
  Edit,
  Trash2
} from 'lucide-react';

import { useToast } from '@/hooks/use-toast';
import { post, put, del, handleApiError } from '@/lib/apiUtils';
import { fuelFormSchema, useFuelRecords } from '@/lib/fuelForm';
import FuelRecordFields from './FuelRecordFields';

import type { FuelRecord } from '@shared/schema';



interface VehicleFuelManagementProps {
  vehicleId: string;
  vehicleInfo: {
    brand: string;
    model: string;
    licensePlate: string;
    fuelType?: string;
  };
}

const VehicleFuelManagement: React.FC<VehicleFuelManagementProps> = ({ 
  vehicleId, 
  vehicleInfo 
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FuelRecord | null>(null);

  const form = useForm({
    resolver: zodResolver(fuelFormSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      mileage: 0,
      liters: 0,
      costPerLiter: 1.65,
      totalCost: 0,
      fuelType: vehicleInfo.fuelType || 'gasoline95',
      gasStationName: '',
      gasStationLocation: '',
      fullTank: false,
      notes: '',
    },
  });

  // Fetch fuel records for this vehicle
    const { data: fuelRecords = [], isLoading: recordsLoading } = useFuelRecords(vehicleId);

  // Calculate fuel statistics
  const fuelStats = React.useMemo(() => {
    if (fuelRecords.length < 2) return null;

    const sortedRecords = [...fuelRecords].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const totalLiters = sortedRecords.reduce((sum, record) => sum + Number(record.liters), 0);
    const totalCost = sortedRecords.reduce((sum, record) => sum + Number(record.totalCost), 0);
    const totalDistance = Number(sortedRecords[sortedRecords.length - 1].mileage) - Number(sortedRecords[0].mileage);
    
    const avgConsumption = totalDistance > 0 ? (totalLiters / totalDistance) * 100 : 0;
    const avgCostPerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;
    const avgCostPer100km = totalDistance > 0 ? (totalCost / totalDistance) * 100 : 0;

    return {
      totalRecords: sortedRecords.length,
      totalLiters: totalLiters.toFixed(1),
      totalCost: totalCost.toFixed(2),
      avgConsumption: avgConsumption.toFixed(1),
      avgCostPerLiter: avgCostPerLiter.toFixed(3),
      avgCostPer100km: avgCostPer100km.toFixed(2),
      lastFuelDate: sortedRecords[sortedRecords.length - 1]?.date,
      currentMileage: sortedRecords[sortedRecords.length - 1]?.mileage || 0,
    };
  }, [fuelRecords]);

  // Add fuel record mutation
  const addFuelRecord = useMutation({
    mutationFn: (data: any) => post('/api/fuel-records', { ...data, vehicleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fuel-records'] });
      form.reset();
      setIsAddModalOpen(false);
      toast({
        title: "Sucesso",
        description: "Registo de combustível adicionado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: handleApiError(error),
        variant: "destructive",
      });
    },
  });

  // Update fuel record mutation
  const updateFuelRecord = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => put(`/api/fuel-records/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fuel-records'] });
      form.reset();
      setIsEditModalOpen(false);
      setEditingRecord(null);
      toast({
        title: "Sucesso",
        description: "Registo atualizado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: handleApiError(error),
        variant: "destructive",
      });
    },
  });

  // Delete fuel record mutation
  const deleteFuelRecord = useMutation({
    mutationFn: (recordId: string) => del(`/api/fuel-records/${recordId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fuel-records'] });
      toast({
        title: "Sucesso",
        description: "Registo eliminado com sucesso.",
      });
    },
    onError: (error: any) => {
      
      toast({
        title: "Erro",
        description: handleApiError(error),
        variant: "destructive",
      });
    },
  });

  const handleDeleteRecord = (recordId: string) => {
    if (window.confirm('Tem a certeza que pretende eliminar este registo? Esta ação não pode ser desfeita.')) {
      deleteFuelRecord.mutate(recordId);
    }
  };

  const onSubmit = (data: any) => {
    if (editingRecord) {
      updateFuelRecord.mutate({ id: editingRecord.id, data: { ...data, vehicleId } });
    } else {
      addFuelRecord.mutate(data);
    }
  };

  const openEditModal = (record: FuelRecord) => {
    setEditingRecord(record);
    // Pre-populate form with existing data
    form.reset({
      date: new Date(record.date).toISOString().split('T')[0],
      mileage: Number(record.mileage),
      liters: Number(record.liters),
      costPerLiter: Number(record.costPerLiter),
      totalCost: Number(record.totalCost),
      fuelType: record.fuelType,
      gasStationName: record.gasStationName || '',
      gasStationLocation: record.gasStationLocation || '',
      fullTank: record.fullTank,
      notes: record.notes || '',
    });
    setIsEditModalOpen(true);
  };

  const closeModal = () => {
    form.reset({
      date: new Date().toISOString().split('T')[0],
      mileage: 0,
      liters: 0,
      costPerLiter: 1.65,
      totalCost: 0,
      fuelType: vehicleInfo.fuelType || 'gasoline95',
      gasStationName: '',
      gasStationLocation: '',
      fullTank: false,
      notes: '',
    });
    setEditingRecord(null);
    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
  };

  // Auto-calculate total cost when liters or cost per liter changes
  React.useEffect(() => {
    const liters = form.watch('liters');
    const costPerLiter = form.watch('costPerLiter');
    if (liters && costPerLiter) {
      form.setValue('totalCost', Number((liters * costPerLiter).toFixed(2)));
    }
  }, [form.watch('liters'), form.watch('costPerLiter'), form]);

  return (
    <div className="space-y-6">
      {/* Header with vehicle info and add button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            Gestão de Combustível - {vehicleInfo.brand} {vehicleInfo.model}
          </h3>
          <p className="text-sm text-gray-600">{vehicleInfo.licensePlate}</p>
        </div>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Abastecimento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Registo de Combustível</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FuelRecordFields form={form} />
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={closeModal}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={addFuelRecord.isPending}>
                    {addFuelRecord.isPending ? "A guardar..." : "Guardar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Registo de Combustível</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FuelRecordFields form={form} />
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={closeModal}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={updateFuelRecord.isPending}>
                    {updateFuelRecord.isPending ? "Atualizando..." : "Atualizar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      {fuelStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">Consumo Médio</p>
                  <p className="text-xl font-bold">{fuelStats.avgConsumption} L/100km</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Euro className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600">Custo Total</p>
                  <p className="text-xl font-bold">€{fuelStats.totalCost}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Fuel className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm text-gray-600">Total Litros</p>
                  <p className="text-xl font-bold">{fuelStats.totalLiters} L</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm text-gray-600">Custo/100km</p>
                  <p className="text-xl font-bold">€{fuelStats.avgCostPer100km}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fuel Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Histórico de Abastecimentos ({fuelRecords.length} registos)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recordsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-gray-600">A carregar registos...</p>
            </div>
          ) : fuelRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Fuel className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum registo de combustível</p>
              <p className="text-sm">Adicione o primeiro abastecimento</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Data</th>
                    <th className="text-left p-2">Km</th>
                    <th className="text-left p-2">Litros</th>
                    <th className="text-left p-2">€/L</th>
                    <th className="text-left p-2">Total</th>
                    <th className="text-left p-2">Posto</th>
                    <th className="text-left p-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {fuelRecords
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((record) => (
                    <tr key={record.id} className="border-b hover:bg-gray-50">
                      <td className="p-2">
                        {new Date(record.date).toLocaleDateString('pt-PT')}
                      </td>
                      <td className="p-2">{Number(record.mileage).toLocaleString()}</td>
                      <td className="p-2">{Number(record.liters).toFixed(1)}L</td>
                      <td className="p-2">€{Number(record.costPerLiter).toFixed(3)}</td>
                      <td className="p-2 font-medium">€{Number(record.totalCost).toFixed(2)}</td>
                      <td className="p-2">
                        <div>
                          {record.gasStationName && (
                            <span className="text-sm font-medium">{record.gasStationName}</span>
                          )}
                          {record.gasStationLocation && (
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {record.gasStationLocation}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 w-7 p-0"
                            onClick={() => openEditModal(record)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteRecord(record.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VehicleFuelManagement;
