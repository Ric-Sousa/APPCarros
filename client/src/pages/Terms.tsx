import { Link } from "wouter";
import PublicLayout, { Prose } from "@/components/PublicLayout";
import { DraftNotice } from "@/pages/Privacy";
import { BRAND } from "@shared/brand";
import { PLANS } from "@shared/plans";

export default function Terms() {
  return (
    <PublicLayout>
      <Prose>
        <DraftNotice />
        <h1>Termos de Utilização</h1>
        <p>Última atualização: 11 de novembro de 2026.</p>

        <h2>1. O serviço</h2>
        <p>
          O {BRAND.name} é um serviço online de [NOME DA EMPRESA], NIF [NIF], com sede em [MORADA], para gerir veículos:
          prazos legais (IUC, inspeção, seguro), manutenção, combustível, despesas e documentos.
        </p>

        <h2>2. Conta</h2>
        <ul>
          <li>Tem de ter pelo menos 16 anos e indicar dados verdadeiros.</li>
          <li>É responsável por manter a palavra-passe segura. Recomendamos ativar a autenticação em dois passos.</li>
          <li>Só pode registar veículos que lhe pertencem ou que tem autorização para gerir.</li>
        </ul>

        <h2>3. Prazos e lembretes: limite de responsabilidade</h2>
        <p>
          As datas sugeridas (IUC, inspeção, manutenção) são calculadas a partir dos dados que indica e de regras gerais, e servem de ajuda.
          Não substituem as obrigações legais do proprietário nem a informação oficial da Autoridade Tributária ou do IMT.
          Confirme sempre os prazos oficiais. Não respondemos por coimas ou prejuízos resultantes de datas incorretas ou de lembretes não recebidos
          (por exemplo, por falha do email ou do dispositivo).
        </p>

        <h2>4. Planos e pagamentos</h2>
        <ul>
          <li>O plano {PLANS.free.name} é gratuito, com os limites indicados na página <Link href="/planos">Planos</Link>.</li>
          <li>Os planos pagos são subscrições mensais renovadas automaticamente, cobradas pelo fornecedor de pagamentos indicado no checkout. Recebe fatura por email.</li>
          <li>Pode cancelar a qualquer momento nas definições; o plano mantém-se até ao fim do período pago.</li>
          <li>Direito de livre resolução: 14 dias após a primeira subscrição, com reembolso, salvo se pediu expressamente o início imediato do serviço e o utilizou.</li>
          <li>Se mudarmos os preços, avisamos com pelo menos 30 dias de antecedência.</li>
        </ul>

        <h2>5. Utilização aceitável</h2>
        <p>Não pode usar o serviço para atividades ilegais, tentar aceder a dados de outros utilizadores, sobrecarregar o serviço ou extrair dados de forma automatizada.</p>

        <h2>6. Conteúdos e dados</h2>
        <p>
          Os dados e ficheiros que carrega são seus. Concede-nos apenas a licença necessária para os guardar e mostrar no serviço.
          Pode exportá-los e apagá-los a qualquer momento (ver a <Link href="/privacidade">Política de Privacidade</Link>).
          Imagens e dados de terceiros (mapas, preços de combustível, fotografias) são apresentados com a respetiva atribuição e licença.
        </p>

        <h2>7. Disponibilidade</h2>
        <p>Esforçamo-nos por manter o serviço sempre disponível, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros.</p>

        <h2>8. Fim do contrato</h2>
        <p>Pode eliminar a conta a qualquer momento. Podemos suspender contas que violem estes termos, com aviso prévio sempre que possível.</p>

        <h2>9. Reclamações e lei aplicável</h2>
        <p>
          Contacte-nos primeiro em <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>. Dispõe também do{" "}
          <a href="https://www.livroreclamacoes.pt" target="_blank" rel="noopener noreferrer">Livro de Reclamações Eletrónico</a> e pode recorrer a uma
          entidade de resolução alternativa de litígios de consumo: [ENTIDADE RAL, ex.: CNIACC — www.arbitragemdeconsumo.org].
          Aplica-se a lei portuguesa.
        </p>
      </Prose>
    </PublicLayout>
  );
}
