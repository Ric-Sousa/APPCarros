import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Car, AlertTriangle, Wrench, Gauge, Plus, FileSpreadsheet } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import StatsCard from "@/components/StatsCard";
import VehicleCard from "@/components/VehicleCard";
import AddVehicleModal from "@/components/AddVehicleModal";
import VehicleDetailsModal from "@/components/VehicleDetailsModal";
import RecentActivity from "@/components/RecentActivity";
import UpcomingMaintenance from "@/components/UpcomingMaintenance";
import FuelAlerts from "@/components/FuelAlerts";
import AttentionCard from "@/components/AttentionCard";
import OnboardingWizard from "@/components/OnboardingWizard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useVehicles, type VehicleWithRole } from "@/hooks/useVehicles";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Alert } from "@shared/schema";
import { daysUntil, formatNumber } from "@/lib/utils";
import { downloadProtected } from "@/lib/download";
import { toastApiError } from "@/lib/planLimit";

/** Dias até ao próximo prazo (inspeção/IUC/seguro) de todos os veículos. */
function daysToNextDeadline(vehicles: VehicleWithRole[]): number | null {
  const days = vehicles
    .flatMap((v) => [v.inspectionDue, v.iucDue, v.insuranceDue])
    .map((d) => daysUntil(d))
    .filter((d): d is number => d !== null && d >= 0);
  return days.length ? Math.min(...days) : null;
}

export default function Dashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isAddVehicleModalOpen, setIsAddVehicleModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleWithRole | null>(null);
  // Abre uma vez para contas novas e fica aberto até o utilizador o fechar (mesmo depois de o veículo aparecer)
  const [wizard, setWizard] = useState<"idle" | "open" | "closed">("idle");

  const { data: vehicles = [], isLoading: vehiclesLoading } = useVehicles();
  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalVehicles: number;
    totalAlerts: number;
    urgentAlerts: number;
    monthlyKms?: number;
  }>({ queryKey: ["/api/stats"] });
  const { data: alerts = [] } = useQuery<Alert[]>({ queryKey: ["/api/alerts"] });

  const hasVehicles = vehicles.length > 0;
  if (wizard === "idle" && !!user && !user.onboardedAt && !vehiclesLoading && !hasVehicles) setWizard("open");
  const nextDeadlineDays = daysToNextDeadline(vehicles);

  const downloadFleet = () =>
    downloadProtected("/api/reports/fleet.csv", "relatorio-frota.csv").catch((error) => toastApiError(toast, error));

  return (
    <Sidebar>
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6 sm:space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              {user?.firstName ? `Olá, ${user.firstName}` : "Dashboard"}
            </h1>
            <p className="mt-1 text-muted-foreground">Os seus veículos e prazos num só sítio</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {user?.plan === "business" && hasVehicles && (
              <Button variant="outline" onClick={downloadFleet}>
                <FileSpreadsheet className="w-4 h-4 mr-2" aria-hidden="true" /> Relatório da frota (CSV)
              </Button>
            )}
            <Button className="btn-primary" onClick={() => setIsAddVehicleModalOpen(true)} data-testid="button-add-vehicle">
              <Plus className="w-4 h-4 mr-2" aria-hidden="true" /> Adicionar Veículo
            </Button>
          </div>
        </div>

        <AttentionCard alerts={alerts} vehicles={vehicles} />

        {hasVehicles && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <StatsCard title="Total Veículos" value={String(stats?.totalVehicles ?? vehicles.length)} icon={Car} iconColor="text-primary" bgColor="bg-card" isLoading={statsLoading} />
            <StatsCard title="Alertas Ativos" value={String(stats?.totalAlerts ?? 0)} icon={AlertTriangle} iconColor="text-destructive" bgColor="bg-card" isLoading={statsLoading} />
            <StatsCard
              title="Próximo Prazo"
              value={nextDeadlineDays !== null ? (nextDeadlineDays === 0 ? "Hoje" : `${nextDeadlineDays} ${nextDeadlineDays === 1 ? "dia" : "dias"}`) : "—"}
              icon={Wrench}
              iconColor="text-primary"
              bgColor="bg-card"
              isLoading={vehiclesLoading}
            />
            <StatsCard title="KMs este Mês" value={formatNumber(stats?.monthlyKms ?? 0)} icon={Gauge} iconColor="text-primary" bgColor="bg-card" isLoading={statsLoading} />
          </div>
        )}

        {hasVehicles && <FuelAlerts />}

        <section aria-labelledby="vehicles-heading">
          <h2 id="vehicles-heading" className="text-xl font-semibold text-foreground mb-4">Os Meus Veículos</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {vehiclesLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-card rounded-xl border border-border overflow-hidden" aria-hidden="true">
                  <div className="aspect-[16/9] bg-muted animate-pulse" />
                  <div className="p-6 space-y-3">
                    <div className="h-4 bg-muted rounded animate-pulse" />
                    <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                    <div className="h-2 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ))
            ) : !hasVehicles ? (
              <div className="col-span-full">
                <Card className="text-center p-8 sm:p-12 bg-card border-border">
                  <CardContent>
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <Car className="w-7 h-7 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhum veículo registado</h3>
                    <p className="text-muted-foreground mb-4">Adicione o primeiro veículo e calculamos os prazos do IUC e da inspeção.</p>
                    <Button onClick={() => setIsAddVehicleModalOpen(true)} className="btn-primary" data-testid="button-add-first-vehicle">
                      <Plus className="w-4 h-4 mr-2" aria-hidden="true" /> Adicionar Primeiro Veículo
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              vehicles.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} onViewDetails={() => setSelectedVehicle(vehicle)} />
              ))
            )}
          </div>
        </section>

        {hasVehicles && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <UpcomingMaintenance />
            <RecentActivity />
          </div>
        )}

        <AddVehicleModal isOpen={isAddVehicleModalOpen} onClose={() => setIsAddVehicleModalOpen(false)} />
        <OnboardingWizard open={wizard === "open"} onClose={() => setWizard("closed")} />

        {selectedVehicle && (
          <VehicleDetailsModal vehicle={selectedVehicle} isOpen onClose={() => setSelectedVehicle(null)} />
        )}
      </div>
    </Sidebar>
  );
}
