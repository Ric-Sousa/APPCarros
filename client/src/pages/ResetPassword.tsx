import { useState } from "react";
import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthCard } from "@/components/PublicLayout";
import PasswordInput, { PasswordStrength } from "@/components/PasswordInput";
import { post, handleApiError } from "@/lib/apiUtils";

export default function ResetPassword() {
  const token = new URLSearchParams(useSearch()).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("As palavras-passe não coincidem.");
    setLoading(true);
    try {
      await post("/api/auth/reset-password", { token, password });
      setDone(true);
    } catch (err) {
      setError(handleApiError(err, "Não foi possível alterar a palavra-passe."));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthCard title="Link inválido">
        <p className="text-sm text-muted-foreground mb-4">Este link não tem o código necessário. Peça um novo email de recuperação.</p>
        <Button asChild className="w-full"><Link href="/recuperar">Pedir novo link</Link></Button>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Palavra-passe alterada">
        <p className="text-sm text-muted-foreground mb-4">Por segurança, terminámos as sessões abertas noutros dispositivos. Entre com a nova palavra-passe.</p>
        <Button asChild className="w-full"><Link href="/login">Entrar</Link></Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Nova palavra-passe" description="Escolha uma palavra-passe que não use noutros sites.">
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error} <Link href="/recuperar" className="underline">Pedir novo link</Link>
            </AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="password">Nova palavra-passe</Label>
          <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus />
          <PasswordStrength password={password} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirmar</Label>
          <PasswordInput id="confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "A guardar..." : "Guardar palavra-passe"}</Button>
      </form>
    </AuthCard>
  );
}
