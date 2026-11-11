import { useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/PublicLayout";
import { post, handleApiError } from "@/lib/apiUtils";
import { queryClient } from "@/lib/queryClient";
import { AUTH_USER_KEY } from "@/hooks/useAuth";

export default function VerifyEmail() {
  const token = new URLSearchParams(useSearch()).get("token") ?? "";
  const [state, setState] = useState<"loading" | "ok" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "" : "O link não tem o código de confirmação.");
  const started = useRef(false);

  useEffect(() => {
    // O token é de uso único: evitar o segundo pedido do StrictMode
    if (!token || started.current) return;
    started.current = true;
    post("/api/auth/verify-email", { token })
      .then(() => {
        setState("ok");
        queryClient.invalidateQueries({ queryKey: AUTH_USER_KEY });
      })
      .catch((err) => {
        setState("error");
        setMessage(handleApiError(err, "O link é inválido ou já expirou."));
      });
  }, [token]);

  return (
    <AuthCard title="Confirmar email">
      <div className="space-y-4 text-center" role="status">
        {state === "loading" && (
          <p className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> A confirmar...
          </p>
        )}
        {state === "ok" && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" aria-hidden="true" />
            <p className="text-foreground">Email confirmado. A partir de agora recebe os lembretes dos seus prazos.</p>
            <Button asChild className="w-full"><Link href="/dashboard">Ir para a app</Link></Button>
          </>
        )}
        {state === "error" && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-destructive" aria-hidden="true" />
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground">Pode pedir um novo email no aviso no topo da app, depois de entrar.</p>
            <Button asChild variant="outline" className="w-full"><Link href="/dashboard">Ir para a app</Link></Button>
          </>
        )}
      </div>
    </AuthCard>
  );
}
