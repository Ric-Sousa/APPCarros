import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthCard } from "@/components/PublicLayout";
import PasswordInput from "@/components/PasswordInput";
import { post, setAccessToken, handleApiError } from "@/lib/apiUtils";
import { queryClient } from "@/lib/queryClient";
import { AUTH_USER_KEY } from "@/hooks/useAuth";

type LoginResponse = { token: string; user: unknown } | { twoFactorRequired: true; challengeToken: string };

/** Destino depois de entrar: só caminhos internos (evita redirecionamentos para outros sites). */
export function safeNext(search: string, fallback = "/dashboard") {
  const next = new URLSearchParams(search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export default function Login() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const finish = async (token: string) => {
    setAccessToken(token);
    await queryClient.invalidateQueries({ queryKey: AUTH_USER_KEY });
    navigate(safeNext(search));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await post<LoginResponse>("/login", { email, password, remember });
      if ("twoFactorRequired" in data) setChallenge(data.challengeToken);
      else await finish(data.token);
    } catch (err) {
      setError(handleApiError(err, "Não foi possível entrar."));
    } finally {
      setLoading(false);
    }
  };

  const handleCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await post<{ token: string }>("/api/auth/2fa", { challengeToken: challenge, code, remember });
      await finish(data.token);
    } catch (err) {
      setError(handleApiError(err, "Código inválido."));
    } finally {
      setLoading(false);
    }
  };

  if (challenge) {
    return (
      <AuthCard title="Verificação em dois passos" description="Introduza o código de 6 dígitos da sua aplicação de autenticação.">
        <form onSubmit={handleCode} className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="space-y-2">
            <Label htmlFor="totp">Código</Label>
            <Input
              id="totp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-2xl tracking-[0.5em]"
              autoFocus
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
            {loading ? "A verificar..." : "Confirmar"}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => { setChallenge(null); setCode(""); }}>
            Voltar
          </Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Entrar" description="Bem-vindo de volta! Introduza os seus dados.">
      <form onSubmit={handleLogin} className="space-y-4">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-email" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Palavra-passe</Label>
            <Link href="/recuperar" className="text-sm text-primary hover:underline">Esqueceu-se da palavra-passe?</Link>
          </div>
          <PasswordInput id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="input-password" />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-primary" />
          Manter sessão iniciada
        </label>
        <Button type="submit" className="w-full" disabled={loading} data-testid="button-login">
          {loading ? "A entrar..." : "Entrar"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Ainda não tem conta?{" "}
          <Link href={`/register${search ? `?${search}` : ""}`} className="text-primary hover:underline">Criar conta grátis</Link>
        </p>
      </form>
    </AuthCard>
  );
}
