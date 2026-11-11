import type { VehicleWithRole } from "@/hooks/useVehicles";
import { Button } from "@/components/ui/button";
import { Car, Droplet, CircleDot, Calendar } from "lucide-react";
import { fuelLabel } from "@shared/fuel";
import { daysUntil, formatDate, formatNumber } from "@/lib/utils";
import { Link } from "wouter";
import { useState } from "react";

interface VehicleCardProps {
  vehicle: VehicleWithRole;
  onViewDetails: () => void;
}

/**
 * Imagem mais leve para o cartão (~600 px): Unsplash aceita w/q na URL; nas miniaturas do Wikimedia
 * usa-se o passo padrão de 960 px quando a original é maior. Outras (fotos próprias) ficam como estão.
 */
export function cardImageUrl(url: string): string {
  if (url.includes("images.unsplash.com")) {
    const u = new URL(url);
    u.searchParams.set("w", "600");
    u.searchParams.set("q", "70");
    return u.toString();
  }
  if (url.includes("upload.wikimedia.org") || url.includes("thumb.wikimedia.org")) {
    return url.replace(/\/(\d+)px-/, (match, n) => (Number(n) > 960 ? "/960px-" : match));
  }
  return url;
}

export default function VehicleCard({ vehicle, onViewDetails }: VehicleCardProps) {
  const [imageError, setImageError] = useState(false);
  
  // Calculate maintenance progress percentages
  const calculateOilProgress = () => {
    if (vehicle.lastOilChangeMileage == null || !vehicle.oilChangeInterval) return 0;
    const kmsSinceLastChange = vehicle.currentMileage - vehicle.lastOilChangeMileage;
    return Math.min((kmsSinceLastChange / vehicle.oilChangeInterval) * 100, 100);
  };

  const calculateTireProgress = () => {
    if (vehicle.lastTireChangeMileage == null || !vehicle.tireChangeInterval) return 0;
    const kmsSinceLastChange = vehicle.currentMileage - vehicle.lastTireChangeMileage;
    return Math.min((kmsSinceLastChange / vehicle.tireChangeInterval) * 100, 100);
  };

  const calculateInspectionProgress = () => {
    const days = daysUntil(vehicle.inspectionDue);
    if (days === null) return 0;
    const totalDays = 365; // ciclo anual de inspeção
    const daysLeft = Math.max(0, days);
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
        <div className="relative aspect-[16/9] bg-gradient-to-br from-primary/20 to-secondary/20">
          {vehicle.imageUrl && !imageError ? (
            <img
              src={cardImageUrl(vehicle.imageUrl)}
              alt={`${vehicle.brand} ${vehicle.model}`}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              width={600}
              height={338}
              onError={() => setImageError(true)}
            />
          ) : null}

          {vehicle.role === 'driver' && (
            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">
              Partilhado{vehicle.ownerName ? ` por ${vehicle.ownerName}` : ''}
            </span>
          )}

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
            <Car className="w-16 h-16 text-primary/30" aria-hidden="true" />
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

        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
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
                    {fuelLabel(vehicle.fuelType)}
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
                  {vehicle.lastOilChangeMileage != null ? `Próxima: ${formatNumber(vehicle.lastOilChangeMileage + (vehicle.oilChangeInterval || 15000))} km` : 'Sem registo'}
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
                  {vehicle.lastTireChangeMileage != null ? `Próxima: ${formatNumber(vehicle.lastTireChangeMileage + (vehicle.tireChangeInterval || 50000))} km` : 'Sem registo'}
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
                  {formatDate(vehicle.inspectionDue, 'Sem data')}
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
