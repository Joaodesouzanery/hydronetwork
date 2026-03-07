# CONSTRUDATA HYDRONETWORK — Processo de Onboarding do Cliente

> Sistema estruturado de onboarding em 5 etapas para garantir ativacao rapida, eliminar remorso pos-compra e criar momentum imediato.

**Data:** Marco 2026 | **Revisao:** Trimestral

---

## VISAO GERAL DO FLUXO

```
FECHAMENTO
    │
    ▼
┌──────────────────────────────────────────────────────────────────┐
│  ETAPA 1: CONTRATO                                               │
│  Enviar contrato digital para assinatura                         │
│  Nada avanca sem assinatura. Protege ambos os lados.             │
│  Timeline: Dia 0                                                 │
└──────────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────────┐
│  ETAPA 2: PAGAMENTO                                              │
│  Enviar fatura com link de pagamento Stripe                      │
│  Sem friccao. Paga e ja esta dentro.                             │
│  Timeline: Imediato apos assinatura                              │
└──────────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────────┐
│  ETAPA 3: DOCUMENTO DE BOAS-VINDAS                               │
│  PDF/email profissional com visao do projeto, proximos passos,   │
│  canais de comunicacao e cronograma de implantacao.               │
│  Timeline: Automatico apos confirmacao do pagamento              │
└──────────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────────┐
│  ETAPA 4: CALL DE ESTRATEGIA (KICKOFF)                           │
│  Reuniao de alinhamento: metas, direcao, timeline, logistica.    │
│  Timeline: Ate 48h apos pagamento                                │
└──────────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────────┐
│  ETAPA 5: ELIMINAR REMORSO DO COMPRADOR                          │
│  Criar progresso imediato. O cliente ve o sistema, o cronograma  │
│  e os proximos passos ANTES de ter tempo de duvidar.             │
│  Timeline: Nos primeiros 30 minutos apos pagamento               │
└──────────────────────────────────────────────────────────────────┘
```

---

## ETAPA 1: ENVIO DO CONTRATO

### Principio
> Nada avanca sem contrato assinado. Escopo claro, entregaveis claros, cronograma claro, politica de revisao clara. Isso protege ambos os lados desde o dia zero.

### O Contrato Deve Conter

**1.1 Identificacao das Partes**
- Dados da ConstruData (CNPJ, endereco, representante)
- Dados do cliente (empresa, CNPJ, responsavel tecnico, responsavel financeiro)

**1.2 Escopo Detalhado**

| Item | Descricao | Exemplo |
|------|-----------|---------|
| Plano contratado | Nome do plano + limites | Profissional: 10 obras, 20 usuarios, 100 GB |
| Modulos inclusos | Lista completa dos modulos | Esgoto, Agua, Drenagem, EPANET PRO, LPS, RDO, Orcamento SINAPI, BDI TCU |
| Add-ons (se houver) | Modulos premium contratados | CAESB/SABESP, Transientes, SWMM |
| Servicos inclusos | Implantacao, treinamento, suporte | Setup + migracao + 4h treinamento + suporte 24h |

**1.3 Entregaveis com Datas**

| Entregavel | Prazo | Responsavel |
|------------|-------|-------------|
| Ambiente configurado com credenciais | D+1 (dia util apos pagamento) | ConstruData |
| Migracao de dados topograficos | D+3 | ConstruData + Cliente |
| Treinamento modulos core (Dimensionamento + Orcamento) | D+5 a D+7 | ConstruData |
| Treinamento modulos avancados (EPANET, LPS, RDO) | D+8 a D+10 | ConstruData |
| Go-live (uso autonomo) | D+15 | Cliente |
| Check-in de acompanhamento | D+30 | ConstruData |

**1.4 Cronograma e Prazos**
- Duracao do contrato: 6 ou 12 meses
- Data de inicio: a partir da confirmacao do pagamento
- Renovacao: automatica, com aviso de 30 dias para cancelamento
- Reajuste: IGPM ou 10% anual, o menor

**1.5 Politica de Revisoes e Alteracoes**
- Alteracoes de escopo requerem aditivo contratual
- Upgrade de plano: a qualquer momento, diferenca pro-rata
- Downgrade: apenas na renovacao
- Customizacoes fora do escopo: orcamento separado via Evolucao Tecnologica

