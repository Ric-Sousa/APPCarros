# Prontidão comercial

## Estado em 2026-11-11 (depois da implementação)

Todo o trabalho de código da avaliação abaixo está feito e testado. Testes: 41 unitários e de integração, com a integração a passar em SQLite, SQL Server 2022 e PostgreSQL; mais os testes ponta a ponta no browser. O CI cobre também o MySQL 8.4. **O que falta é externo ao código**: contas, contratos, validação jurídica e infraestrutura (ver a lista no fim desta secção).

| # | Item | Estado | Onde |
|---|---|---|---|
| B1 | Lembretes por email e push | ✅ Tarefa diária, 30/7/1 dias + no dia + vencido, sem repetições, resumo semanal, link para cancelar, PWA com push | `server/notifications.ts`, `client/public/sw.js` |
| B2 | Recuperar palavra-passe, confirmar email | ✅ Tokens de uso único em hash (1 h / 48 h), aviso na app até confirmar | `server/routes/auth.ts`, páginas `/recuperar`, `/repor-palavra-passe`, `/verificar-email` |
| B3 | Sessão que não expira a cada hora | ✅ Acesso de 15 min em memória + refresh rotativo em cookie `httpOnly`, "manter sessão" 30 dias, sessões por dispositivo; token fora do `localStorage` | `server/session.ts`, `client/src/lib/apiUtils.ts` |
| B4 | RGPD e documentos legais | 🟡 Código feito: exportar dados, eliminar conta, aceitação dos termos guardada, páginas de privacidade e termos (rascunho), registo de tratamentos (modelo), Livro de Reclamações no rodapé. **Falta o jurista** | `/privacidade`, `/termos`, `docs/legal/` |
| B5 | Fonte de dados por matrícula | ⏸️ Pendente (negocial). Sem `VEHICLE_API_URL` a consulta desliga-se e o assistente funciona com preenchimento manual + prazos calculados | — |
| B6 | Sem demonstrações à vista | ✅ IoT escondido (`FEATURE_IOT`), preços reais da DGEG, a comparação EV continua marcada como estimativa | |
| B7 | Operação | 🟡 Código feito: S3 opcional, Sentry opcional, `npm run backup`, `/api/health`, HSTS, encerramento ordenado. **Falta infraestrutura**: HTTPS, staging, monitor de uptime, agendar backups | `server/files.ts`, `server/monitoring.ts`, `scripts/backup.ts` |
| B8 | CI e migrações | ✅ GitHub Actions (tipos, testes, audit, build, MySQL/PostgreSQL/SQL Server, Playwright), Dependabot, migrações de dados versionadas | `.github/`, `server/migrations.ts` |
| B9 | Pagamentos e faturação | 🟡 Stripe (checkout, portal, webhook) e limites dos planos no servidor. **Falta a faturação certificada pela AT** e a conta Stripe de produção | `server/routes/billing.ts`, `shared/plans.ts` |
| B10 | Termos das APIs | 🟡 Atribuições no rodapé (DGEG, OpenStreetMap, OpenChargeMap, Wikimedia/Unsplash). **Falta pedir autorizações e planos** (ver abaixo) | `/api/config` → `Footer` |
| M1 | Onboarding | ✅ Assistente de 3 passos | `OnboardingWizard.tsx` |
| M2 | Prazos automáticos | ✅ IUC e inspeção pela data da matrícula (ligeiros, comerciais, pesados; motociclos sem sugestão) | `shared/deadlines.ts` |
| M3 | PWA | ✅ Manifesto, ícones, service worker (offline para páginas, push), navegação inferior no telemóvel | `client/public/` |
| M4 | Dashboard no telemóvel | ✅ "Precisa de atenção" no topo, indicadores 2×2 | `AttentionCard.tsx` |
| M5 | Ações nos alertas | ✅ Feito (calcula o prazo seguinte), lembrar mais tarde, pagar IUC (Portal das Finanças), marcar inspeção | `AlertActions.tsx` |
| M6 | Página do veículo | ✅ Resumo primeiro; separadores consoante o tipo de veículo | `VehicleSummary.tsx` |
| M7 | Marca única | 🟡 "Logicar" em todo o código (`shared/brand.ts`). **Falta registar o domínio e a marca (INPI) e fazer o logótipo definitivo** | |
| M8 | Página inicial | ✅ Proposta de valor, como funciona, preços, perguntas frequentes, confiança, rodapé legal | `Landing.tsx` |
| M9 | Desempenho percebido | ✅ Miniaturas, `loading="lazy"`, esqueletos | |
| M10 | Anular | ✅ "Anular" ao apagar | `useUndoableDelete.tsx` |
| M11 | Ajuda e contacto | ✅ Perguntas frequentes, feedback dentro da app, email de suporte | `/ajuda` |
| D1 | Preços DGEG | ✅ Postos mais baratos por perto, poupança nas recomendações | `server/services/fuelPrices.ts` |
| D2 | Livro de revisões | ✅ Página para imprimir/guardar em PDF (Premium) | `/vehicle/:id/relatorio` |
| D3 | Calendário | ✅ `.ics` e endereço secreto para subscrever | `server/routes/account.ts` |
| D4 | Validade por OCR | ✅ Seguro e relatório de inspeção, com sugestão a confirmar | `server/routes/records.ts` |
| D5 | Partilha | ✅ Convites por email, papéis dono/condutor | `VehicleSharingDialog.tsx` |
| D6 | Empresas | ✅ Plano por veículo, condutores, CSV da frota para a contabilidade | |
| — | Métricas de produto | ✅ Eventos próprios (sem terceiros), ativação, retenção a 30 dias, feedback | `/admin` |
| — | 2FA | ✅ TOTP opcional | Definições → Segurança |

