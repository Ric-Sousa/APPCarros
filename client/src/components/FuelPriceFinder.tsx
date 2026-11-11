import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Fuel, Loader2, LocateFixed, MapPin, Search, TrendingDown } from "lucide-react";
import { normalizeFuelType } from "@shared/fuel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { get, handleApiError } from "@/lib/apiUtils";
import { formatNumber } from "@/lib/utils";

type PriceFuel = "diesel" | "gasoline95" | "gasoline98" | "lpg";
const FUELS: { value: PriceFuel; label: string }[] = [
  { value: "diesel", label: "Gasóleo" },
  { value: "gasoline95", label: "Gasolina 95" },
  { value: "gasoline98", label: "Gasolina 98" },
  { value: "lpg", label: "GPL Auto" },
];
/** Depósito de referência para a poupança estimada. */
const TANK_LITERS = 50;

interface Station {
  id: string | number;
  name: string;
  brand: string;
  address: string;
  municipality: string;
  district: string;
  lat: number;
  lng: number;
  distance: number;
  price: number;
  updatedAt: string;
}
interface FuelPrices {
  source: string;
  attribution: string;
  fetchedAt: string;
  average: { price: number; date: string } | null;
  stations: Station[];
}

/** "2026-11-09 14:30" (hora de Portugal, como vem da DGEG) -> "09/11 14:30"; sem conversão de fuso. */
const dgegDate = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(s);
  return m ? `${m[3]}/${m[2]}${m[4] ? ` ${m[4]}:${m[5]}` : ""}` : s;
};
const euroPerLiter = (n: number) => `${n.toLocaleString("pt-PT", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} €/L`;

function toPriceFuel(fuelType?: string | null): PriceFuel {
  const code = normalizeFuelType(fuelType);
  if (code === "diesel" || code === "gasoline98" || code === "lpg") return code;
  return "gasoline95";
}

/**
 * Postos mais baratos perto do utilizador, com preços oficiais da DGEG.
 * Regras da DGEG: identificar a fonte e a data/hora de cada preço, sem alterar os valores.
 */
export default function FuelPriceFinder({ fuelType }: { fuelType?: string | null }) {
  const [fuel, setFuel] = useState<PriceFuel>(toPriceFuel(fuelType));
  const [radius, setRadius] = useState("10");
  const [coords, setCoords] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [place, setPlace] = useState("");
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");

  const { data, isFetching, error } = useQuery<FuelPrices>({
    queryKey: ["/api/fuel-prices", coords?.lat, coords?.lng, fuel, radius],
    queryFn: () => get<FuelPrices>(`/api/fuel-prices?lat=${coords!.lat}&lng=${coords!.lng}&fuel=${fuel}&radius=${radius}`),
    enabled: !!coords,
    staleTime: 15 * 60 * 1000,
  });

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocError("O seu navegador não permite obter a localização. Escreva uma localidade.");
      return;
    }
    setLocating(true);
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "A sua localização" });
        setLocating(false);
      },
      () => {
        setLocError("Não foi possível obter a localização. Escreva uma localidade.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  };

  const searchPlace = async () => {
    if (!place.trim()) return;
    setLocating(true);
    setLocError("");
    try {
      const { results } = await get<{ results: { lat: number; lng: number; label: string }[] }>(`/api/geocode?q=${encodeURIComponent(place.trim())}`);
      if (!results.length) setLocError("Localidade não encontrada.");
      else setCoords(results[0]);
    } catch (err) {
      setLocError(handleApiError(err));
    } finally {
      setLocating(false);
    }
  };

  const cheapest = data?.stations[0];
  const diff = cheapest && data?.average ? cheapest.price - data.average.price : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Fuel className="h-5 w-5" aria-hidden="true" /> Postos mais baratos por perto</CardTitle>
        <CardDescription>Preços oficiais comunicados à DGEG pelos postos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <form className="flex gap-2 min-w-0" onSubmit={(e) => { e.preventDefault(); searchPlace(); }}>
            <div className="flex-1 min-w-0">
              <Label htmlFor="fuel-place">Localidade</Label>
              <Input id="fuel-place" placeholder="Ex.: Braga" value={place} onChange={(e) => setPlace(e.target.value)} className="mt-1" />
            </div>
            <Button type="submit" variant="outline" className="self-end" disabled={locating} aria-label="Procurar localidade">
              <Search className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>
          <div>
            <Label htmlFor="fuel-type">Combustível</Label>
            <Select value={fuel} onValueChange={(v) => setFuel(v as PriceFuel)}>
              <SelectTrigger id="fuel-type" className="mt-1 sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{FUELS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="fuel-radius">Raio</Label>
            <Select value={radius} onValueChange={setRadius}>
              <SelectTrigger id="fuel-radius" className="mt-1 sm:w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{["5", "10", "25", "50"].map((r) => <SelectItem key={r} value={r}>{r} km</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={useMyLocation} disabled={locating} className="w-full sm:w-auto">
          {locating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" /> : <LocateFixed className="h-4 w-4 mr-2" aria-hidden="true" />}
          Usar a minha localização
        </Button>
        {locError && <p className="text-sm text-destructive" role="alert">{locError}</p>}

        {!coords ? (
          <p className="text-sm text-muted-foreground">Escolha a localização para ver os preços.</p>
        ) : isFetching ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> A procurar postos perto de {coords.label}...</p>
        ) : error ? (
          <p className="text-sm text-destructive" role="alert">{handleApiError(error, "Preços indisponíveis de momento.")}</p>
        ) : !data || data.stations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Não há postos com este combustível num raio de {radius} km de {coords.label}.</p>
        ) : (
          <>
            {cheapest && data.average && diff !== null && (
              <div className="rounded-lg border border-green-600/30 bg-green-500/10 p-3 text-sm flex items-start gap-2">
                <TrendingDown className="h-4 w-4 text-green-700 dark:text-green-400 mt-0.5 shrink-0" aria-hidden="true" />
                <p>
                  O mais barato está a {euroPerLiter(cheapest.price)} — {diff <= 0 ? `${formatNumber(-diff, 3)} €/L abaixo` : `${formatNumber(diff, 3)} €/L acima`} da média nacional ({euroPerLiter(data.average.price)}).
                  {diff < 0 && ` Poupa cerca de ${formatNumber(-diff * TANK_LITERS, 2)} € num depósito de ${TANK_LITERS} L.`}
                </p>
              </div>
            )}
            <ul className="divide-y divide-border">
              {data.stations.slice(0, 10).map((s, i) => (
                <li key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words">
                      {s.brand ? `${s.brand} · ` : ""}{s.name}
                      {i === 0 && <Badge className="ml-2 text-xs">Mais barato</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 break-words">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" /> {s.address}, {s.municipality} · {formatNumber(s.distance, 1)} km
                    </p>
                  </div>
                  <div className="flex items-center gap-3 sm:text-right">
                    <div>
                      <p className="font-semibold">{euroPerLiter(s.price)}</p>
                      <p className="text-[11px] text-muted-foreground">atualizado {dgegDate(s.updatedAt)}</p>
                    </div>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`} target="_blank" rel="noopener noreferrer" aria-label={`Direções para ${s.name}`}>
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </a>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">{data.attribution || "Fonte: DGEG — Direção-Geral de Energia e Geologia"} · média de {data.average ? dgegDate(data.average.date) : "—"}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