**1.6 Investimento e Condicoes Financeiras**

| Item | Valor | Frequencia |
|------|-------|------------|
| Taxa de implantacao | R$ 3.500 - R$ 150.000 (conforme porte) | Unica |
| Mensalidade do plano | R$ 997 - R$ 14.997 (conforme plano) | Mensal |
| Desconto anual | 16,7% (paga 10 meses, usa 12) | Anual |

**1.7 Clausulas Essenciais**
- **Confidencialidade:** Dados do cliente sao protegidos e nunca compartilhados
- **Propriedade dos dados:** O cliente e dono dos seus dados e pode exportar a qualquer momento (CSV, Excel, SHP, GeoJSON)
- **SLA de disponibilidade:** Conforme plano (99% Starter, 99.5% Enterprise, 99.9% Concessionaria)
- **Suporte:** Canal e prazo de resposta conforme plano contratado
- **Cancelamento:** Aviso previo de 30 dias apos periodo minimo, sem multa
- **Foro:** Comarca da sede da ConstruData

### Ferramenta de Assinatura
- **Recomendado:** DocuSign, Clicksign ou PandaDoc
- Assinatura digital com validade juridica
- Ambas as partes recebem copia assinada automaticamente
- Tracking: notificacao quando o contrato for visualizado e assinado

### Template de Email — Envio do Contrato

```
Assunto: ConstruData HydroNetwork — Contrato de Licenciamento [Nome da Empresa]

Ola [Nome],

Estamos muito felizes em ter a [Empresa] como parceira da ConstruData HydroNetwork!

Segue o contrato para assinatura digital:

🔗 [Link para assinatura — Clicksign/DocuSign]

Resumo do que esta incluso:
- Plano [Profissional/Enterprise]: [X] obras, [Y] usuarios
- Implantacao completa com migracao de dados
- Treinamento da equipe ([X]h online)
- Suporte [Email + WhatsApp / Dedicado]

Apos a assinatura, enviaremos a fatura para pagamento e
o processo de implantacao comeca imediatamente.

Qualquer duvida sobre os termos, estou a disposicao.

Abraco,
[Nome]
ConstruData HydroNetwork
```

### Checklist Interno — Etapa 1
- [ ] Contrato gerado com dados corretos do cliente
- [ ] Plano e modulos conferidos
- [ ] Cronograma de implantacao definido
- [ ] Link de assinatura enviado
- [ ] Assinatura confirmada
- [ ] Copia arquivada no CRM

---

## ETAPA 2: PAGAMENTO SEM FRICCAO

### Principio
> Tornar o pagamento o mais facil possivel. Sem burocracia, sem atrito. O cliente paga e ja esta dentro.

### Metodos de Pagamento via Stripe

| Metodo | Disponivel | Observacao |
|--------|-----------|-----------|
| Cartao de credito | Sim | Visa, Mastercard, Amex — parcela em ate 12x |
| Boleto bancario | Sim (via Stripe) | Vencimento em 3 dias uteis |
| PIX | Sim (via Stripe) | Confirmacao instantanea |
| Transferencia bancaria | Manual | Para contratos Enterprise/Concessionaria |

### Configuracao no Stripe

**Produtos a criar no Stripe:**

| Produto | Tipo | Preco | Recorrencia |
|---------|------|-------|-------------|
| Setup Micro | One-time | R$ 3.500 | Unico |
| Setup Pequeno | One-time | R$ 7.500 | Unico |
| Setup Medio | One-time | R$ 15.000 | Unico |
| Setup Grande | One-time | R$ 35.000 | Unico |
| Plano Starter | Subscription | R$ 997/mes | Mensal |
| Plano Profissional | Subscription | R$ 2.497/mes | Mensal |
| Plano Enterprise | Subscription | R$ 5.997/mes | Mensal |
| Plano Concessionaria | Subscription | R$ 14.997/mes | Mensal |
| Starter Anual | Subscription | R$ 9.970/ano | Anual |
| Profissional Anual | Subscription | R$ 24.970/ano | Anual |
| Enterprise Anual | Subscription | R$ 59.970/ano | Anual |

**Payment Links:**
- Gerar Stripe Payment Link para cada combinacao de plano + setup
- Link personalizavel com nome do cliente e desconto (se aplicavel)
- Checkout page com logo ConstruData e cores da marca