### ⏸️ Pendente fora do código (para quando sair do ambiente de desenvolvimento)

| Área | O que fazer |
|---|---|
| **AT / faturação** | Ligar um software de faturação certificado pela AT (InvoiceXpress, Moloni, Vendus…) ao webhook do Stripe, para emitir a fatura de cada pagamento. Confirmar o IVA (OSS se houver clientes noutros países da UE). |
| **Jurista** | Rever a política de privacidade, os termos, o registo de tratamentos e os prazos de conservação; preencher [NOME DA EMPRESA], [NIF] e [MORADA]; DPA com o alojamento, o email, o Stripe e o Sentry; procedimento de violação de dados. |
| **Livro de Reclamações Eletrónico** | Registar a empresa em livroreclamacoes.pt (a ligação já está no rodapé). |
| **Dados por matrícula** | Contrato com um fornecedor licenciado, ou manter desligado (B5). |
| **DGEG** | Confirmar por escrito que os preços podem ser usados num serviço comercial (já citamos a fonte e mostramos a data de cada preço). |
| **APIs externas** | Aprovação de produção do Unsplash; plano do OpenRouteService; condições comerciais do OpenWeather e do OpenChargeMap; não usar o Nominatim público em produção com volume. |
| **Marca** | Domínio, registo no INPI, logótipo e ícones definitivos (os atuais são provisórios). |
| **Contas de produção** | SMTP com domínio autenticado (SPF, DKIM, DMARC), Stripe (produtos, preços, webhook), bucket S3/R2, Sentry, chaves VAPID próprias. |
| **Infraestrutura** | HTTPS, staging, monitor de uptime em `/api/health`, backups agendados fora do servidor, com o restauro testado. Com mais de uma instância: Redis para os limites de pedidos. |
| **Segurança** | Pen-test externo antes de vender a empresas. |
| **Mais tarde** | i18n, se houver expansão (as regras de IUC e inspeção são portuguesas); confirmar as regras de inspeção dos motociclos com o IMT. |

---

## Avaliação original

Avaliação de 2026-11-11, feita sobre o commit `b05d0f7`. A pergunta é: o que falta para vender a app e para que as pessoas gostem de a usar?

**Resumo:** a base técnica está sólida e segura. Falta o que separa um projeto de um produto:

1. **A promessa principal ainda não existe.** A página inicial promete "Receba notificações sobre manutenções, inspeções e pagamentos", mas a app não envia nenhuma notificação: nem email, nem push. Hoje o utilizador só vê os alertas se abrir a app.
2. **Faltam o básico de qualquer serviço pago:** recuperar a palavra-passe, verificar o email, sessão que não expira a cada hora, documentos legais (RGPD), pagamentos e faturação.
3. **Há funcionalidades de demonstração à vista do cliente.** IoT, preços de combustível e valores de referência na comparação EV reduzem a confiança num produto pago.
4. **A consulta por matrícula depende de scraping de um site de terceiros.** É um risco legal e técnico para uso comercial.

