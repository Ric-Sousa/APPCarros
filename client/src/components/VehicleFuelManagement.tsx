import { useMemo, useState } from 'react';
import { BarChart3, Calendar, Edit, Euro, Fuel, MapPin, Plus, Trash2, TrendingUp } from 'lucide-react';
import type { FuelRecord, Vehicle } from '@shared/schema';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import FuelRecordDialog from './FuelRecordDialog';
import { useUndoableDelete } from '@/hooks/useUndoableDelete';
import { computeFuelStats, FUEL_KEYS, useFuelRecords } from '@/lib/fuelForm';
import { formatDate, formatEuro, formatNumber } from '@/lib/utils';

function Stat({ icon: Icon, label, value, color }: { icon: typeof Fuel; label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${color}`} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Abastecimentos de um veículo: estatísticas, histórico, criar, editar e apagar. */
export default function VehicleFuelManagement({ vehicle }: { vehicle: Vehicle }) {
  const [dialog, setDialog] = useState<{ open: boolean; record: FuelRecord | null }>({ open: false, record: null });

  const { data: fuelRecords = [], isLoading } = useFuelRecords(vehicle.id);
  const stats = useMemo(() => computeFuelStats(fuelRecords), [fuelRecords]);
  // Cópia ordenada: nunca alterar o array da cache do React Query
  const sorted = useMemo(() => [...fuelRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [fuelRecords]);

  const remove = useUndoableDelete<FuelRecord>({
    queryKey: ['/api/fuel-records', vehicle.id],
    url: (id) => `/api/fuel-records/${id}`,
    message: 'Abastecimento eliminado',
    invalidate: FUEL_KEYS,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold break-words">Combustível — {vehicle.brand} {vehicle.model}</h3>
          <p className="text-sm text-muted-foreground">{vehicle.licensePlate}</p>
        </div>
        <Button onClick={() => setDialog({ open: true, record: null })} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" /> Adicionar Abastecimento
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat icon={BarChart3} color="text-blue-500" label="Consumo Médio" value={stats.avgConsumption != null ? `${formatNumber(stats.avgConsumption, 1)} L/100km` : '—'} />
          <Stat icon={Euro} color="text-green-500" label="Custo Total" value={formatEuro(stats.totalCost)} />
          <Stat icon={Fuel} color="text-orange-500" label="Total Litros" value={`${formatNumber(stats.totalLiters, 1)} L`} />
          <Stat icon={TrendingUp} color="text-purple-500" label="Custo/100km" value={stats.costPer100km != null ? formatEuro(stats.costPer100km) : '—'} />
        </div>
      )}
      {stats && stats.avgConsumption == null && (
        <p className="text-sm text-muted-foreground">Registe pelo menos 2 abastecimentos para calcular o consumo.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" aria-hidden="true" />
            Histórico de Abastecimentos ({fuelRecords.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground" role="status">A carregar registos...</p>
          ) : sorted.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Fuel className="h-12 w-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
              <p>Nenhum registo de combustível</p>
              <p className="text-sm">Adicione o primeiro abastecimento</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="p-2 font-medium">Data</th>
                    <th className="p-2 font-medium">Km</th>
                    <th className="p-2 font-medium">Litros</th>
                    <th className="p-2 font-medium">€/L</th>
                    <th className="p-2 font-medium">Total</th>
                    <th className="p-2 font-medium">Posto</th>
                    <th className="p-2 font-medium"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((record) => (
                    <tr key={record.id} className="border-b border-border hover:bg-muted/50">
                      <td className="p-2 whitespace-nowrap">
                        {formatDate(record.date)}
                        {record.fullTank && <Badge variant="secondary" className="ml-2 text-[10px]">Cheio</Badge>}
                      </td>
                      <td className="p-2">{formatNumber(record.mileage)}</td>
                      <td className="p-2">{formatNumber(record.liters, 1)} L</td>
                      <td className="p-2">{formatNumber(record.costPerLiter, 3)} €</td>
                      <td className="p-2 font-medium">{formatEuro(record.totalCost)}</td>
                      <td className="p-2">
                        {record.gasStationName && <span className="font-medium">{record.gasStationName}</span>}
                        {record.gasStationLocation && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" aria-hidden="true" /> {record.gasStationLocation}
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setDialog({ open: true, record })} aria-label={`Editar abastecimento de ${formatDate(record.date)}`}>
                            <Edit className="h-3 w-3" aria-hidden="true" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-destructive" onClick={() => remove(record)} aria-label={`Eliminar abastecimento de ${formatDate(record.date)}`}>
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
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

      <FuelRecordDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} record={dialog.record} vehicle={vehicle} />
    </div>
  );
}
