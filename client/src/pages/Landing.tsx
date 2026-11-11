import { Link } from "wouter";
import {
  Bell, CalendarCheck, Car, FileText, Fuel, ReceiptText, ScanLine, ShieldCheck, Users, Wrench, Lock, Ban, MapPin, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import PublicLayout from "@/components/PublicLayout";
import { PlanCards } from "@/pages/Pricing";
import { FaqList } from "@/pages/Help";
import { BRAND } from "@shared/brand";

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Car, title: "1. Indique a matrícula", text: "Marca, modelo e ano preenchem-se sozinhos sempre que possível." },
  { icon: CalendarCheck, title: "2. Nós calculamos os prazos", text: "IUC, inspeção, seguro, óleo e pneus — tudo numa só vista." },
  { icon: Bell, title: "3. Receba os lembretes", text: "Por email e no telemóvel, 30, 7 e 1 dia antes. Sem surpresas." },
];

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Bell, title: "Lembretes de IUC, inspeção e seguro", text: "Evite coimas por prazos esquecidos." },
  { icon: Wrench, title: "Histórico e despesas", text: "Manutenções, abastecimentos e custos por veículo, com exportação." },
  { icon: ScanLine, title: "Recibos com leitura automática", text: "Fotografe o recibo e a despesa fica registada." },
  { icon: FileText, title: "Livro de revisões em PDF", text: "Valorize o carro na hora de o vender." },
  { icon: Fuel, title: "Preços de combustível", text: "Postos mais baratos perto de si, com dados oficiais da DGEG." },
  { icon: Users, title: "Partilha com a família", text: "Vários condutores no mesmo carro, todos a par dos prazos." },
];

const TRUST: { icon: LucideIcon; text: string }[] = [
  { icon: ShieldCheck, text: "Cumprimos o RGPD: exporte ou apague os seus dados quando quiser" },
  { icon: MapPin, text: "Dados guardados na União Europeia" },
  { icon: Ban, text: "Sem publicidade e sem venda de dados" },
  { icon: Lock, text: "Ligações cifradas e autenticação em dois passos" },
];

export default function Landing() {
  return (
    <PublicLayout>
      {/* Destaque */}
      <section className="bg-gradient-to-br from-background via-muted/40 to-accent/10">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24 text-center space-y-6">
          <p className="text-sm font-medium text-primary">Gestão de veículos para Portugal</p>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground max-w-4xl mx-auto">{BRAND.tagline}</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            O {BRAND.name} lembra-o de tudo o que o seu carro precisa — IUC, inspeção, seguro e manutenção — e guarda o histórico num só lugar.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-gradient-to-r from-primary to-secondary">
              <Link href="/register">Criar conta grátis</Link>
            </Button>
            <Button asChild size="lg" variant="outline"><Link href="/login">Já tenho conta</Link></Button>
          </div>
          <p className="text-xs text-muted-foreground">Grátis para 1 veículo. Sem cartão de crédito.</p>
        </div>
      </section>

      {/* Como funciona */}
      <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="como-funciona">
        <h2 id="como-funciona" className="text-2xl md:text-3xl font-bold text-center text-foreground mb-10">Como funciona</h2>
        <ol className="grid gap-6 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
              <span className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
              </span>
              <h3 className="font-semibold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Funcionalidades */}
      <section className="bg-muted/30" aria-labelledby="funcionalidades">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 id="funcionalidades" className="text-2xl md:text-3xl font-bold text-center text-foreground mb-10">Tudo o que o seu carro precisa</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border border-border bg-card p-5 flex gap-4">
                <Icon className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h3 className="font-medium text-foreground">{title}</h3>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preços */}
      <section className="mx-auto max-w-6xl px-4 py-16 space-y-8" aria-labelledby="precos">
        <div className="text-center space-y-2">
          <h2 id="precos" className="text-2xl md:text-3xl font-bold text-foreground">Preços</h2>
          <p className="text-muted-foreground">Comece grátis e mude quando precisar.</p>
        </div>
        <PlanCards
          footer={(plan) => (
            <Button asChild className="w-full" variant={plan.id === "premium" ? "default" : "outline"}>
              <Link href="/register">{plan.priceMonthly === 0 ? "Começar grátis" : `Experimentar ${plan.name}`}</Link>
            </Button>
          )}
        />
      </section>

      {/* Confiança */}
      <section className="bg-muted/30" aria-labelledby="confianca">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 id="confianca" className="sr-only">Privacidade e segurança</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-foreground">
                <Icon className="h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" /> {text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Perguntas frequentes */}
      <section className="mx-auto max-w-3xl px-4 py-16 space-y-6" aria-labelledby="faq">
        <h2 id="faq" className="text-2xl md:text-3xl font-bold text-center text-foreground">Perguntas frequentes</h2>
        <FaqList />
        <div className="text-center pt-4">
          <Button asChild size="lg"><Link href="/register"><ReceiptText className="mr-2 h-4 w-4" aria-hidden="true" />Criar conta grátis</Link></Button>
        </div>
      </section>
    </PublicLayout>
  );
}