Legenda de esforço: **P** = horas a 1 dia · **M** = 2 a 5 dias · **G** = 1 a 3 semanas.

---

## ✅ Pontos fortes (manter)

| Área | Porque conta para o negócio |
|---|---|
| **Foco em Portugal** | IUC, inspeção, matrículas PT, pt-PT e categorias IUC. É um nicho bem definido, com problemas reais (multas por IUC ou inspeção em atraso) |
| **Alertas a partir dos dados** | O motor de prazos (óleo e pneus por km; inspeção, IUC e seguro por data) já existe e está testado. Falta só entregá-los fora da app |
| **Segurança** | Isolamento entre utilizadores testado, uploads protegidos, rate limits, 0 vulnerabilidades em dependências, eliminação de conta. É uma boa base para o RGPD |
| **Base técnica** | TypeScript de ponta a ponta, validação partilhada (zod), 27 testes, integração testada em SQLite, SQL Server e PostgreSQL. Escolher o motor de base de dados facilita o alojamento e eventuais clientes empresariais |
| **Funcionalidades com valor real** | OCR de recibos, histórico de manutenção, despesas com CSV, documentos do veículo, planeador de rotas com custo e paragens, fotos com o ano certo |
| **Interface cuidada** | Modo escuro, telemóvel sem transbordos, acessibilidade básica (descrições, `aria-label`), estados vazios explicativos |
| **Documentação** | README, arquitetura, API e avaliações atualizados |

---

## 🔴 Bloqueadores: resolver antes de cobrar

| # | O quê | Porquê | Como | Esforço |
|---|---|---|---|---|
| B1 | **Notificações por email e push** (prazos de IUC, inspeção, seguro, óleo) | É a proposta de valor anunciada. Sem isto, o utilizador esquece-se da app e paga a multa na mesma | Tarefa diária no servidor que corre `syncAlerts` para todos os utilizadores e envia email (Resend, Postmark, Brevo) e push Web (PWA, `web-push`). Antecedência configurável (30/7/1 dias), resumo semanal, link para cancelar | **G** |
| B2 | **Recuperar palavra-passe e verificar email** | Sem isto, quem esquece a palavra-passe perde a conta (e escreve ao suporte). O email verificado é também necessário para B1 | Tokens de uso único com validade de 1h, guardados em hash, enviados pelo mesmo serviço de email | **M** |
| B3 | **Sessão que não expira a cada hora** | Hoje o JWT dura 1h e não há renovação: o utilizador é mandado para o login a meio da utilização. É a pior experiência possível numa app de uso diário | Token de acesso curto e refresh token rotativo em cookie `httpOnly`/`Secure`/`SameSite`; "manter sessão iniciada". Também tira o token do `localStorage` (risco de XSS) | **M** |
| B4 | **RGPD e documentos legais** | A matrícula ligada a uma pessoa é um dado pessoal. Cobrar sem política de privacidade expõe a empresa a coimas | Política de privacidade, termos de utilização, "Exportar os meus dados" (JSON/ZIP, art. 20.º), registo das atividades de tratamento, acordos (DPA) com o alojamento e o fornecedor de email, prazos de retenção. Livro de Reclamações Eletrónico. Validar com um jurista | **M** + jurídico |
| B5 | **Fonte de dados por matrícula** | O `vehicle_api.php` faz scraping de infomatricula.pt: há risco de violar os termos e direitos sobre a base de dados, e de deixar de funcionar a qualquer mudança no site | Fornecedor licenciado de dados por matrícula, acordo com a fonte, ou desligar em produção e manter o preenchimento manual com cálculo automático de prazos (ver M2) | **M** + negocial |
| B6 | **Tirar os dados de demonstração da vista do cliente** | IoT de demonstração, preços de combustível fixos e a comparação EV com valores de referência parecem inventados num produto pago | Esconder o IoT até haver dispositivos reais. Preços reais da DGEG (ver D1). Manter a comparação EV com o rótulo "estimativa" | **P** |
| B7 | **Operação em produção** | Sem backups nem monitorização, um disco cheio ou um erro silencioso é descoberto pelos clientes | Backups automáticos da BD com restauro testado; uploads em armazenamento de objetos (S3, R2, Backblaze) em vez de disco local; Sentry (erros) e monitor de uptime em `/api/health`; HTTPS; ambiente de staging | **M** |
| B8 | **CI e migrações** | Hoje não há pipeline: um erro pode chegar à produção sem passar pelos 27 testes. As alterações à BD só são aditivas | GitHub Actions com `tsc`, testes (SQLite + o motor de produção), build e Playwright nos fluxos principais; migrações versionadas para mudanças de colunas; Dependabot | **M** |
| B9 | **Pagamentos e faturação** | É obrigatório para cobrar em Portugal | Stripe ou easypay/ifthenpay (MB WAY, Multibanco) para subscrições, mais software de faturação certificado pela AT (InvoiceXpress, Moloni, Vendus) por API | **M** |
| B10 | **Termos das APIs externas para uso comercial** | Várias têm limites ou condições para uso comercial | Nominatim (usar OpenRouteService ou uma instância própria), OpenRouteService (plano), Unsplash (pedir aprovação de produção: 50 → 5000 pedidos/h), OpenChargeMap (atribuição), OpenWeather (plano). Rever os termos e pôr as atribuições no rodapé | **P** |

