import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  iconColor: string;
  bgColor: string;
  isLoading?: boolean;
}

export default function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  iconColor, 
  bgColor, 
  isLoading 
}: StatsCardProps) {
  return (
    <div className="bg-card rounded-lg p-6 border border-border hover-scale" data-testid={`card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm font-medium">{title}</p>
          {isLoading ? (
            <div className="h-8 w-16 bg-muted rounded animate-pulse mt-1"></div>
          ) : (
            <p className="text-2xl font-bold" data-testid={`text-${title.toLowerCase().replace(/\s+/g, '-')}-value`}>
              {value}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 ${bgColor} rounded-lg flex items-center justify-center`}>
          <Icon className={`${iconColor} w-5 h-5`} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
