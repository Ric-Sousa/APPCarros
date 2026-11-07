import { useState } from "react";
import { Bell } from "lucide-react";
import type { Alert } from "@shared/schema";

interface AlertsPanelProps {
  alerts: Alert[];
}

export default function AlertsPanel({ alerts }: AlertsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  if (alerts.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="bg-gradient-to-r from-destructive/10 to-destructive/5 border border-destructive/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-destructive/20 rounded-full flex items-center justify-center">
              <Bell className="w-4 h-4 text-destructive" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Alertas Importantes</h3>
              <p className="text-sm text-muted-foreground">
                {alerts.length} {alerts.length === 1 ? 'prazo requer' : 'prazos requerem'} atenção imediata
              </p>
            </div>
          </div>
          <button 
            className="text-destructive hover:text-destructive/80 font-medium text-sm"
            data-testid="button-view-all-alerts"
            aria-expanded={expanded}
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? 'Ocultar' : 'Ver Todos'}
          </button>
        </div>
        {expanded && (
          <ul className="mt-4 space-y-2">
            {alerts.map((alert) => (
              <li key={alert.id} className="text-sm">
                <span className="font-medium text-foreground">{alert.title}</span>
                {alert.description && <span className="text-muted-foreground"> — {alert.description}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
