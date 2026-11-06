import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Calendar, CalendarIcon, Wrench, Plus, Euro, MapPin } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle } from 'lucide-react';
import { post, handleApiError } from '@/lib/apiUtils';

interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  type: string;
  description: string;
  mileage?: number;
  cost?: number;
  performedAt: string;
  notes?: string;
  createdAt: string;
}

interface MaintenanceHistoryProps {
  vehicleId: string;
}

const MaintenanceHistory: React.FC<MaintenanceHistoryProps> = ({ vehicleId }) => {
    const queryKey = ['/api/vehicles', vehicleId, 'maintenance'];
  const { data: records = [], isLoading: loading, error: loadError } = useQuery<MaintenanceRecord[]>({ queryKey });
  const [formError, setError] = useState<string>('');
  const error = formError || (loadError ? handleApiError(loadError) : '');
  const [showAddDialog, setShowAddDialog] = useState<boolean>(false);
  
  // Form state
  const [formData, setFormData] = useState({
    type: '',
    description: '',
    mileage: '',
    cost: '',
    performedAt: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState<boolean>(false);

  const maintenanceTypes = [
    { value: 'oil_change', label: 'Mudança de Óleo' },
    { value: 'tire_change', label: 'Mudança de Pneus' },
    { value: 'brake_service', label: 'Serviço de Travões' },
    { value: 'inspection', label: 'Inspeção' },
    { value: 'repair', label: 'Reparação' },
    { value: 'cleaning', label: 'Limpeza' },
    { value: 'other', label: 'Outro' }
  ];

  const typeColors: Record<string, string> = {
    oil_change: 'bg-blue-100 text-blue-800',
    tire_change: 'bg-green-100 text-green-800',
    brake_service: 'bg-red-100 text-red-800',
    inspection: 'bg-yellow-100 text-yellow-800',
    repair: 'bg-orange-100 text-orange-800',
    cleaning: 'bg-cyan-100 text-cyan-800',
    other: 'bg-gray-100 text-gray-800'
  };

  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.type || !formData.description || !formData.performedAt) {
      setError('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    // Validate date format
    const dateValue = new Date(formData.performedAt);
    if (isNaN(dateValue.getTime())) {
      setError('Por favor, insira uma data válida');
      return;
    }

    // Validate mileage if provided
    if (formData.mileage && (isNaN(parseInt(formData.mileage)) || parseInt(formData.mileage) < 0)) {
      setError('Por favor, insira uma quilometragem válida');
      return;
    }

    // Validate cost if provided
    if (formData.cost && formData.cost.trim() !== '' && (isNaN(parseFloat(formData.cost)) || parseFloat(formData.cost) < 0)) {
      setError('Por favor, insira um custo válido');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Prepare the payload
      const payload = {
        type: formData.type,
        description: formData.description,
        ...(formData.mileage && formData.mileage.trim() !== '' && { mileage: parseInt(formData.mileage) }),
        ...(formData.cost && formData.cost.trim() !== '' && { cost: formData.cost }),
        performedAt: new Date(formData.performedAt).toISOString(),
        ...(formData.notes && formData.notes.trim() !== '' && { notes: formData.notes })
      };
      
            await post(`/api/vehicles/${vehicleId}/maintenance`, payload);
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles', 'recent-maintenance'] });
      
      // Reset form
      setFormData({
        type: '',
        description: '',
        mileage: '',
        cost: '',
        performedAt: '',
        notes: ''
      });
      
      setShowAddDialog(false);
    } catch (error: any) {
      
      setError(handleApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-PT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getTypeLabel = (type: string) => {
    return maintenanceTypes.find(t => t.value === type)?.label || type;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">A carregar histórico...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Histórico de Manutenção
            </CardTitle>
            <CardDescription>
              Registo completo de todas as manutenções realizadas
            </CardDescription>
          </div>
          
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Registo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo Registo de Manutenção</DialogTitle>
                <DialogDescription>
                  Adicione uma nova entrada ao histórico de manutenção
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="type">Tipo de Manutenção*</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {maintenanceTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="description">Descrição*</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Ex: Mudança de óleo e filtro"
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="mileage">Quilometragem</Label>
                    <Input
                      id="mileage"
                      type="number"
                      value={formData.mileage}
                      onChange={(e) => setFormData(prev => ({ ...prev, mileage: e.target.value }))}
                      placeholder="Ex: 75000"
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="cost">Custo (€)</Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      value={formData.cost}
                      onChange={(e) => setFormData(prev => ({ ...prev, cost: e.target.value }))}
                      placeholder="Ex: 45.50"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="performedAt">Data da Manutenção*</Label>
                  <Input
                    id="performedAt"
                    type="date"
                    value={formData.performedAt}
                    onChange={(e) => setFormData(prev => ({ ...prev, performedAt: e.target.value }))}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Informações adicionais, peças utilizadas, etc."
                    className="mt-1"
                    rows={3}
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowAddDialog(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'A adicionar...' : 'Adicionar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {records.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Ainda não há registos de manutenção para este veículo.</p>
            <p className="text-sm">Adicione o primeiro registo clicando no botão acima.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((record) => (
              <div
                key={record.id}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm">{record.description}</h3>
                        <Badge className={`text-xs ${typeColors[record.type] || typeColors.other}`}>
                          {getTypeLabel(record.type)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <CalendarIcon className="h-3 w-3" />
                        {formatDate(record.performedAt)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right text-sm">
                    {record.cost && (
                      <p className="flex items-center gap-1 text-green-600 font-medium">
                        <Euro className="h-3 w-3" />
                        {formatCurrency(record.cost)}
                      </p>
                    )}
                    {record.mileage && (
                      <p className="text-muted-foreground text-xs">
                        {record.mileage.toLocaleString()} km
                      </p>
                    )}
                  </div>
                </div>
                
                {record.notes && (
                  <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded">
                    {record.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MaintenanceHistory;
