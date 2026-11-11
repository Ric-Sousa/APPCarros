# Registo das atividades de tratamento (RGPD, art. 30.º)

> **Modelo a validar por um jurista antes do lançamento.** Os campos entre `[ ]` dependem da empresa e dos fornecedores escolhidos.

**Responsável pelo tratamento:** `[Nome da empresa, NIPC, morada]`. Contacto: `[privacidade@logicar.pt]`. Encarregado de proteção de dados: `[nome/contacto, se aplicável]`.

| # | Atividade | Finalidade | Base legal | Titulares e dados | Destinatários / subcontratantes | Transferências fora da UE | Prazo de conservação |
|---|---|---|---|---|---|---|---|
| 1 | Conta de utilizador | Criar e gerir a conta, autenticação | Execução do contrato (art. 6.º/1/b) | Utilizadores: nome, email, palavra-passe (hash), telefone, morada, bio e foto (opcionais), sessões (navegador, datas) | Alojamento `[fornecedor]` | `[não / cláusulas-tipo]` | Enquanto a conta existir; apagado ao eliminar a conta. Sessões: até 30 dias |
| 2 | Gestão de veículos | Guardar veículos, prazos, manutenções, despesas, abastecimentos, viagens e documentos | Execução do contrato | Utilizadores e condutores convidados: matrícula, dados do veículo, km, custos, documentos (podem conter dados de terceiros, ex.: seguro) | Alojamento; armazenamento de ficheiros `[S3/R2]` | `[ ]` | Enquanto a conta existir |
| 3 | Lembretes | Avisar de prazos (IUC, inspeção, seguro, manutenção) por email e push | Execução do contrato; o utilizador escolhe os canais | Email, subscrições push, histórico de envios | Fornecedor de email `[ ]`; serviços push dos browsers (Google, Mozilla, Apple) | Sim (serviços push) `[avaliar]` | Histórico de envios: `[12 meses]` |
| 4 | Partilha de veículos | Convidar condutores para um veículo | Execução do contrato / interesse legítimo do convidante | Email do convidado, aceitação | Fornecedor de email | `[ ]` | Convites por aceitar: `[90 dias]`; membros: até serem removidos |
| 5 | Pagamentos | Cobrar subscrições | Execução do contrato; obrigação legal (faturação) | Nome, email, id de cliente Stripe; dados de pagamento ficam só no Stripe | Stripe; software de faturação certificado `[ ]` | Sim (Stripe, cláusulas-tipo) | Faturas: 10 anos (obrigação fiscal) |
| 6 | OCR de recibos e documentos | Ler valores e datas para preencher registos | Execução do contrato | Imagens/PDF enviados | Processado no próprio servidor (sem terceiros) | Não | Com o registo a que pertence |
| 7 | Suporte e feedback | Responder a pedidos | Interesse legítimo / execução do contrato | Mensagem, email, página | Fornecedor de email | `[ ]` | `[24 meses]` |
| 8 | Segurança e erros | Detetar abusos e erros | Interesse legítimo (art. 6.º/1/f) | IP (limites de pedidos, em memória), registos técnicos sem corpos de pedidos, erros (Sentry) | Sentry `[se usado]` | `[ ]` | Registos: `[30 dias]` |
| 9 | Métricas de produto | Medir ativação e retenção | Interesse legítimo | Eventos internos por utilizador (ex.: "veículo criado"), sem conteúdo | — | Não | `[24 meses]`, apagados com a conta |

**Serviços externos chamados com dados do utilizador:** consulta por matrícula (`[fornecedor licenciado]`), geocoding/rotas (OpenRouteService/Nominatim: moradas e coordenadas pesquisadas), meteorologia (OpenWeather: cidade), preços DGEG e OpenChargeMap (coordenadas aproximadas), fotos (Wikimedia/Unsplash: marca e modelo). Confirmar os termos e, quando necessário, o acordo de subcontratação (DPA).

**Direitos dos titulares (na app):** acesso e portabilidade (Perfil → Exportar os meus dados, JSON), retificação (Perfil), apagamento (Perfil → Eliminar conta), oposição aos lembretes (preferências e link em cada email).

**Medidas de segurança (art. 32.º):** HTTPS, palavras-passe com bcrypt, 2FA opcional, sessões revogáveis, isolamento entre contas testado, ficheiros privados, limites de pedidos, backups, princípio do menor privilégio na base de dados. Ver `docs/ARQUITETURA.md`.

**Pendente (fora do código):** DPA com o alojamento, o email, o Stripe e o Sentry; avaliação das transferências; prazos de conservação definitivos; procedimento de violação de dados (72 h à CNPD).
