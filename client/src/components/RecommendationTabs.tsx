import { AlertTriangle, CheckCircle, Clock, Cloud, DollarSign, Fuel, Info, MapPin, TrendingDown, TrendingUp, Wrench } from 'lucide-react';
import { formatDate, formatEuro, formatNumber } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Separator } from './ui/separator';

/** Separadores das Recomendações Inteligentes (dados de /api/external/enhanced-recommendations). */

export interface AIRecommendation {
  type: 'maintenance' | 'efficiency' | 'cost_saving' | 'safety';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  estimatedSavings?: number;
  actionRequired: string;
  deadline?: string;
}

export interface EnhancedRecommendationsData {
  fuelOptimization: {
    cheapestStation: { station: string; location: string; gasoline95: number; gasoline98: number; diesel: number; distance: number; lastUpdated: string };
    potentialSavings: number;
    recommendations: string[];
  };
  weatherImpact: { temperature: number; humidity: number; condition: string; impact: 'low' | 'medium' | 'high'; recommendations: string[] };
  maintenanceCosts: {
    oilPrices: { brand: string; type: string; price: number; shop: string }[];
    tirePrices: { brand: string; size: string; price: number; shop: string }[];
  };
  aiInsights: AIRecommendation[];
  summary: { totalPotentialSavings: number; urgentActions: number; nextRecommendedAction: string };
}

const PRIORITY_LABEL: Record<string, string> = { urgent: 'Urgente', high: 'Alta', medium: 'Média', low: 'Baixa' };
const IMPACT_LABEL: Record<string, string> = { low: 'Baixo', medium: 'Médio', high: 'Alto' };
const PRIORITY_VARIANT: Record<string, 'destructive' | 'default' | 'secondary'> = { urgent: 'destructive', high: 'destructive', medium: 'default', low: 'secondary' };
const PRIORITY_ICON = { urgent: AlertTriangle, high: AlertTriangle, medium: Info, low: CheckCircle } as const;
const PRIORITY_TONE: Record<string, string> = { urgent: 'text-red-500', high: 'text-orange-500', medium: 'text-yellow-500', low: 'text-green-500' };
const TYPE_ICON = { maintenance: Wrench, efficiency: TrendingUp, cost_saving: DollarSign, safety: AlertTriangle } as const;

/** Condições do OpenWeather (em inglês) → pt-PT */
const conditionLabel = (c: string) => {
  const k = c.toLowerCase();
  if (k.includes('thunder')) return 'Trovoada';
  if (k.includes('drizzle')) return 'Chuvisco';
  if (k.includes('rain')) return 'Chuva';
  if (k.includes('snow')) return 'Neve';
  if (k.includes('cloud')) return 'Nublado';
  if (k.includes('clear')) return 'Céu limpo';
  if (/mist|fog|haze|smoke/.test(k)) return 'Nevoeiro';
  return c;
};

function PriorityBadge({ priority }: { priority: string }) {
  return <Badge variant={PRIORITY_VARIANT[priority] ?? 'outline'}>{PRIORITY_LABEL[priority] ?? priority}</Badge>;
}

