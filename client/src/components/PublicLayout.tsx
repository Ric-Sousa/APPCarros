import type { ReactNode } from "react";
import { Link } from "wouter";
import { Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { BRAND } from "@shared/brand";

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="w-9 h-9 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
        <Car className="w-5 h-5 text-primary-foreground" aria-hidden="true" />
      </span>
      <span className="text-lg font-semibold text-foreground">{BRAND.name}</span>
    </Link>
  );
}

/** Páginas públicas (landing, planos, ajuda, legais): cabeçalho simples + rodapé. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-3">
          <Logo />
          <nav aria-label="Conta" className="flex items-center gap-2">
            <Link href="/planos" className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground px-2">Planos</Link>
            {isAuthenticated ? (
              <Button asChild size="sm"><Link href="/dashboard">Abrir a app</Link></Button>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost"><Link href="/login">Entrar</Link></Button>
                <Button asChild size="sm"><Link href="/register">Criar conta</Link></Button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

/** Ecrãs de conta (entrar, registar, recuperar, verificar, convites): cartão centrado. */
export function AuthCard({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-muted/30 to-accent/10">
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center"><Logo /></div>
          <Card>
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl">{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent>{children}</CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

/** Secção de texto longo (legais, ajuda). */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6 text-foreground [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline">
      {children}
    </div>
  );
}