### Fluxo Pos-Pagamento (Automatico via Stripe Webhook)

```
Pagamento confirmado (Stripe webhook)
    │
    ├── 1. Criar usuario no Supabase (admin-create-user)
    ├── 2. Enviar email de boas-vindas (Resend)
    ├── 3. Ativar plano no banco de dados
    ├── 4. Notificar equipe interna (Slack/email)
    └── 5. Registrar no CRM como "Cliente Ativo"
```

### Template de Email — Envio da Fatura

```
Assunto: ConstruData HydroNetwork — Fatura e Link de Pagamento

Ola [Nome],

Obrigado por assinar o contrato! Estamos prontos para comecar.

Segue o link para pagamento:

💳 [Stripe Payment Link]

Resumo:
┌─────────────────────────────────────────┐
│ Taxa de Implantacao:    R$ [valor]       │
│ Plano [nome] (mensal):  R$ [valor]/mes   │
│ Total hoje:             R$ [valor]       │
└─────────────────────────────────────────┘

Metodos aceitos: Cartao, PIX, Boleto

Apos a confirmacao do pagamento:
✅ Voce recebe acesso imediato a plataforma
✅ Enviamos o Documento de Boas-Vindas
✅ Agendamos a Call de Estrategia (kickoff)

Em caso de duvida sobre faturamento, responda este email.

Abraco,
[Nome]
ConstruData HydroNetwork
```

### Checklist Interno — Etapa 2
- [ ] Payment Link gerado no Stripe
- [ ] Valores conferidos (plano + setup + desconto)
- [ ] Email com fatura enviado
- [ ] Pagamento confirmado
- [ ] Webhook processado (usuario criado, plano ativado)
- [ ] Nota fiscal emitida

---

## ETAPA 3: DOCUMENTO DE BOAS-VINDAS

### Principio
> O cliente precisa saber exatamente o que comprou, o que acontece agora e como se comunicar. Zero ambiguidade. Clareza total = confianca total.

### Conteudo do Documento de Boas-Vindas

**Formato:** PDF profissional com identidade visual ConstruData + email com mesmas informacoes.

---

#### 3.1 Mensagem de Abertura

```
Bem-vindo a ConstruData HydroNetwork!

Voce acaba de dar um passo importante para modernizar a gestao de
engenharia da [Nome da Empresa].

Este documento contem tudo que voce precisa saber sobre os proximos
passos. Guarde-o como referencia — ele sera seu guia durante todo
o processo de implantacao.
```

#### 3.2 Visao Geral do Projeto

| Item | Detalhe |
|------|---------|
| **Plano contratado** | [Profissional / Enterprise / Concessionaria] |
| **Obras/projetos inclusos** | [X] obras simultaneas |
| **Usuarios** | [Y] usuarios |
| **Modulos ativos** | [Lista de modulos] |
| **Periodo do contrato** | [Data inicio] a [Data fim] |
| **Valor mensal** | R$ [valor] |

#### 3.3 O Que Acontece Agora (Timeline Visual)

```
SEMANA 1 — SETUP E CONFIGURACAO
├── Dia 1: Credenciais de acesso enviadas por email
├── Dia 1: Ambiente configurado (plano, modulos, limites)
├── Dia 2-3: Migracao de dados topograficos (se houver)
└── Dia 3: Verificacao de ambiente + teste de acesso

SEMANA 2 — TREINAMENTO CORE
├── Sessao 1 (2h): Importacao de Topografia + Dimensionamento de Rede
├── Sessao 2 (2h): Quantitativos + Orcamento SINAPI + BDI TCU
└── Material de apoio: Videos + guia rapido em PDF

SEMANA 3 — TREINAMENTO AVANCADO
├── Sessao 3 (2h): EPANET / Simulacao Hidraulica
├── Sessao 4 (2h): Planejamento (Gantt + Curva S) + LPS Lean
└── Sessao 5 (2h): RDO Digital + Controle de Producao

SEMANA 4 — GO-LIVE
├── Uso autonomo pela equipe
├── Canal de suporte ativo para duvidas
└── Check-in de acompanhamento agendado (Dia 30)

MES 2-3 — ACOMPANHAMENTO
├── Check-in mensal (30 min) para feedback e ajustes
├── Envio de novidades e atualizacoes
└── Avaliacao de satisfacao (NPS)
```

