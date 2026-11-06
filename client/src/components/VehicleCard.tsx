import type { Vehicle } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Car, Droplet, CircleDot, Calendar } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

interface VehicleCardProps {
  vehicle: Vehicle;
  onViewDetails: () => void;
}

export default function VehicleCard({ vehicle, onViewDetails }: VehicleCardProps) {
  const [imageError, setImageError] = useState(false);
  
  // Calculate maintenance progress percentages
  const calculateOilProgress = () => {
    if (!vehicle.lastOilChangeMileage || !vehicle.oilChangeInterval) return 0;
    const kmsSinceLastChange = vehicle.currentMileage - vehicle.lastOilChangeMileage;
    return Math.min((kmsSinceLastChange / vehicle.oilChangeInterval) * 100, 100);
  };

  const calculateTireProgress = () => {
    if (!vehicle.lastTireChangeMileage || !vehicle.tireChangeInterval) return 0;
    const kmsSinceLastChange = vehicle.currentMileage - vehicle.lastTireChangeMileage;
    return Math.min((kmsSinceLastChange / vehicle.tireChangeInterval) * 100, 100);
  };

  const calculateInspectionProgress = () => {
    if (!vehicle.inspectionDue) return 0;
    const now = new Date();
    const dueDate = new Date(vehicle.inspectionDue);
    const totalDays = 365; // Assume 1 year inspection cycle
    const daysLeft = Math.max(0, Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    return Math.min(((totalDays - daysLeft) / totalDays) * 100, 100);
  };

  const oilProgress = calculateOilProgress();
  const tireProgress = calculateTireProgress();
  const inspectionProgress = calculateInspectionProgress();

  const getProgressColor = (progress: number) => {
    if (progress >= 85) return 'bg-destructive';
    if (progress >= 70) return 'bg-accent';
    return 'bg-secondary';
  };

  const getStatusBadge = () => {
    const maxProgress = Math.max(oilProgress, tireProgress, inspectionProgress);
    if (maxProgress >= 85) return { text: 'Atenção', color: 'bg-destructive/90 text-destructive-foreground' };
    if (maxProgress >= 70) return { text: 'Cuidado', color: 'bg-accent/90 text-accent-foreground' };
    return { text: 'Em Dia', color: 'bg-secondary/90 text-secondary-foreground' };
  };

  const getAlertBadges = () => {
    const badges = [];
    if (oilProgress >= 85) badges.push({ icon: Droplet, text: 'Óleo' });
    if (tireProgress >= 85) badges.push({ icon: CircleDot, text: 'Pneus' });
    if (inspectionProgress >= 85) badges.push({ icon: Calendar, text: 'Inspeção' });
    return badges;
  };

  const status = getStatusBadge();
  const alertBadges = getAlertBadges();

  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden hover-scale group" data-testid={`card-vehicle-${vehicle.id}`}>
        <div className="relative h-48 bg-gradient-to-br from-primary/20 to-secondary/20">
          {vehicle.imageUrl && !imageError ? (
            <img
              src={vehicle.imageUrl}
              alt={`${vehicle.brand} ${vehicle.model}`}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : null}

          {/* Crédito obrigatório das fotos automáticas */}
          {vehicle.imageUrl && !imageError && vehicle.imageCredit && (
            <a
              href={vehicle.imageCreditUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-1 right-1 max-w-[95%] truncate rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white/80 hover:text-white"
              title={vehicle.imageCredit}
            >
              {vehicle.imageCredit}
            </a>
          )}
          
          {/* Fallback icon quando não há imagem ou falha ao carregar */}
          <div className={`absolute inset-0 flex items-center justify-center ${vehicle.imageUrl && !imageError ? 'hidden' : ''}`} id={`fallback-${vehicle.id}`}>
            <Car className="w-16 h-16 text-primary/30" />
          </div>
          
          {/* Status Badge */}
          <div className="absolute top-4 right-4">
            <span className={`${status.color} px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm`}>
              {status.text}
            </span>
          </div>

          {/* Alert Badges */}
          <div className="absolute top-4 left-4 space-y-1">
            {alertBadges.map((badge, index) => (
              <div key={index} className="bg-destructive/90 text-destructive-foreground px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm">
                <badge.icon className="w-3 h-3 mr-1 inline" aria-hidden="true" />
                {badge.text}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg text-foreground" data-testid={`text-vehicle-name-${vehicle.id}`}>
                {vehicle.brand} {vehicle.model}
              </h3>
              <p className="text-muted-foreground text-sm" data-testid={`text-license-plate-${vehicle.id}`}>
                {vehicle.licensePlate}
              </p>
            </div>
            <div className="text-right space-y-1">
              <div>
                <p className="text-sm text-muted-foreground">Ano</p>
                <p className="font-semibold text-foreground" data-testid={`text-vehicle-year-${vehicle.id}`}>
                  {vehicle.year}
                </p>
              </div>
              {vehicle.fuelType && (
                <div>
                  <p className="text-sm text-muted-foreground">Combustível</p>
                  <p className="font-medium text-sm text-foreground" data-testid={`text-fuel-type-${vehicle.id}`}>
                    {vehicle.fuelType}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Progress Indicators */}
          <div className="space-y-4 mb-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-foreground">Óleo do Motor</span>
                <span className="text-xs text-muted-foreground">
                  Próxima: {vehicle.lastOilChangeMileage ? 
                    (vehicle.lastOilChangeMileage + (vehicle.oilChangeInterval || 15000)).toLocaleString() : 
                    'N/A'
                  } km
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
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-foreground">Pneus</span>
                <span className="text-xs text-muted-foreground">
                  Próxima: {vehicle.lastTireChangeMileage ? 
                    (vehicle.lastTireChangeMileage + (vehicle.tireChangeInterval || 50000)).toLocaleString() : 
                    'N/A'
                  } km
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className={`${getProgressColor(tireProgress)} h-2 rounded-full transition-all duration-300`} 
                  style={{ width: `${tireProgress}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-foreground">Inspeção</span>
                <span className="text-xs text-muted-foreground">
                  {vehicle.inspectionDue ? 
                    new Date(vehicle.inspectionDue).toLocaleDateString('pt-PT') : 
                    'N/A'
                  }
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className={`${getProgressColor(inspectionProgress)} h-2 rounded-full transition-all duration-300`} 
                  style={{ width: `${inspectionProgress}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <Button 
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              onClick={onViewDetails}
              data-testid={`button-view-details-${vehicle.id}`}
            >
              Resumo
            </Button>
            <Button variant="outline" className="flex-1" asChild data-testid={`link-vehicle-page-${vehicle.id}`}>
              <Link href={`/vehicle/${vehicle.id}`}>Ver Detalhes</Link>
            </Button>
          </div>
        </div>
      </div>
      

    </>
  );
}