---

## 🟠 Para os utilizadores se sentirem bem

| # | O quê | Situação atual | Proposta | Esforço |
|---|---|---|---|---|
| M1 | **Primeira experiência (onboarding)** | Depois do registo aparece um dashboard com zeros e cinco caixas vazias | Assistente de 3 passos: "Qual é a matrícula?" → confirmar dados e foto → "Quando quer ser avisado?" O objetivo é chegar a um veículo com lembretes ativos em menos de 1 minuto. Esconder as caixas vazias até haver dados | **M** |
| M2 | **Prazos calculados automaticamente** | O utilizador tem de saber e escrever as datas de IUC, inspeção e seguro | O IUC paga-se no mês da matrícula, por isso calcula-se a partir de `registrationDate`. A inspeção de um ligeiro é aos 4 anos, depois de 2 em 2 até aos 8, e depois anual (confirmar as regras do IMT para motos e outras categorias). Sugerir as datas e deixar corrigir | **M** |
| M3 | **App no telemóvel (PWA)** | Não pode ser instalada nem receber push | Manifesto, ícones, service worker (instalar no ecrã inicial, push, funcionar sem rede para consultar). Navegação inferior em telemóvel em vez do menu "hambúrguer" | **M** |
| M4 | **Dashboard em telemóvel** | Os 4 indicadores ocupam o primeiro ecrã inteiro, empilhados | Grelha 2×2 compacta e "o que precisa de atenção hoje" no topo (próximo prazo, com ação rápida: "Já paguei o IUC") | **P** |
| M5 | **Ações rápidas nos alertas** | Só dá para descartar | "Feito" (atualiza a data seguinte: IUC +1 ano, óleo = km atual), "Lembrar daqui a 3 dias", "Marcar inspeção" (link para os centros), "Pagar IUC" (link para o Portal das Finanças) | **M** |
| M6 | **Simplificar a página do veículo** | 7 separadores para qualquer veículo (IoT e Elétrico também numa mota) | Mostrar só o que se aplica ao tipo de veículo. "Resumo" primeiro (prazos, custos do mês, última manutenção) e o resto em segundo plano | **P** |
| M7 | **Marca única** | "Logicar", "LogiCar", "AutoCare" (pasta) e "APPCarros" (repositório) | Escolher um nome, registar o domínio e a marca (INPI), logótipo, ícone, cores e tom de voz. Usar o mesmo em todo o lado | **M** + design |
| M8 | **Página inicial** | Título, 3 cartões e botões | Proposta de valor clara ("Nunca mais pague multa por IUC ou inspeção em atraso"), capturas reais, como funciona em 3 passos, preços, perguntas frequentes, confiança (RGPD, dados em Portugal/UE), rodapé legal. Boa para SEO | **M** |
| M9 | **Desempenho percebido** | As fotos dos cartões vêm com 1080–1280 px para um cartão de cerca de 400 px | Miniaturas de 330–500 px nos cartões e a grande só na página do veículo; `loading="lazy"`; esqueletos de carregamento | **P** |
| M10 | **Confiança nas ações** | Apagar não tem anular | "Anular" no toast depois de apagar (registo, despesa, documento). Confirmações claras para ações destrutivas | **P** |
| M11 | **Ajuda e contacto** | Não existe | Centro de ajuda curto (perguntas frequentes), "Enviar feedback" dentro da app, email de suporte | **P** |

