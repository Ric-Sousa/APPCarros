import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageOff, Loader2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { get, post, handleApiError } from "@/lib/apiUtils";

export interface PickedPhoto {
  imageUrl: string;
  imageCredit: string | null;
  imageCreditUrl: string | null;
}

interface Suggestion {
  url: string;
  thumbUrl: string;
  credit: string;
  creditUrl: string;
  source: "commons" | "unsplash";
  trackUrl?: string;
}

export interface PhotoSearch {
  brand: string;
  model: string;
  year?: number | null;
  engineDisplacement?: number | null;
  vehicleCategory?: string | null;
  iucCategory?: string | null;
}

const MAX_SIZE = 5 * 1024 * 1024;

/** Envia uma foto própria e devolve o URL público (/uploads/vehicle-…). */
export async function uploadVehiclePhoto(file: File): Promise<string> {
  if (file.size > MAX_SIZE) throw new Error("A imagem deve ter menos de 5 MB.");
  const form = new FormData();
  form.append("image", file);
  const { url } = await post<{ url: string }>("/api/vehicle-photos", form);
  return url;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: PhotoSearch;
  onSelect: (photo: PickedPhoto) => void;
}

/** Galeria de fotos sugeridas (Wikimedia Commons com o ano certo primeiro, depois Unsplash) + envio de foto própria. */
export function VehicleImagePicker({ open, onOpenChange, vehicle, onSelect }: Props) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const params = new URLSearchParams(
    Object.entries(vehicle)
      .filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== 0)
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  const { data: suggestions, isLoading, isError } = useQuery<Suggestion[]>({
    queryKey: ["/api/vehicle-photos/suggestions", params],
    queryFn: () => get<Suggestion[]>(`/api/vehicle-photos/suggestions?${params}`),
    enabled: open && !!vehicle.brand && !!vehicle.model,
    staleTime: 10 * 60 * 1000,
  });

  const choose = (photo: PickedPhoto) => {
    onSelect(photo);
    onOpenChange(false);
  };

  const pick = (s: Suggestion) => {
    // Regras da API do Unsplash: avisar quando uma foto é usada
    if (s.trackUrl) post("/api/vehicle-photos/track", { trackUrl: s.trackUrl }).catch(() => {});
    choose({ imageUrl: s.url, imageCredit: s.credit, imageCreditUrl: s.creditUrl });
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      choose({ imageUrl: await uploadVehiclePhoto(file), imageCredit: null, imageCreditUrl: null });
    } catch (error) {
      toast({ title: "Erro ao enviar a foto", description: handleApiError(error), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Escolher foto</DialogTitle>
          <DialogDescription>
            Fotos de {vehicle.brand} {vehicle.model}
            {vehicle.year ? ` de ${vehicle.year}` : ""}. As primeiras têm o modelo e o ano no título.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground" role="status">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> A procurar fotos...
          </div>
        )}

        {!isLoading && (isError || suggestions?.length === 0) && (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <ImageOff className="h-8 w-8" aria-hidden="true" />
            <p>{isError ? "Não foi possível procurar fotos agora." : "Não foram encontradas fotos deste modelo."}</p>
          </div>
        )}

        {!!suggestions?.length && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {suggestions.map((s) => (
              <button
                key={s.url}
                type="button"
                onClick={() => pick(s)}
                className="overflow-hidden rounded-lg border text-left transition hover:ring-2 hover:ring-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                data-testid="photo-suggestion"
              >
                <img src={s.thumbUrl} alt={s.credit} loading="lazy" className="h-28 w-full object-cover" />
                <p className="truncate px-2 py-1 text-[10px] text-muted-foreground" title={s.credit}>
                  {s.credit}
                </p>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <p className="text-xs text-muted-foreground">Nenhuma serve? Envie a sua (JPEG, PNG ou WEBP, até 5 MB).</p>
          <label>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onFile} disabled={uploading} />
            <Button asChild variant="outline" size="sm">
              <span className="cursor-pointer">
                {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="mr-1 h-4 w-4" aria-hidden="true" />}
                Enviar a minha foto
              </span>
            </Button>
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}
