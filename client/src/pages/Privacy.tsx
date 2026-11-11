import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";
import PublicLayout, { Prose } from "@/components/PublicLayout";
import { useConfig } from "@/hooks/useConfig";
import { BRAND } from "@shared/brand";

export function DraftNotice() {
  return (
    <div role="note" className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <span><strong>Rascunho — a validar por um jurista antes do lançamento.</strong> Os campos entre [parênteses retos] têm de ser preenchidos com os dados da empresa.</span>
    </div>
  );
}

const UPDATED = "11 de novembro de 2026";

export default function Privacy() {
  const config = useConfig();
  return (
    <PublicLayout>
      <Prose>
        <DraftNotice />
        <h1>Política de Privacidade</h1>
        <p>Última atualização: {UPDATED}.</p>

        <h2>1. Quem é o responsável pelos seus dados</h2>
        <p>
          O responsável pelo tratamento é [NOME DA EMPRESA], NIF [NIF], com sede em [MORADA], que explora o serviço {BRAND.name}.
          Para qualquer questão sobre privacidade contacte <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.
        </p>

        <h2>2. Que dados tratamos</h2>
        <ul>
          <li><strong>Conta:</strong> nome, email, palavra-passe (guardada só em hash), telefone, morada e fotografia de perfil, se as indicar.</li>
          <li><strong>Veículos:</strong> matrícula, marca, modelo, ano, quilometragem, datas de inspeção, IUC e seguro, fotografia do veículo.</li>
          <li><strong>Registos:</strong> manutenções, abastecimentos, despesas, viagens, marcações e reservas de carregamento.</li>
          <li><strong>Documentos e recibos</strong> que carregar (por exemplo, apólice de seguro ou recibos de oficina), incluindo o texto lido automaticamente (OCR).</li>
          <li><strong>Localização:</strong> só quando pede pesquisas de rotas, postos de combustível ou de carregamento; não guardamos o seu histórico de localização.</li>
          <li><strong>Dados técnicos:</strong> registos de acesso (endereço IP, navegador) para segurança, e erros técnicos da aplicação.</li>
          <li><strong>Pagamentos:</strong> o plano subscrito e o identificador do cliente no fornecedor de pagamentos. Os dados do cartão nunca passam pelos nossos servidores.</li>
        </ul>

        <h2>3. Para que usamos os dados e com que fundamento</h2>
        <ul>
          <li><strong>Prestar o serviço</strong> (gestão dos veículos, cálculo de prazos, lembretes por email e notificações): execução do contrato (art. 6.º, n.º 1, al. b) do RGPD).</li>
          <li><strong>Segurança e prevenção de abuso</strong> (limites de tentativas, registos de acesso): interesse legítimo (al. f).</li>
          <li><strong>Faturação e obrigações fiscais:</strong> obrigação legal (al. c).</li>
          <li><strong>Melhorar o produto</strong> com métricas agregadas de utilização, sem perfis individuais nem publicidade: interesse legítimo (al. f).</li>
        </ul>
        <p>Não vendemos dados, não mostramos publicidade e não fazemos decisões automatizadas com efeitos jurídicos.</p>

        <h2>4. Com quem partilhamos</h2>
        <p>Só com subcontratantes necessários ao serviço, com contratos que os obrigam a proteger os dados:</p>
        <ul>
          <li>Alojamento e bases de dados: [FORNECEDOR, região UE].</li>
          <li>Envio de emails: [FORNECEDOR].</li>
          <li>Pagamentos: [FORNECEDOR, ex.: Stripe].</li>
          <li>Serviços de mapas, dados e imagens consultados quando usa as funcionalidades respetivas (recebem apenas a pesquisa, não a sua conta):{" "}
            {config?.attributions?.length ? config.attributions.map((a) => a.name).join(", ") : "OpenStreetMap, OpenRouteService, OpenChargeMap, DGEG, Wikimedia Commons, Unsplash, OpenWeather"}.
          </li>
          <li>Pessoas com quem decidir partilhar um veículo (veem os dados desse veículo).</li>
        </ul>
        <p>Os dados são guardados na União Europeia. Se algum fornecedor tratar dados fora da UE, isso acontece ao abrigo de cláusulas contratuais-tipo aprovadas pela Comissão Europeia.</p>

        <h2>5. Durante quanto tempo</h2>
        <ul>
          <li>Enquanto a conta estiver ativa. Ao eliminar a conta, apagamos de imediato os dados e os ficheiros.</li>
          <li>Cópias de segurança: até [30] dias, depois são substituídas.</li>
          <li>Dados de faturação: o prazo legal (10 anos).</li>
          <li>Contas sem utilização durante [24] meses: avisamos por email e eliminamos se não houver resposta.</li>
        </ul>

        <h2>6. Os seus direitos</h2>
        <p>Pode, a qualquer momento:</p>
        <ul>
          <li><strong>Aceder e levar os seus dados</strong> (portabilidade): em <Link href="/definicoes">Definições → Os meus dados → Exportar</Link>.</li>
          <li><strong>Corrigir</strong> dados no perfil e nos veículos.</li>
          <li><strong>Apagar a conta</strong> e todos os dados: em <Link href="/definicoes">Definições → Os meus dados</Link>.</li>
          <li><strong>Opor-se ou limitar</strong> tratamentos e <strong>deixar de receber emails</strong> (link em cada email ou nas definições de notificações).</li>
        </ul>
        <p>
          Para outros pedidos escreva para <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>; respondemos no prazo de um mês.
          Pode também apresentar reclamação à Comissão Nacional de Proteção de Dados (<a href="https://www.cnpd.pt" target="_blank" rel="noopener noreferrer">www.cnpd.pt</a>).
        </p>

        <h2>7. Cookies e armazenamento local</h2>
        <p>
          Usamos apenas o essencial: um cookie de sessão seguro (para manter a sessão iniciada) e o armazenamento local do navegador
          para as suas preferências (por exemplo, o tema). Não usamos cookies de publicidade nem de rastreio, por isso não pedimos consentimento para eles.
        </p>

        <h2>8. Segurança</h2>
        <p>
          Ligações cifradas (HTTPS), palavras-passe guardadas em hash, autenticação em dois passos opcional, isolamento dos dados entre contas
          e ficheiros acessíveis apenas ao dono. Em caso de violação de dados, notificamos a CNPD e os utilizadores afetados nos prazos legais.
        </p>

        <h2>9. Alterações</h2>
        <p>Se mudarmos esta política de forma relevante, avisamos por email e na aplicação antes de a alteração produzir efeitos.</p>
      </Prose>
    </PublicLayout>
  );
}
