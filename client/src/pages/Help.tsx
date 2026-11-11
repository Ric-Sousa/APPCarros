import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import PublicLayout from "@/components/PublicLayout";
import { post, handleApiError } from "@/lib/apiUtils";
import { BRAND } from "@shared/brand";
import { PLANS } from "@shared/plans";

export const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Como funcionam os lembretes?",
    a: <>Calculamos os prazos de cada veículo (IUC, inspeção, seguro, óleo e pneus) e avisamos por email — e no telemóvel, se ativar as notificações — 30, 7 e 1 dia antes. Pode escolher a antecedência em <Link href="/definicoes">Definições</Link>.</>,
  },
  {
    q: "Como são calculados o IUC e a inspeção?",
    a: <>O IUC paga-se no mês da matrícula, todos os anos. A inspeção de um ligeiro de passageiros é aos 4 anos, depois de 2 em 2 anos até aos 8, e a partir daí todos os anos. Para outros veículos usamos as regras gerais do IMT. As datas são sugestões: confirme sempre os prazos oficiais e corrija-os se for preciso.</>,
  },
  {
    q: "O que muda entre os planos?",
    a: <>O plano {PLANS.free.name} inclui {PLANS.free.maxVehicles} veículo e lembretes por email. O {PLANS.premium.name} junta veículos ilimitados, notificações no telemóvel, leitura de recibos, livro de revisões em PDF e partilha com a família. Veja os detalhes em <Link href="/planos">Planos</Link>.</>,
  },
  {
    q: "Posso usar no telemóvel?",
    a: <>Sim. Abra o {BRAND.name} no navegador do telemóvel e escolha "Adicionar ao ecrã principal" (ou "Instalar app"). Fica com um ícone como uma app normal e pode receber notificações.</>,
  },
  {
    q: "Os meus dados estão seguros?",
    a: <>Os dados ficam na União Europeia, as ligações são cifradas e cada conta só vê os seus veículos. Pode ativar a autenticação em dois passos. Não vendemos dados nem mostramos publicidade. Saiba mais na <Link href="/privacidade">Política de Privacidade</Link>.</>,
  },
  {
    q: "Como exporto ou apago os meus dados?",
    a: <>Em <Link href="/definicoes">Definições → Os meus dados</Link> pode descarregar tudo num ficheiro ou apagar a conta e todos os dados de forma definitiva.</>,
  },
  {
    q: "Posso partilhar um carro com a família?",
    a: <>Sim, nos planos pagos: na página do veículo convide outra pessoa pelo email. Ela passa a ver os prazos e pode registar abastecimentos e despesas.</>,
  },
];

export function FaqList() {
  return (
    <div className="space-y-3">
      {FAQ.map(({ q, a }) => (
        <details key={q} className="group rounded-lg border border-border bg-card p-4 open:shadow-sm">
          <summary className="cursor-pointer list-none font-medium text-foreground flex justify-between gap-4">
            {q}
            <span className="text-muted-foreground transition-transform group-open:rotate-45" aria-hidden="true">+</span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
        </details>
      ))}
    </div>
  );
}

export default function Help() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await post("/api/feedback", { message, page: location });
      setMessage("");
      toast({ title: "Obrigado!", description: "Recebemos a sua mensagem e vamos lê-la com atenção." });
    } catch (error) {
      toast({ title: "Não foi possível enviar", description: handleApiError(error), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-10 space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ajuda</h1>
          <p className="mt-2 text-muted-foreground">Respostas rápidas às dúvidas mais comuns.</p>
        </div>
        <FaqList />
        <section className="rounded-lg border border-border bg-card p-6 space-y-4" aria-labelledby="contacto">
          <h2 id="contacto" className="text-xl font-semibold text-foreground">Não encontrou o que procurava?</h2>
          <p className="text-sm text-muted-foreground">
            Escreva-nos para <a className="text-primary hover:underline" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a> ou deixe aqui uma mensagem (dúvida, problema ou sugestão).
          </p>
          <form onSubmit={send} className="space-y-3">
            <Label htmlFor="feedback">Mensagem</Label>
            <Textarea id="feedback" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={5000} required />
            <Button type="submit" disabled={sending || !message.trim()}>{sending ? "A enviar..." : "Enviar mensagem"}</Button>
          </form>
        </section>
      </div>
    </PublicLayout>
  );
}