#### 3.4 Detalhes de Comunicacao

| Canal | Para que usar | Tempo de resposta |
|-------|--------------|-------------------|
| **Email:** suporte@construdata.software | Duvidas tecnicas, solicitacoes formais | [24h / 48h / 72h conforme plano] |
| **WhatsApp:** +55 (XX) XXXXX-XXXX | Duvidas rapidas, agendamentos | [Imediato / 24h conforme plano] |
| **Reunioes agendadas** | Treinamentos, check-ins, estrategia | Conforme cronograma |
| **Central de Ajuda** | Tutoriais, FAQ, guias | Autoatendimento 24/7 |

**Contato principal (seu gerente de conta):**
- Nome: [Nome do responsavel]
- Email: [email]
- WhatsApp: [numero]
- Disponibilidade: Seg-Sex, 8h-18h

#### 3.5 Acesso a Plataforma

```
🔗 URL: https://construdata.software
📧 Login: [email cadastrado]
🔑 Senha: [enviada separadamente por email seguro]

Primeiro acesso:
1. Acesse o link acima
2. Faca login com suas credenciais
3. Complete o onboarding guiado (tour da plataforma)
4. Explore o projeto demo (Itapetininga 3.2 km)
5. Importe seus proprios dados quando estiver pronto
```

#### 3.6 Recursos e Materiais de Apoio

| Recurso | Link/Localizacao |
|---------|-----------------|
| Central de Ajuda | /help-center na plataforma |
| Tutoriais em Video | /tutorials na plataforma |
| Projeto Demo | Pre-carregado no ambiente |
| Guia Rapido (PDF) | Anexo ao email de boas-vindas |
| FAQ Tecnico | /help-center > FAQ |

### Template de Email — Boas-Vindas

```
Assunto: 🎉 Bem-vindo a ConstruData HydroNetwork — Seus Proximos Passos

Ola [Nome],

Pagamento confirmado! A [Empresa] agora faz parte da ConstruData HydroNetwork.

📄 Documento de Boas-Vindas completo em anexo (PDF).

Aqui vai o resumo dos seus proximos passos:

1️⃣  ACESSE A PLATAFORMA
    URL: https://construdata.software
    Login: [email]
    Senha: enviada em email separado

2️⃣  EXPLORE O DEMO
    Um projeto de exemplo (rede de 3.2 km) ja esta
    carregado para voce testar todos os modulos.

3️⃣  AGENDE O KICKOFF
    Clique no link abaixo para escolher o melhor horario
    para nossa Call de Estrategia (45 min):
    📅 [Link Calendly/Cal.com]

4️⃣  CRONOGRAMA COMPLETO
    Veja no PDF anexo o cronograma semana a semana
    da sua implantacao.

Seu contato direto:
[Nome] — [WhatsApp] — [Email]

Estamos animados para comecar!

Abraco,
Equipe ConstruData HydroNetwork
```

### Checklist Interno — Etapa 3
- [ ] Documento de Boas-Vindas gerado (PDF com dados do cliente)
- [ ] Credenciais criadas e testadas
- [ ] Email de boas-vindas enviado
- [ ] Senha enviada em email separado
- [ ] Projeto demo carregado no ambiente do cliente
- [ ] Link de agendamento do kickoff incluso

---

## ETAPA 4: CALL DE ESTRATEGIA (KICKOFF)

### Principio
> O kickoff nao e uma demo. E uma reuniao de alinhamento estrategico. Metas, direcao, timeline, logistica e tudo o que importa para o sucesso do projeto.

### Estrutura da Reuniao (45-60 minutos)

#### Bloco 1 — Alinhamento de Contexto (10 min)

| Pergunta | Por que importa |
|----------|----------------|
| Quantas obras ativas voces tem hoje? | Dimensionar uso da plataforma |
| Qual o maior gargalo atual da equipe? | Priorizar modulos no treinamento |
| Quem sao os usuarios principais? | Definir niveis de acesso e perfis |
| Ja usam algum software de engenharia? | Entender migracao necessaria |
| Quais concessionarias atendem? | Ativar modulos de conformidade (CAESB, SABESP) |

#### Bloco 2 — Definicao de Metas (10 min)