---

## 🟢 Diferenciação (o que faz pagar)

| # | Funcionalidade | Valor | Esforço |
|---|---|---|---|
| D1 | **Preços reais de combustível (DGEG)** e os postos mais baratos por perto e na rota | Poupança visível todas as semanas; são dados abertos oficiais | **M** |
| D2 | **Livro de revisões digital em PDF** (histórico, despesas, documentos) para vender o carro | Valoriza o carro na venda; é um bom motivo para pagar | **M** |
| D3 | **Prazos no calendário** (.ics / Google / Apple) | Os lembretes vão para onde o utilizador já vive | **P** |
| D4 | **Documentos com validade lida por OCR** (carta verde, inspeção, DUA) | Os prazos preenchem-se sozinhos a partir de uma foto do documento | **M** |
| D5 | **Partilha familiar** (vários condutores no mesmo veículo) | Aumenta a retenção e o número de utilizadores por conta | **M** |
| D6 | **Plano para empresas e frotas pequenas** (vários veículos, condutores, relatórios, exportação para contabilidade) | O segmento onde a disposição para pagar é maior | **G** |

**Modelo sugerido (a validar com utilizadores):**
- **Grátis:** 1 veículo, lembretes por email, histórico.
- **Premium** (por exemplo, 2–3 €/mês): veículos ilimitados, push, OCR, PDF, partilha familiar, preços em tempo real.
- **Empresas:** por veículo/mês.

---

## 🔵 Dívida técnica para escalar

| O quê | Quando passa a ser um problema | Esforço |
|---|---|---|
| Alertas sincronizados em cada pedido (`syncAlerts`) | Com milhares de veículos: passar para a tarefa diária de B1 | P (junto com B1) |
| Rate limit e uploads em memória e disco local | Com mais de uma instância do servidor: Redis e armazenamento de objetos (B7) | P |
| Comparação "veículos iguais" calculada veículo a veículo | Com muitos veículos do mesmo modelo: agregação em SQL | P |
| MySQL não testado nesta máquina | Antes de produção em MySQL: correr os testes de integração contra MySQL (no CI, com um contentor) | P |
| `EnhancedRecommendations` (514 linhas), sem testes de componentes no cliente | Quando a equipa crescer: dividir e acrescentar testes Playwright dos fluxos principais (B8) | M |
| Só pt-PT | Ao expandir para Espanha ou o Brasil: i18n (as regras de IUC e inspeção são específicas de Portugal) | G |
| Sem métricas de produto | Já: analytics respeitador da privacidade (Plausible, Umami) para medir ativação (veículo com lembretes ativos), retenção a 30 dias e aberturas de notificações | P |
| Sem segundo fator (2FA) e sem auditoria de segurança | Antes de vender a empresas: 2FA opcional e pen-test externo | M |

---

## Plano proposto

**Fase 1, lançamento beta gratuito (4 a 6 semanas):** B1, B2, B3, B4, B6, B7, B8, B10, M1, M2, M3, M4 e M7.
É o mínimo para pessoas reais usarem a app todos os dias sem perder dados nem confiança. Medir a ativação e a retenção.

**Fase 2, cobrar (3 a 4 semanas):** B5, B9, M5, M8, D1 e D3.
O plano Premium com valor claro: preços reais, lembretes onde o utilizador vive e ações rápidas.

**Fase 3, crescer:** D2, D4, D5, D6, i18n e 2FA, segundo o que os dados da fase 1 mostrarem.

Antes da fase 2, fazer 5 a 10 entrevistas com utilizadores da beta, para validar o preço e as funcionalidades mais valorizadas.
