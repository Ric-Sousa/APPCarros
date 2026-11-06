import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Car, AlertTriangle, Wrench, Gauge, Plus } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import StatsCard from "@/components/StatsCard";
import AlertsPanel from "@/components/AlertsPanel";
import VehicleCard from "@/components/VehicleCard";
import AddVehicleModal from "@/components/AddVehicleModal";
import VehicleDetailsModal from "@/components/VehicleDetailsModal";
import RecentActivity from "@/components/RecentActivity";
import UpcomingMaintenance from "@/components/UpcomingMaintenance";
import FuelAlerts from "@/components/FuelAlerts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useVehicles } from "@/hooks/useVehicles";
import type { Vehicle, Alert } from "@shared/schema";

/** Days until the nearest future inspection/IUC/insurance date across all vehicles. */
function daysToNextDeadline(vehicles: Vehicle[]): number | null {
  const now = Date.now();
  const days = vehicles
    .flatMap((v) => [v.inspectionDue, v.iucDue, v.insuranceDue])
    .filter(Boolean)
    .map((d) => Math.ceil((new Date(d as any).getTime() - now) / 86_400_000))
    .filter((d) => d >= 0);
  return days.length ? Math.min(...days) : null;
}

export default function Dashboard() {
  const [isAddVehicleModalOpen, setIsAddVehicleModalOpen] = useState(false);
  const [isVehicleDetailsModalOpen, setIsVehicleDetailsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const { data: vehicles = [], isLoading: vehiclesLoading } = useVehicles();

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalVehicles: number;
    totalAlerts: number;
    urgentAlerts: number;
    monthlyKms?: number;
  }>({
    queryKey: ["/api/stats"],
  });

  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
  });

  const nextDeadlineDays = daysToNextDeadline(vehicles);

  const handleViewVehicleDetails = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setIsVehicleDetailsModalOpen(true);
  };

  const urgentAlerts = alerts.filter(alert => alert.priority === 'urgent');

  return (
    <Sidebar>
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                Dashboard
              </h1>
              <p className="mt-2 text-muted-foreground">
                Faça a gestão dos seus veículos e mantenha-se a par de tudo
              </p>
            </div>
            
            <Button 
              className="mt-4 lg:mt-0 btn-primary"
              onClick={() => setIsAddVehicleModalOpen(true)}
              data-testid="button-add-vehicle"
            >
              <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
              Adicionar Veículo
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Veículos"
            value={stats?.totalVehicles?.toString() || "0"}
            icon={Car}
            iconColor="text-primary"
            bgColor="bg-card"
            isLoading={statsLoading}
          />
          <StatsCard
            title="Alertas Ativos"
            value={stats?.totalAlerts?.toString() || "0"}
            icon={AlertTriangle}
            iconColor="text-destructive"
            bgColor="bg-card"
            isLoading={statsLoading}
          />
          <StatsCard
            title="Próxima Manutenção"
            value={nextDeadlineDays !== null ? `${nextDeadlineDays} dias` : "N/A"}
            icon={Wrench}
            iconColor="text-primary"
            bgColor="bg-card"
            isLoading={vehiclesLoading}
          />
          <StatsCard
            title="KMs este Mês"
            value={stats?.monthlyKms?.toLocaleString() || "0"}
            icon={Gauge}
            iconColor="text-primary"
            bgColor="bg-card"
            isLoading={statsLoading}
          />
        </div>

        {/* Alerts Section */}
        <div className="space-y-6 mb-8">
          {urgentAlerts.length > 0 && <AlertsPanel alerts={urgentAlerts} />}
          <FuelAlerts showAll={false} />
        </div>

        {/* Main Content - Vehicles Section */}
        <div className="mb-8">
          <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">
              Os Meus Veículos
            </h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {vehiclesLoading ? (
              // Loading skeletons
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="h-48 bg-muted animate-pulse"></div>
                  <div className="p-6">
                    <div className="h-4 bg-muted rounded animate-pulse mb-2"></div>
                    <div className="h-3 bg-muted rounded animate-pulse w-2/3 mb-4"></div>
                    <div className="space-y-3">
                      <div className="h-2 bg-muted rounded animate-pulse"></div>
                      <div className="h-2 bg-muted rounded animate-pulse"></div>
                      <div className="h-2 bg-muted rounded animate-pulse"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : vehicles.length === 0 ? (
              <div className="col-span-full">
                  <Card className="text-center p-12 bg-card border-border">
                    <CardContent>
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                        <Car className="w-7 h-7 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhum veículo registado</h3>
                      <p className="text-muted-foreground mb-4">
                        Comece por adicionar o seu primeiro veículo para começar a gerir a manutenção
                      </p>
                      <Button 
                        onClick={() => setIsAddVehicleModalOpen(true)}
                        className="btn-primary"
                        data-testid="button-add-first-vehicle"
                      >
                        <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                        Adicionar Primeiro Veículo
                      </Button>
                    </CardContent>
                  </Card>
              </div>
            ) : (
              vehicles.map((vehicle: Vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  onViewDetails={() => handleViewVehicleDetails(vehicle)}
                />
              ))
            )}
          </div>
        </div>

        {/* Recent Activity & Upcoming Maintenance - Below Vehicles */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <UpcomingMaintenance />
          <RecentActivity />
        </div>

        {/* Modals */}
        <AddVehicleModal 
          isOpen={isAddVehicleModalOpen} 
          onClose={() => setIsAddVehicleModalOpen(false)} 
        />
        
        {selectedVehicle && (
          <VehicleDetailsModal
            vehicle={selectedVehicle}
            isOpen={isVehicleDetailsModalOpen}
            onClose={() => {
              setIsVehicleDetailsModalOpen(false);
              setSelectedVehicle(null);
            }}
          />
        )}
      </div>
    </Sidebar>
  );
}
