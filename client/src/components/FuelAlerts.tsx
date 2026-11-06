import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { AlertTriangle, Fuel, TrendingUp, Clock, MapPin } from 'lucide-react';
import { get } from '@/lib/apiUtils';
import { useVehicles } from '@/hooks/useVehicles';
import type { FuelRecord } from '@shared/schema';

interface FuelAlertsProps {
  vehicleId?: string;
  showAll?: boolean;
}

interface GeneratedAlert {
  id: string;
  type: 'low_fuel' | 'high_consumption' | 'maintenance_due';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  vehicleName: string;
  timestamp: string;
  actionRequired: boolean;
}

const FuelAlerts: React.FC<FuelAlertsProps> = ({ vehicleId, showAll = false }) => {
  // Fetch vehicles
    const { data: vehicles = [] } = useVehicles();

  // Fetch fuel records
    const { data: allFuelRecords = [] } = useQuery<FuelRecord[]>({
    queryKey: ['/api/fuel-records'],
    queryFn: () => get<FuelRecord[]>('/api/fuel-records'),
  });

  // Generate alerts based on real data
  const alerts = React.useMemo(() => {
    const generatedAlerts: GeneratedAlert[] = [];

    vehicles.forEach((vehicle) => {
      const vehicleRecords = allFuelRecords.filter(record => record.vehicleId === vehicle.id);
      const vehicleName = `${vehicle.brand} ${vehicle.model} - ${vehicle.licensePlate}`;

      if (vehicleRecords.length === 0) return;

      // Sort records by date
      const sortedRecords = vehicleRecords.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      const latestRecord = sortedRecords[0];
      const daysSinceLastFuel = Math.floor(
        (Date.now() - new Date(latestRecord.date).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Alert: Long time since last fuel
      if (daysSinceLastFuel > 10) {
        generatedAlerts.push({
          id: `fuel-time-${vehicle.id}`,
          type: 'low_fuel',
          severity: daysSinceLastFuel > 20 ? 'high' : 'medium',
          title: 'Há muito tempo sem abastecer',
          description: `Último abastecimento há ${daysSinceLastFuel} dias`,
          vehicleName,
          timestamp: new Date().toISOString(),
          actionRequired: daysSinceLastFuel > 20,
        });
      }

      // Alert: High consumption (if we have enough data)
      if (sortedRecords.length >= 3) {
        const recent3 = sortedRecords.slice(0, 3);
        const avgConsumption = recent3.reduce((sum, record, index) => {
          if (index === recent3.length - 1) return sum;
          const nextRecord = recent3[index + 1];
          const distance = Number(record.mileage) - Number(nextRecord.mileage);
          const consumption = distance > 0 ? (Number(record.liters) / distance) * 100 : 0;
          return sum + consumption;
        }, 0) / (recent3.length - 1);

        if (avgConsumption > 8) { // High consumption threshold
          generatedAlerts.push({
            id: `consumption-${vehicle.id}`,
            type: 'high_consumption',
            severity: avgConsumption > 10 ? 'high' : 'medium',
            title: 'Consumo elevado',
            description: `Consumo médio recente: ${avgConsumption.toFixed(1)}L/100km`,
            vehicleName,
            timestamp: new Date().toISOString(),
            actionRequired: false,
          });
        }
      }

            // Alert: oil change due, from the vehicle's own last change + interval (skipped when unknown)
      const currentMileage = Math.max(Number(latestRecord.mileage), vehicle.currentMileage || 0);
      const interval = vehicle.oilChangeInterval || 0;
      const kmSinceLastMaintenance = vehicle.lastOilChangeMileage != null ? currentMileage - vehicle.lastOilChangeMileage : 0;

      if (interval > 0 && kmSinceLastMaintenance > interval * 0.8) {
        generatedAlerts.push({
          id: `maintenance-${vehicle.id}`,
          type: 'maintenance_due',
          severity: kmSinceLastMaintenance >= interval ? 'high' : 'medium',
          title: 'Manutenção recomendada',
          description: `${kmSinceLastMaintenance.toLocaleString()}km desde a última mudança de óleo (intervalo: ${interval.toLocaleString()}km)`,
          vehicleName,
          timestamp: new Date().toISOString(),
          actionRequired: kmSinceLastMaintenance >= interval,
        });
      }
    });

    return generatedAlerts;
  }, [vehicles, allFuelRecords]);

  // Filter alerts by vehicle if specified
  const filteredAlerts = vehicleId 
    ? alerts.filter(alert => {
        const vehicle = vehicles.find(v => v.id === vehicleId);
        if (!vehicle) return false;
        const vehicleName = `${vehicle.brand} ${vehicle.model} - ${vehicle.licensePlate}`;
        return alert.vehicleName === vehicleName;
      })
    : alerts;

  // Sort and limit alerts
  const sortedAlerts = filteredAlerts.sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });

  const displayAlerts = showAll ? sortedAlerts : sortedAlerts.slice(0, 3);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'border-red-200 bg-red-50';
      case 'medium': return 'border-yellow-200 bg-yellow-50';
      case 'low': return 'border-blue-200 bg-blue-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getSeverityTextColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-700';
      case 'medium': return 'text-yellow-700';
      case 'low': return 'text-blue-700';
      default: return 'text-gray-700';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'low_fuel': return <Fuel className="h-5 w-5 text-red-500" />;
      case 'high_consumption': return <TrendingUp className="h-5 w-5 text-orange-500" />;
      case 'maintenance_due': return <Clock className="h-5 w-5 text-purple-500" />;
      default: return <AlertTriangle className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Há poucos minutos';
    if (diffInHours < 24) return `Há ${diffInHours}h`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `Há ${diffInDays} dia${diffInDays > 1 ? 's' : ''}`;
  };

  if (displayAlerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Alertas de Combustível
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Fuel className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum alerta ativo</p>
            <p className="text-sm">Tudo está a funcionar normalmente</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Alertas de Combustível
                        {displayAlerts.length > 0 && (
              <Badge variant="secondary">{displayAlerts.length}</Badge>
            )}
            <Badge variant="outline" title="Calculado a partir dos seus registos; não usa sensores do veículo">Estimativa</Badge>
          </CardTitle>
          {!showAll && filteredAlerts.length > 3 && (
            <Badge variant="outline">
              {filteredAlerts.length} total
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayAlerts.map((alert) => (
          <Alert key={alert.id} className={`${getSeverityColor(alert.severity)} border`}>
            <div className="flex items-start gap-3 w-full">
              {getAlertIcon(alert.type)}
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className={`font-medium ${getSeverityTextColor(alert.severity)}`}>
                    {alert.title}
                  </h4>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={alert.severity === 'high' ? 'destructive' : 
                              alert.severity === 'medium' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {alert.severity === 'high' ? 'Urgente' : 
                       alert.severity === 'medium' ? 'Médio' : 'Baixo'}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(alert.timestamp)}
                    </span>
                  </div>
                </div>
                
                <AlertDescription className={getSeverityTextColor(alert.severity)}>
                  {alert.description}
                </AlertDescription>
                
                <div className="text-xs text-gray-600">
                  <p>Veículo: <span className="font-medium">{alert.vehicleName}</span></p>
                </div>
                
                {alert.actionRequired && (
                  <div className="mt-3">
                    <span className="text-xs font-medium text-orange-600">⚠️ Ação requerida</span>
                  </div>
                )}
              </div>
            </div>
          </Alert>
        ))}
      </CardContent>
    </Card>
  );
};

export default FuelAlerts;
