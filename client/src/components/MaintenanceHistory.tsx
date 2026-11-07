import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MaintenanceRecord, Vehicle } from '@shared/schema';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle, CalendarClock, CalendarIcon, Euro, Plus, Wrench } from 'lucide-react';
import { handleApiError } from '@/lib/apiUtils';
import { formatDate, formatEuro, formatNumber } from '@/lib/utils';
import { maintenanceBadge, maintenanceLabel } from '@/lib/maintenance';
import MaintenanceRecordForm from './MaintenanceRecordForm';
import AppointmentsList from './AppointmentsList';
import MaintenanceAppointmentModal from './MaintenanceAppointmentModal';

export default function MaintenanceHistory({ vehicle }: { vehicle: Vehicle }) {
  const { data: records = [], isLoading, error } = useQuery<MaintenanceRecord[]>({ queryKey: ['/api/vehicles', vehicle.id, 'maintenance'] });
  const [showAdd, setShowAdd] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5" aria-hidden="true" />
                Marcações
              </CardTitle>
              <CardDescription>Manutenções agendadas para este veículo</CardDescription>
            </div>
            <Button variant="outline" onClick={() => setShowSchedule(true)} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Agendar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <AppointmentsList vehicleId={vehicle.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" aria-hidden="true" />
                Histórico de Manutenção
              </CardTitle>
              <CardDescription>Registo completo de todas as manutenções realizadas</CardDescription>
            </div>
            <Button onClick={() => setShowAdd(true)} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Adicionar Registo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{handleApiError(error)}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <p className="text-center text-muted-foreground" role="status">A carregar histórico...</p>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
              <p>Ainda não há registos de manutenção para este veículo.</p>
              <p className="text-sm">Adicione o primeiro registo com o botão acima.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {records.map((record) => (
                <div key={record.id} className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-sm break-words">{record.description}</h3>
                        <Badge className={`text-xs ${maintenanceBadge(record.type)}`}>{maintenanceLabel(record.type)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <CalendarIcon className="h-3 w-3" aria-hidden="true" />
                        {formatDate(record.performedAt)}
                      </p>
                    </div>
                    <div className="text-right text-sm shrink-0">
                      {Number(record.cost) > 0 && (
                        <p className="flex items-center gap-1 text-green-700 dark:text-green-400 font-medium">
                          <Euro className="h-3 w-3" aria-hidden="true" />
                          {formatEuro(record.cost)}
                        </p>
                      )}
                      {!!record.mileage && <p className="text-muted-foreground text-xs">{formatNumber(record.mileage)} km</p>}
                    </div>
                  </div>
                  {record.notes && <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded">{record.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Registo de Manutenção</DialogTitle>
            <DialogDescription>Adicione uma nova entrada ao histórico de manutenção</DialogDescription>
          </DialogHeader>
          {showAdd && <MaintenanceRecordForm vehicle={vehicle} onDone={() => setShowAdd(false)} />}
        </DialogContent>
      </Dialog>

      <MaintenanceAppointmentModal isOpen={showSchedule} onClose={() => setShowSchedule(false)} vehicle={vehicle} />
    </div>
  );
}
