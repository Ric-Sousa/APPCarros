import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  iconColor: string;
  bgColor: string;
  isLoading?: boolean;
}

/** Indicador compacto: em telemóvel cabem dois por linha. */
export default function StatsCard({ title, value, icon: Icon, iconColor, bgColor, isLoading }: StatsCardProps) {
  const slug = title.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="bg-card rounded-lg p-3 sm:p-6 border border-border hover-scale min-w-0" data-testid={`card-${slug}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs sm:text-sm font-medium truncate">{title}</p>
          {isLoading ? (
            <div className="h-7 w-14 bg-muted rounded animate-pulse mt-1" />
          ) : (
            <p className="text-xl sm:text-2xl font-bold truncate" data-testid={`text-${slug}-value`}>{value}</p>
          )}
        </div>
        <div className={`hidden sm:flex w-12 h-12 ${bgColor} rounded-lg items-center justify-center shrink-0`}>
          <Icon className={`${iconColor} w-5 h-5`} aria-hidden="true" />
        </div>
        <Icon className={`sm:hidden ${iconColor} w-4 h-4 shrink-0`} aria-hidden="true" />
      </div>
    </div>
  );
}
