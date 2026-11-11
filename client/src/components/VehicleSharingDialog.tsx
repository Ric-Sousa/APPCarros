import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, Trash2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { type VehicleWithRole, isOwner } from "@/hooks/useVehicles";
import { del, post } from "@/lib/apiUtils";
import { toastApiError } from "@/lib/planLimit";
import ConfirmDialog from "./ConfirmDialog";

interface Member {
  id: string;
  email: string;
  status: "pending" | "active";
  role: string;
  userName?: string;
}

/**
 * Dono: lista quem tem acesso, convida por email e remove.
 * Condutor: pode deixar de acompanhar o veículo.
 */
export default function VehicleSharingDialog({ vehicle, open, onOpenChange }: { vehicle: VehicleWithRole; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const owner = isOwner(vehicle);
  const membersKey = ["/api/vehicles", vehicle.id, "members"];
  const { data: members = [], isLoading } = useQuery<Member[]>({ queryKey: membersKey, enabled: open && owner });

  const invite = useMutation({
    mutationFn: () => post(`/api/vehicles/${vehicle.id}/members`, { email: email.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey });
      toast({ title: "Convite enviado", description: `Enviámos um convite para ${email.trim()}.` });
      setEmail("");
    },
    onError: (error) => toastApiError(toast, error, "Não foi possível enviar o convite."),
  });

  const remove = useMutation({
    mutationFn: (memberId: string) => del(`/api/vehicles/${vehicle.id}/members/${memberId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersKey }),
    onError: (error) => toastApiError(toast, error),
  });

  const leave = useMutation({
    mutationFn: () => del(`/api/vehicles/${vehicle.id}/members/me`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Deixou de acompanhar este veículo" });
      setConfirmLeave(false);
      onOpenChange(false);
      navigate("/dashboard");
    },
    onError: (error) => toastApiError(toast, error),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{owner ? "Partilhar veículo" : "Acesso partilhado"}</DialogTitle>
          <DialogDescription>
            {owner
              ? "Quem convidar pode registar abastecimentos, despesas e manutenções e recebe os lembretes. Só o dono apaga o veículo."
              : `Este veículo foi partilhado consigo${vehicle.ownerName ? ` por ${vehicle.ownerName}` : ""}.`}
          </DialogDescription>
        </DialogHeader>

        {owner ? (
          <div className="space-y-4">
            <form
              className="flex flex-col sm:flex-row gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) invite.mutate();
              }}
            >
              <div className="flex-1">
                <Label htmlFor="share-email" className="sr-only">Email da pessoa a convidar</Label>
                <Input id="share-email" type="email" required placeholder="email@exemplo.pt" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" disabled={invite.isPending || !email.trim()}>
                {invite.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4 mr-1" aria-hidden="true" />}
                Convidar
              </Button>
            </form>

            {isLoading ? (
              <p className="text-sm text-muted-foreground" role="status">A carregar...</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda não partilhou este veículo.</p>
            ) : (
              <ul className="divide-y divide-border">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm truncate">{m.userName || m.email}</p>
                        {m.userName && <p className="text-xs text-muted-foreground truncate">{m.email}</p>}
                      </div>
                      {m.status === "pending" && <Badge variant="outline" className="text-xs shrink-0">Pendente</Badge>}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(m.id)} disabled={remove.isPending} aria-label={`Remover ${m.email}`}>
                      <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <Button variant="outline" className="text-destructive" onClick={() => setConfirmLeave(true)}>
            Deixar de acompanhar este veículo
          </Button>
        )}
      </DialogContent>
      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title="Deixar de acompanhar este veículo?"
        description="Deixa de ver o veículo e de receber os lembretes. Para voltar, o dono terá de o convidar outra vez."
        confirmLabel="Deixar de acompanhar"
        onConfirm={() => leave.mutate()}
        pending={leave.isPending}
      />
    </Dialog>
  );
}