| Meta | Exemplo | Metrica |
|------|---------|---------|
| **Quick Win (Semana 1)** | Dimensionar a rede do projeto X na plataforma | Projeto importado + dimensionado |
| **Meta 30 dias** | Toda equipe usando RDO digital | 100% dos RDOs via plataforma |
| **Meta 90 dias** | Gestao integrada (projeto + orcamento + obra) | Dashboard com KPIs ativos |

#### Bloco 3 — Logistica de Implantacao (10 min)

| Item | Definir |
|------|---------|
| **Dados para migracao** | Topografia (CSV/DXF/SHP), projetos existentes, base de precos |
| **Usuarios e permissoes** | Lista de emails, niveis de acesso (admin, engenheiro, tecnico, campo) |
| **Agenda de treinamentos** | Datas e horarios para as 5 sessoes de treinamento |
| **Canal de suporte preferido** | Email, WhatsApp ou ambos |
| **Responsavel tecnico do cliente** | Quem sera o ponto focal interno |

#### Bloco 4 — Demonstracao Direcionada (15 min)

Baseado nas dores identificadas no Bloco 1, demonstrar os modulos mais relevantes:

| Se a dor for... | Demonstrar... |
|-----------------|--------------|
| Dimensionamento manual lento | Importacao de topografia + dimensionamento automatico |
| Orcamentos demorados | Quantitativos automaticos + SINAPI + BDI TCU |
| RDO no papel/WhatsApp | RDO Digital com fotos, equipes, clima |
| Falta de controle de obra | Dashboard + Producao + Alertas |
| Planejamento desconectado | Gantt + Curva S + LPS Lean |
| Conformidade normativa | Modulo CAESB/SABESP com checklists |

#### Bloco 5 — Proximos Passos e Compromissos (5 min)

```
COMPROMISSOS POS-KICKOFF:

ConstruData:
☐ Configurar ambiente com [X] usuarios ate [data]
☐ Migrar dados topograficos ate [data]
☐ Agendar Sessao 1 de treinamento para [data]

Cliente:
☐ Enviar lista de usuarios com emails ate [data]
☐ Enviar arquivos topograficos (CSV/DXF/SHP) ate [data]
☐ Definir projeto-piloto para primeira implantacao
```

### Ferramenta de Agendamento
- **Recomendado:** Calendly ou Cal.com
- Slots pre-definidos: Seg-Sex, 9h-17h
- Duracao: 45 min (com buffer de 15 min)
- Link incluso no email de boas-vindas
- Confirmacao automatica + lembrete 24h antes

### Checklist Interno — Etapa 4
- [ ] Call agendada (Calendly/Cal.com)
- [ ] Pesquisa previa sobre o cliente (porte, tipo de obra, regiao)
- [ ] Pauta preparada com base no perfil do cliente
- [ ] Call realizada e gravada (com consentimento)
- [ ] Ata com compromissos enviada por email ao cliente
- [ ] Cronograma de treinamento confirmado

---

## ETAPA 5: ELIMINAR O REMORSO DO COMPRADOR

### Principio
> Logo apos pagar, a duvida pode aparecer: "Sera que fiz bem? Sera que vale a pena?" O antidoto e PROGRESSO IMEDIATO. O cliente precisa ver sistema, cronograma e proximos passos ANTES de ter tempo de duvidar.

### A Psicologia por Tras

```
MOMENTO DO PAGAMENTO
        │
        ▼
┌─────────────────────┐     ┌─────────────────────┐
│  SEM ONBOARDING:    │     │  COM ONBOARDING:     │
│                     │     │                      │
│  "Paguei R$ 2.500   │     │  "Ja recebi acesso,  │
│   e agora? Silencio  │     │   ja vi o cronograma, │
│   por 3 dias..."     │     │   ja explorei o demo, │
│                     │     │   ja tem kickoff      │
│   → REMORSO         │     │   agendado para       │
│   → DUVIDA          │     │   amanha."            │
│   → PEDIDO DE       │     │                      │
│     CANCELAMENTO    │     │   → CONFIANCA         │
│                     │     │   → EMPOLGACAO         │
│                     │     │   → COMPROMISSO        │
└─────────────────────┘     └─────────────────────┘
```

### Acoes Automaticas nos Primeiros 30 Minutos

