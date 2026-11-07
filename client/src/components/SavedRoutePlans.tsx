import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { del, put, handleApiError } from "@/lib/apiUtils";
import { formatNumber } from "@/lib/utils";

export interface RoutePlan {
  id: string;
  name?: string;
  vehicleId: string;
  originLat: number;
  originLon: number;
  destinationLat: number;
  destinationLon: number;
  energyType?: "gasoline" | "diesel" | "electric";
  consumption?: number;
  capacity?: number;
  currentLevelPercent?: number;
  totalDistanceKm?: number;
  durationMin?: number;
  geometry?: unknown;
  createdAt?: string;
}

const KEY = ["/api/route-plans"];

/** Lista de planos de rota guardados: aplicar, renomear (diálogo) e eliminar (confirmação). */
export default function SavedRoutePlans({ onApply }: { onApply: (plan: RoutePlan) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: plans = [], isLoading } = useQuery<{ plans: RoutePlan[] }, Error, RoutePlan[]>({ queryKey: KEY, select: (d) => d.plans ?? [] });
  const [renaming, setRenaming] = useState<RoutePlan | null>(null);
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState<RoutePlan | null>(null);

  const onError = (error: unknown) => toast({ title: "Erro", description: handleApiError(error), variant: "destructive" });
  const rename = useMutation({
    mutationFn: () => put(`/api/route-plans/${renaming!.id}`, { name: newName.trim() }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: KEY }); setRenaming(null); toast({ title: "Plano renomeado" }); },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => del(`/api/route-plans/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: KEY }); setDeleting(null); toast({ title: "Plano eliminado" }); },
    onError,
  });

  return (
    <Card>
      <CardHeader><CardTitle>Planos Guardados</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground" role="status">A carregar…</p>
        ) : plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem planos guardados.</p>
        ) : (
          plans.map((p) => (
            <div key={p.id} className="border border-border rounded p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <p className="font-medium break-words">{p.name || "Plano"}</p>
                <p className="text-sm text-muted-foreground">
                  {p.totalDistanceKm ? `${formatNumber(p.totalDistanceKm, 1)} km` : "—"}
                  {p.durationMin ? ` • ${p.durationMin} min` : ""}
                </p>
                {p.createdAt && <p className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleString("pt-PT")}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => onApply(p)}>Aplicar</Button>
                <Button variant="outline" size="sm" onClick={() => { setRenaming(p); setNewName(p.name ?? ""); }}>Renomear</Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleting(p)}>Eliminar</Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={!!renaming} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear plano</DialogTitle>
            <DialogDescription>Escolha um nome para encontrar o plano mais tarde.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (newName.trim()) rename.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plan-new-name">Nome</Label>
              <Input id="plan-new-name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setRenaming(null)}>Cancelar</Button>
              <Button type="submit" disabled={!newName.trim() || rename.isPending}>Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Eliminar plano?"
        description={`O plano "${deleting?.name ?? "Plano"}" será eliminado.`}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        pending={remove.isPending}
      />
    </Card>
  );
}
