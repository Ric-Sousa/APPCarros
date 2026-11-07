// Tipos de manutenção (um só conjunto para todos os formulários e listas)

export const MAINTENANCE_TYPES = [
  { value: "oil_change", label: "Mudança de Óleo", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  { value: "tire_change", label: "Mudança de Pneus", badge: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  { value: "brake_service", label: "Serviço de Travões", badge: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  { value: "inspection", label: "Inspeção", badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
  { value: "repair", label: "Reparação", badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  { value: "cleaning", label: "Limpeza", badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300" },
  { value: "other", label: "Outro", badge: "bg-muted text-muted-foreground" },
] as const;

const find = (type: string) => MAINTENANCE_TYPES.find((t) => t.value === type);
export const maintenanceLabel = (type: string) => find(type)?.label ?? type;
export const maintenanceBadge = (type: string) => find(type)?.badge ?? "bg-muted text-muted-foreground";

/** Query keys invalidated after any maintenance/appointment change. */
export const MAINTENANCE_KEYS = [["/api/maintenance"], ["/api/vehicles"], ["/api/stats"], ["/api/alerts"], ["/api/appointments"]];
