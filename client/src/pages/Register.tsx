import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthCard } from "@/components/PublicLayout";
import PasswordInput, { PasswordStrength } from "@/components/PasswordInput";
import { post, setAccessToken, handleApiError } from "@/lib/apiUtils";
import { queryClient } from "@/lib/queryClient";
import { AUTH_USER_KEY } from "@/hooks/useAuth";
import { safeNext } from "@/pages/Login";

export default function Register() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) return setError("As palavras-passe não coincidem.");
    if (password.length < 8) return setError("A palavra-passe deve ter pelo menos 8 caracteres.");
    if (!acceptTerms) return setError("Para criar conta tem de aceitar os termos e a política de privacidade.");

    setLoading(true);
    try {
      const data = await post<{ token: string }>("/api/register", { name, email, password, acceptTerms: true });
      setAccessToken(data.token);
      await queryClient.invalidateQueries({ queryKey: AUTH_USER_KEY });
      navigate(safeNext(search));
    } catch (err) {
      setError(handleApiError(err, "Erro ao criar a conta."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Criar conta grátis" description="Em menos de um minuto fica com os prazos do seu carro sob controlo.">
      <form onSubmit={handleRegister} className="space-y-4">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Palavra-passe</Label>
          <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          <PasswordStrength password={password} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar palavra-passe</Label>
          <PasswordInput id="confirmPassword" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        </div>
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
            required
          />
          <span>
            Li e aceito os <Link href="/termos" className="text-primary hover:underline">termos de utilização</Link> e a{" "}
            <Link href="/privacidade" className="text-primary hover:underline">política de privacidade</Link>.
          </span>
        </label>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "A criar conta..." : "Criar conta"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link href={`/login${search ? `?${search}` : ""}`} className="text-primary hover:underline">Entrar</Link>
        </p>
      </form>
    </AuthCard>
  );
}
