import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthCard } from "@/components/PublicLayout";
import { post, handleApiError } from "@/lib/apiUtils";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await post("/api/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(handleApiError(err, "Não foi possível enviar o email."));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthCard title="Verifique o seu email">
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>Se existir uma conta com <strong className="text-foreground">{email}</strong>, enviámos um link para escolher uma nova palavra-passe. O link é válido durante 1 hora.</p>
          <p>Não recebeu? Veja a pasta de spam ou tente de novo daqui a alguns minutos.</p>
          <Button asChild variant="outline" className="w-full"><Link href="/login">Voltar ao login</Link></Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Recuperar palavra-passe" description="Indique o email da sua conta e enviamos um link para criar uma nova.">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "A enviar..." : "Enviar link"}</Button>
        <p className="text-center text-sm"><Link href="/login" className="text-primary hover:underline">Voltar ao login</Link></p>
      </form>
    </AuthCard>
  );
}
