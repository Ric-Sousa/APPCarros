import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Car, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthCard } from "@/components/PublicLayout";
import { get, post, handleApiError } from "@/lib/apiUtils";
import { queryClient } from "@/lib/queryClient";

interface Invite {
  vehicle: { brand: string; model: string; licensePlate: string };
  invitedBy: string;
}

export default function AcceptInvite() {
  const token = new URLSearchParams(useSearch()).get("token") ?? "";
  const [, navigate] = useLocation();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  const { data: invite, isLoading, error: loadError } = useQuery({
    queryKey: ["/api/invites", token],
    queryFn: () => get<Invite>(`/api/invites/${encodeURIComponent(token)}`),
    enabled: !!token,
  });

  const accept = async () => {
    setAccepting(true);
    setError("");
    try {
      const { vehicleId } = await post<{ vehicleId: string }>("/api/invites/accept", { token });
      await queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      navigate(`/vehicle/${vehicleId}`);
    } catch (err) {
      setError(handleApiError(err, "Não foi possível aceitar o convite."));
    } finally {
      setAccepting(false);
    }
  };

  return (
    <AuthCard title="Convite para partilhar um veículo">
      <div className="space-y-4">
        {isLoading && (
          <p className="flex items-center justify-center gap-2 text-muted-foreground" role="status">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> A carregar o convite...
          </p>
        )}
        {(!token || loadError) && (
          <Alert variant="destructive">
            <AlertDescription>{token ? handleApiError(loadError, "Convite inválido ou expirado.") : "O link não tem o código do convite."}</AlertDescription>
          </Alert>
        )}
        {invite && (
          <>
            <div className="flex items-center gap-4 rounded-lg border border-border p-4">
              <span className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                <Car className="h-5 w-5 text-primary" aria-hidden="true" />
              </span>
              <div>
                <p className="font-medium text-foreground">{invite.vehicle.brand} {invite.vehicle.model}</p>
                <p className="text-sm text-muted-foreground">{invite.vehicle.licensePlate} · convite de {invite.invitedBy}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Ao aceitar, passa a ver os prazos e o histórico deste veículo e pode registar abastecimentos, despesas e manutenções.
            </p>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <Button className="w-full" onClick={accept} disabled={accepting}>{accepting ? "A aceitar..." : "Aceitar convite"}</Button>
          </>
        )}
        <Button variant="ghost" className="w-full" onClick={() => navigate("/dashboard")}>Agora não</Button>
      </div>
    </AuthCard>
  );
}
