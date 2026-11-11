import { Link } from "wouter";
import { BRAND } from "@shared/brand";
import { useConfig } from "@/hooks/useConfig";

/** Rodapé com ligações legais, contacto e atribuição das fontes de dados. */
export default function Footer({ className = "" }: { className?: string }) {
  const config = useConfig();
  return (
    <footer className={`border-t border-border bg-card/50 text-sm text-muted-foreground ${className}`}>
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-4">
        <nav aria-label="Ligações do rodapé" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacidade" className="hover:text-foreground">Privacidade</Link>
          <Link href="/termos" className="hover:text-foreground">Termos</Link>
          <Link href="/ajuda" className="hover:text-foreground">Ajuda</Link>
          <Link href="/planos" className="hover:text-foreground">Planos</Link>
          <a href="https://www.livroreclamacoes.pt" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
            Livro de Reclamações
          </a>
          <a href={`mailto:${BRAND.supportEmail}`} className="hover:text-foreground">{BRAND.supportEmail}</a>
        </nav>
        {!!config?.attributions?.length && (
          <p className="text-xs leading-relaxed">
            Dados e imagens:{" "}
            {config.attributions.map((a, i) => (
              <span key={a.name}>
                {i > 0 && " · "}
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline" title={a.note}>
                  {a.name}
                </a>
              </span>
            ))}
          </p>
        )}
        <p className="text-xs">© {new Date().getFullYear()} {BRAND.name}. Sem publicidade e sem venda de dados.</p>
      </div>
    </footer>
  );
}