| Tempo | Acao | Canal | Responsavel |
|-------|------|-------|-------------|
| **T+0 min** | Pagamento confirmado | Stripe webhook | Automatico |
| **T+1 min** | Email de confirmacao de pagamento | Email (Stripe) | Automatico |
| **T+2 min** | Usuario criado + plano ativado | Supabase | Automatico (webhook) |
| **T+5 min** | Email de boas-vindas + credenciais + PDF | Email (Resend) | Automatico |
| **T+5 min** | Senha em email separado | Email (Resend) | Automatico |
| **T+10 min** | WhatsApp pessoal do gerente de conta | WhatsApp | Manual |
| **T+15 min** | Projeto demo carregado no ambiente | Supabase | Automatico |
| **T+30 min** | Link de agendamento do kickoff | Incluso no email | Automatico |

### Mensagem de WhatsApp Pessoal (T+10 min)

```
Ola [Nome]! Aqui e o [Seu Nome] da ConstruData. 👋

Vi que o pagamento foi confirmado — seu acesso ja esta ativo!

Mandei um email com tudo: credenciais, documento de boas-vindas
e o cronograma de implantacao.

Quando puder, acesse a plataforma e explore o projeto demo
que ja esta carregado la. Vai ver como o dimensionamento
automatico funciona na pratica.

E no email tem o link para agendar nosso Kickoff — quanto
antes fizermos, mais rapido sua equipe esta rodando.

Qualquer duvida, me chama por aqui mesmo!
```

### Elementos que Criam Progresso Imediato

| Elemento | O que o cliente ve | Efeito psicologico |
|----------|--------------------|--------------------|
| **Acesso instantaneo** | Login funcionando minutos apos pagamento | "Ja estou dentro, ja comecou" |
| **Projeto demo** | Rede de 3.2 km com todos os modulos funcionando | "Isso e real, funciona de verdade" |
| **Cronograma visual** | Timeline semana a semana no PDF de boas-vindas | "Eles tem um plano claro para mim" |
| **Contato pessoal** | WhatsApp do gerente de conta em 10 min | "Tem alguem cuidando de mim" |
| **Kickoff agendado** | Data concreta para a reuniao de estrategia | "Ja tem proximo passo definido" |
| **Tour guiado na plataforma** | Onboarding interativo no primeiro login | "Sei onde encontrar cada coisa" |

### Sequencia de Emails Anti-Remorso (Primeiros 7 Dias)

| Dia | Assunto | Conteudo |
|-----|---------|---------|
| **Dia 0** | Bem-vindo a ConstruData! | Credenciais + PDF + link kickoff |
| **Dia 1** | Dica rapida: importe sua topografia em 2 minutos | Tutorial curto de importacao CSV/DXF |
| **Dia 2** | Voce sabia? O dimensionamento que leva 3 dias no Excel leva 15 min aqui | Video de 60s mostrando dimensionamento |
| **Dia 3** | Seu kickoff esta agendado para [data] — o que vamos cobrir | Preview da pauta do kickoff |
| **Dia 5** | [Nome], como esta a exploracao? Precisa de ajuda? | Check-in pessoal com oferta de suporte |
| **Dia 7** | Resumo da sua primeira semana + proximos passos | Recapitulacao do que foi feito + o que vem |

### Metricas de Sucesso do Onboarding

| Metrica | Meta | Como medir |
|---------|------|------------|
| Tempo ate primeiro login | < 24h | Supabase: auth.users.last_sign_in |
| Tempo ate kickoff | < 48h | Calendario |
| Projeto demo explorado | 100% dos clientes | Analytics de navegacao |
| Primeiro projeto proprio criado | < 7 dias | Supabase: hydro_dimensioning_projects |
| Primeiro RDO preenchido | < 15 dias | Supabase: daily_reports |
| NPS no dia 30 | > 8 | Pesquisa de satisfacao |
| Churn nos primeiros 90 dias | < 5% | Stripe: cancelamentos |

### Checklist Interno — Etapa 5
- [ ] Webhooks Stripe configurados para criacao automatica de usuario
- [ ] Template de email de boas-vindas configurado no Resend
- [ ] Sequencia de 7 emails configurada (drip campaign)
- [ ] Projeto demo pre-carregado para novos ambientes
- [ ] Script de WhatsApp pronto para o gerente de conta
- [ ] Onboarding tour configurado na plataforma
- [ ] Metricas de onboarding sendo coletadas