function Stat({ icon: Icon, tone, title, children }: { icon: typeof Info; tone: string; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className={`h-4 w-4 ${tone}`} aria-hidden="true" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function SummaryTab({ data }: { data: EnhancedRecommendationsData }) {
  const savings = data.summary.totalPotentialSavings;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Stat icon={DollarSign} tone="text-green-500" title="Poupança Potencial">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{savings > 0 ? formatEuro(savings) : '—'}</div>
          <p className="text-xs text-muted-foreground">{savings > 0 ? 'Por mês' : 'Sem estimativa'}</p>
        </Stat>
        <Stat icon={AlertTriangle} tone="text-orange-500" title="Ações Urgentes">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{data.summary.urgentActions}</div>
          <p className="text-xs text-muted-foreground">Requer atenção</p>
        </Stat>
        <Stat icon={Clock} tone="text-blue-500" title="Próxima Ação">
          <div className="text-sm font-medium break-words">{data.summary.nextRecommendedAction}</div>
        </Stat>
      </div>

      <Separator />

      <div>
        <h3 className="font-semibold mb-3">Recomendações Prioritárias</h3>
        <div className="space-y-3">
          {data.aiInsights.slice(0, 3).map((r, i) => {
            const PriorityIcon = PRIORITY_ICON[r.priority] ?? Info;
            const TypeIcon = TYPE_ICON[r.type] ?? Info;
            return (
              <Alert key={i}>
                <div className="flex items-start gap-3">
                  <PriorityIcon className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <TypeIcon className="h-4 w-4" aria-hidden="true" />
                      <span className="font-semibold">{r.title}</span>
                      <PriorityBadge priority={r.priority} />
                    </div>
                    <AlertDescription>{r.description}</AlertDescription>
                    {!!r.estimatedSavings && (
                      <div className="text-sm text-green-600 dark:text-green-400 mt-1">Poupança estimada: {formatEuro(r.estimatedSavings)}</div>
                    )}
                  </div>
                </div>
              </Alert>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function FuelTab({ data, isDemo }: { data: EnhancedRecommendationsData; isDemo: boolean }) {
  const s = data.fuelOptimization.cheapestStation;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Fuel className="h-5 w-5" aria-hidden="true" /> Posto Mais Económico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center gap-2">
              <span className="font-semibold break-words">{s.station}</span>
              <Badge variant="outline" className="shrink-0">{formatNumber(s.distance, 1)} km</Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="text-sm break-words">{s.location}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              {([['95', s.gasoline95], ['98', s.gasoline98], ['Gasóleo', s.diesel]] as const).map(([label, price]) => (
                <div key={label}>
                  <div className="font-medium">{label}</div>
                  <div className="text-muted-foreground">{formatNumber(price, 3)} €</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-green-500" aria-hidden="true" /> Poupança Potencial</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{formatNumber(data.fuelOptimization.potentialSavings, 1)}%</div>
            <p className="text-sm text-muted-foreground mt-1">
              Comparado com o posto mais caro{isDemo ? ' (valores de referência)' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Recomendações de Combustível</h3>
        <div className="space-y-2">
          {data.fuelOptimization.recommendations.map((rec, i) => (
            <Alert key={i}>
              <Info className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{rec}</AlertDescription>
            </Alert>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WeatherTab({ data }: { data: EnhancedRecommendationsData }) {
  const w = data.weatherImpact;
  const rows: [string, React.ReactNode][] = [
    ['Temperatura', `${w.temperature}°C`],
    ['Humidade', `${w.humidity}%`],
    ['Condição', conditionLabel(w.condition)],
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Cloud className="h-5 w-5" aria-hidden="true" /> Condições Atuais</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between items-center">
                <dt>{label}:</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
            <div className="flex justify-between items-center">
              <dt>Impacto:</dt>
              <dd>
                <Badge variant={w.impact === 'high' ? 'destructive' : w.impact === 'medium' ? 'default' : 'secondary'}>
                  {IMPACT_LABEL[w.impact] ?? w.impact}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recomendações Meteorológicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {w.recommendations.map((rec, i) => (
            <Alert key={i}>
              <Cloud className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{rec}</AlertDescription>
            </Alert>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function ActionsTab({ data }: { data: EnhancedRecommendationsData }) {
  return (
    <div className="space-y-4">
      {data.aiInsights.map((r, i) => {
        const PriorityIcon = PRIORITY_ICON[r.priority] ?? Info;
        const TypeIcon = TYPE_ICON[r.type] ?? Info;
        return (
          <Card key={i}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <TypeIcon className="h-5 w-5" aria-hidden="true" /> {r.title} <PriorityBadge priority={r.priority} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-3">{r.description}</p>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-4">
                  {!!r.estimatedSavings && (
                    <div className="text-sm text-green-600 dark:text-green-400"><strong>Poupança: {formatEuro(r.estimatedSavings)}</strong></div>
                  )}
                  {r.deadline && (
                    <div className="text-sm text-orange-600 dark:text-orange-400"><strong>Prazo: {formatDate(r.deadline)}</strong></div>
                  )}
                </div>
                <PriorityIcon className={`h-4 w-4 shrink-0 ${PRIORITY_TONE[r.priority] ?? ''}`} aria-hidden="true" />
              </div>
              <Alert className="mt-3">
                <AlertDescription><strong>Ação recomendada:</strong> {r.actionRequired}</AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function CostsTab({ data }: { data: EnhancedRecommendationsData }) {
  const lists = [
    { title: 'Óleo', items: data.maintenanceCosts.oilPrices.map((o) => ({ key: o.brand + o.shop, name: `${o.brand} ${o.type}`, shop: o.shop, price: o.price })) },
    { title: 'Pneus', items: data.maintenanceCosts.tirePrices.map((t) => ({ key: t.brand + t.shop, name: `${t.brand} ${t.size}`, shop: t.shop, price: t.price })) },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" aria-hidden="true" /> Preços de Manutenção</CardTitle>
        <CardDescription>Valores de referência (não são preços em tempo real das lojas)</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        {lists.map(({ title, items }) => (
          <div key={title}>
            <h4 className="font-medium mb-2">{title}</h4>
            <ul className="space-y-2 text-sm">
              {items.map((it) => (
                <li key={it.key} className="flex justify-between gap-2">
                  <span className="min-w-0 break-words">{it.name} <span className="text-muted-foreground">· {it.shop}</span></span>
                  <span className="font-medium shrink-0">{formatEuro(it.price)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