---

## RESUMO — TIMELINE COMPLETA DO ONBOARDING

```
DIA 0 (Fechamento)
│
├── Contrato enviado para assinatura digital
├── Cliente assina → fatura enviada com link Stripe
├── Cliente paga → em 5 min:
│     ├── Usuario criado
│     ├── Plano ativado
│     ├── Email de boas-vindas enviado
│     ├── PDF com cronograma enviado
│     └── WhatsApp pessoal do gerente
│
├── Cliente acessa plataforma → projeto demo disponivel
└── Link de agendamento do kickoff enviado

DIA 1-2
│
├── Kickoff realizado (45 min)
├── Metas definidas (quick win, 30 dias, 90 dias)
├── Cronograma de treinamento confirmado
└── Dados para migracao recebidos

DIA 3-5
│
├── Dados topograficos migrados
├── Treinamento Sessao 1 (Dimensionamento + Importacao)
└── Email: dica rapida de uso

DIA 5-10
│
├── Treinamento Sessao 2 (Orcamento + BDI)
├── Treinamento Sessao 3 (EPANET / Simulacao)
└── Email: check-in "como esta indo?"

DIA 10-15
│
├── Treinamento Sessao 4 (Planejamento + LPS)
├── Treinamento Sessao 5 (RDO + Producao)
└── Go-live: equipe usando autonomamente

DIA 15-30
│
├── Suporte reativo (duvidas pontuais)
├── Email: resumo da semana + proximos passos
└── Check-in de 30 dias (reuniao de 30 min)

DIA 30+
│
├── NPS enviado
├── Check-in mensal (primeiros 3 meses)
├── Newsletter com novidades
└── Upsell quando apropiado
```

---

## FERRAMENTAS NECESSARIAS PARA O PROCESSO

| Ferramenta | Uso | Custo Estimado |
|------------|-----|---------------|
| **Stripe** | Pagamentos, subscriptions, faturas | 2.9% + R$ 0,60 por transacao |
| **Clicksign / DocuSign** | Assinatura digital de contratos | R$ 49-199/mes |
| **Calendly / Cal.com** | Agendamento de kickoff e treinamentos | Gratis - R$ 50/mes |
| **Resend** | Envio de emails transacionais e sequencias | Gratis ate 3.000 emails/mes |
| **Supabase** | Backend, auth, database (ja em uso) | Conforme plano atual |
| **CRM (Pipedrive/HubSpot)** | Tracking do pipeline e onboarding | Gratis - R$ 200/mes |
| **WhatsApp Business** | Comunicacao direta com cliente | Gratis |

---

## INTEGRACAO COM A PLATAFORMA

### Automacoes a Implementar no Codigo

| Automacao | Onde implementar | Prioridade |
|-----------|-----------------|-----------|
| Stripe webhook → criar usuario + ativar plano | Edge Function: `stripe-webhook` | ALTA |
| Email de boas-vindas automatico | Edge Function: `send-welcome-email` | ALTA |
| Projeto demo pre-carregado para novos usuarios | Seed no `admin-create-user` | ALTA |
| Onboarding tour no primeiro login | Componente: `Onboarding.tsx` (ja existe) | MEDIA |
| Drip email sequence (7 dias) | Edge Function: `onboarding-drip` | MEDIA |
| NPS automatico no dia 30 | Edge Function: `send-nps-survey` | MEDIA |
| Dashboard de onboarding (interno) | Pagina admin | BAIXA |

### Paginas da Plataforma Envolvidas

| Pagina | Papel no onboarding |
|--------|---------------------|
| `Auth.tsx` | Primeiro login com credenciais |
| `Onboarding.tsx` | Tour guiado da plataforma |
| `Dashboard.tsx` | Primeira visao pos-login |
| `HydroNetwork.tsx` | Modulo principal de engenharia |
| `Tutorials.tsx` | Materiais de apoio |
| `HelpCenter.tsx` | FAQ e suporte |
| `SatisfactionSurvey.tsx` | NPS no dia 30 |

---

*Documento preparado em Marco/2026 — ConstruData HydroNetwork*
*Processo de onboarding deve ser revisado a cada 10 clientes onboardados com base nos dados de ativacao e churn.*
