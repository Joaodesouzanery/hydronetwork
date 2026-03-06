# AUDITORIA DE PRODUCAO — ConstruData HydroNetwork

> Analise completa do que precisa ser feito para a plataforma funcionar perfeitamente em producao.

**Data:** Marco 2026 | **Dominio:** www.construdata.software | **Hospedagem:** Vercel + Supabase

---

## 1. INFRAESTRUTURA (Status: PARCIAL)

### 1.1 Deploy e Dominio
| Item | Status | Acao Necessaria |
|------|--------|-----------------|
| Dominio `construdata.software` | OK | Funcionando via Hostinger + Vercel |
| SSL/HTTPS | OK | Automatico pela Vercel |
| CDN | OK | Vercel CDN ativo |
| Redirect www <-> non-www | OK | `construdata.software` → `www.construdata.software` |
| vercel.json configurado | OK | Headers de seguranca, cache, rewrites |
| DNS propagado | OK | ALIAS records configurados |

### 1.2 Supabase (Backend)
| Item | Status | Acao Necessaria |
|------|--------|-----------------|
| Autenticacao (Auth) | OK | Email/senha funcionando |
| Row Level Security (RLS) | PARCIAL | Revisar todas as tabelas — algumas policies podem estar abertas demais |
| Edge Functions | OK | 14 funcoes deployadas |
| Realtime | OK | Alertas e notificacoes funcionando |
| Storage (buckets) | VERIFICAR | Fotos de RDO, uploads — confirmar se buckets estao criados |
| Backups automaticos | VERIFICAR | Supabase Pro tem backup automatico; verificar se esta ativo |
| Rate limiting | FALTA | Nenhum rate limiting nos endpoints publicos |

### 1.3 Migrations Pendentes
| Migration | Descricao | Status |
|-----------|-----------|--------|
| `hub_licitacoes` | Tabela de licitacoes PNCP | Deployar via Supabase Dashboard |
| `hub_coleta_meta` | Metadados de coleta | Deployar via Supabase Dashboard |
| `rdo_schedule_config` | Agenda de RDO | Deployar via Supabase Dashboard |
| `rdo_compliance_log` | Conformidade de RDO | Deployar via Supabase Dashboard |

**ACAO:** Executar todas as migrations em `supabase/migrations/` no SQL Editor do Supabase Dashboard, na ordem cronologica.

---

## 2. MODULOS — ESTADO POR MODULO

### 2.1 NUCLEO HYDRONETWORK (Motor de Calculo)

| Modulo | Arquivo Engine | Status | Pendencias |
|--------|---------------|--------|------------|
| Rede de Esgoto (NBR 9649) | `qesgEngine.ts` | FUNCIONAL | Validar resultados contra calculadora manual |
| Rede de Agua (NBR 12218) | `qwaterEngine.ts` | FUNCIONAL | Validar Hazen-Williams |
| Drenagem Pluvial | `hydraulics.ts` | PARCIAL | Calculo basico implementado, falta NBR 10844 completa |
| Quantitativos/Orcamento | `budget.ts`, `sinapi.ts` | FUNCIONAL | Tabela SINAPI precisa atualizacao periodica |
| BDI (TCU) | `bdi.ts` | FUNCIONAL | Calculo conforme Acordao 2622/2013 |
| Planejamento Gantt | `planning.ts` | FUNCIONAL | Curva S, histograma, alocacao de equipes |
| EPANET | `epanetRunner.ts` | FUNCIONAL | Usa epanet-js (WASM) |
| Conformidade CAESB | `caesbEngine.ts` | PARCIAL | Regras especificas da CAESB |
| Estacao Elevatoria | `elevatorStationEngine.ts` | FUNCIONAL | Dimensionamento de bombas |
| Recalque | `recalqueEngine.ts` | FUNCIONAL | Calculo de sistema pressurizados |
| Transientes | `transientEngine.ts` | PARCIAL | Golpe de ariete basico |
| LPS (Lean) | `lps.ts`, `lean-constraints.ts` | FUNCIONAL | Last Planner System + restricoes |

### 2.2 PAGINAS E INTERFACES

| Pagina | Rota | Status | Observacao |
|--------|------|--------|------------|
| Landing Page | `/` e `/hydronetwork-landing` | FUNCIONAL | Completa com CTA |
| Auth (Login/Cadastro) | `/auth` | FUNCIONAL | Email + senha via Supabase Auth |
| Onboarding | `/onboarding` | FUNCIONAL | Tutorial pos-cadastro |
| Dashboard | `/dashboard` | FUNCIONAL | Cards de resumo + navegacao |
| HydroNetwork (Motor) | `/hydronetwork` | FUNCIONAL | 17+ modulos integrados |
| Planning | `/planning` | FUNCIONAL | Gantt + alocacao equipes |
| RDO | `/rdo` | FUNCIONAL | Formulario basico |
| RDO New | `/rdo/new` | FUNCIONAL | Formulario completo com frentes |
| RDO History | `/rdo/history` | FUNCIONAL | Historico e visualizacao |
| Hub Noticias | `/hub-noticias` | FUNCIONAL | 4 tabs, filtros, coleta PNCP |
| Licitacoes | `/licitacoes` | FUNCIONAL | Busca e monitoramento |
| Mapa Interativo | `/interactive-map` | FUNCIONAL | Leaflet com camadas |
| CRM | `/crm` | FUNCIONAL | Gestao de contatos/clientes |
| Lean Constraints | `/lean-constraints` | FUNCIONAL | Gestao de restricoes |
| Lean Dashboard | `/lean-dashboard` | FUNCIONAL | Metricas LPS |
| Alertas | `/alerts` | FUNCIONAL | Configuracao de alertas |
| Materiais | `/materials`, `/material-control` | FUNCIONAL | Catalogo e controle |
| Pedidos Material | `/material-requests` | FUNCIONAL | Fluxo de aprovacao |
| RH | `/rh` | FUNCIONAL | Gestao de equipes |
| Orcamentos | `/budgets` | FUNCIONAL | Orcamento e precos |
| Producao | `/production`, `/production-control` | FUNCIONAL | Controle de producao |
| Ocorrencias | `/occurrences` | FUNCIONAL | Registro de ocorrencias |
| Checklists | `/checklists` | FUNCIONAL | Checklists personalizaveis |
| Inventario | `/inventory` | FUNCIONAL | Controle de estoque |
| Funcionarios | `/employees` | FUNCIONAL | Cadastro de funcionarios |
| Manutencao | `/maintenance-*` | FUNCIONAL | Solicitacoes + tarefas |
| QR Codes | `/maintenance-qrcodes` | FUNCIONAL | QR para ativos |
| Admin | `/admin` | FUNCIONAL | Painel administrativo |
| Settings | `/settings` | FUNCIONAL | Configuracoes do usuario |
| Suporte | `/support` | FUNCIONAL | Central de ajuda |
| Tutorials | `/tutorials` | FUNCIONAL | Tutoriais da plataforma |
| Modulos | `/modules` | FUNCIONAL | Catalogo de modulos |
| Custom Dashboard | `/custom-dashboard` | FUNCIONAL | Dashboard configuravel |
| Dashboard 360 | `/dashboard-360` | FUNCIONAL | Visao geral |
| Controle Aprovacao | `/approval-control` | FUNCIONAL | Fluxo de aprovacoes |
| Metricas Usuario | `/user-metrics` | FUNCIONAL | Analytics de uso |
| Pesquisa Satisfacao | `/satisfaction-survey` | FUNCIONAL | NPS/CSAT |
| Sentimento Dashboard | `/sentiment-dashboard` | FUNCIONAL | Analise de sentimento |
| QA Diagnosticos | `/qa-diagnostics` | FUNCIONAL | Diagnostico de qualidade |

---

## 3. ITENS CRITICOS PARA PRODUCAO

### 3.1 SEGURANCA (Prioridade ALTA)

| Item | Risco | Acao |
|------|-------|------|
| RLS em todas tabelas | ALTO | Verificar TODAS as tabelas no Supabase — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` |
| Service Role Key exposta | ALTO | Verificar se `SUPABASE_SERVICE_ROLE_KEY` NAO esta no frontend |
| Variáveis de ambiente | MEDIO | Confirmar que `.env` nao esta no repo (ja esta no .gitignore) |
| CORS nas Edge Functions | BAIXO | Ja configurado com `*`, considerar restringir para `construdata.software` |
| Input sanitization | MEDIO | Verificar injection em campos de texto livre |
| Rate limiting | MEDIO | Implementar rate limiting no Supabase ou Vercel |

### 3.2 PERFORMANCE (Prioridade MEDIA)

| Item | Acao |
|------|------|
| Code splitting | Chunks grandes (>600KB) — implementar lazy loading nas rotas |
| Image optimization | Landing page tem imagens externas — usar next/image ou otimizar |
| Bundle size | `vendor-pdf` (621KB), `epanet-js` (547KB) — manter lazy loaded |
| Supabase queries | Verificar indices nas tabelas mais consultadas |
| Cache de SINAPI | Dados SINAPI sao estaticos — cachear agressivamente |

### 3.3 DADOS E CONTEUDO (Prioridade MEDIA)

| Item | Status | Acao |
|------|--------|------|
| Noticias do Hub | PLACEHOLDER | Dados ilustrativos — implementar coleta real via RSS |
| Licitacoes | FUNCIONAL | Edge Function coleta do PNCP — funciona com autenticacao |
| Vinculos/Empresas | PLACEHOLDER | Dados estaticos — validar CNPJs contra Receita Federal |
| Tabela SINAPI | VERIFICAR | Confirmar se dados estao atualizados (ultima versao) |
| Artigos tecnicos | VAZIO | Tab removida — considerar implementar futuramente |

### 3.4 INTEGRACAO EXTERNA (Prioridade BAIXA)

| Integracao | Status | Dependencia |
|------------|--------|-------------|
| PNCP (Portal Licitacoes) | FUNCIONAL | API publica |
| Weather API | FUNCIONAL | OpenWeatherMap |
| UTMify (tracking) | FUNCIONAL | Script carregado no index.html |
| EPANET (WASM) | FUNCIONAL | Biblioteca epanet-js embedada |
| Leaflet (Mapas) | FUNCIONAL | Tiles OpenStreetMap |
| Google Auth | VERIFICAR | Confirmar se habilitado no Supabase |

---

## 4. CHECKLIST PRE-LANCAMENTO

### Imediato (Antes de divulgar)
- [ ] Executar TODAS as migrations SQL no Supabase Dashboard
- [ ] Verificar RLS em todas tabelas
- [ ] Testar fluxo completo: cadastro → login → dashboard → criar projeto → dimensionar → RDO
- [ ] Testar em mobile (Chrome, Safari)
- [ ] Confirmar que `construdata.software` carrega corretamente
- [ ] Verificar favicon e meta tags (OG image, titulo, descricao)
- [ ] Testar exportacao PDF/Excel
- [ ] Configurar cron job para `check-rdo-compliance` (Supabase pg_cron)
- [ ] Configurar cron job para coleta automatica de licitacoes (opcional)

### Primeira Semana
- [ ] Monitorar erros no Vercel (Functions logs)
- [ ] Monitorar uso no Supabase (API requests, storage)
- [ ] Coletar feedback dos primeiros usuarios
- [ ] Corrigir bugs reportados
- [ ] Verificar emails transacionais (Supabase Auth emails)

### Primeiro Mes
- [ ] Implementar analytics (quais modulos sao mais usados)
- [ ] Atualizar tabela SINAPI se necessario
- [ ] Implementar coleta automatica de noticias RSS
- [ ] Considerar implementar Stripe/pagamento
- [ ] Criar conteudo de onboarding (videos tutoriais)

---

## 5. CUSTOS ESTIMADOS DE INFRAESTRUTURA

| Servico | Plano | Custo Mensal | Observacao |
|---------|-------|-------------|------------|
| Vercel | Hobby (gratis) ou Pro | $0 — $20/mes | Hobby suporta ate 100GB banda |
| Supabase | Free ou Pro | $0 — $25/mes | Free: 500MB DB, 1GB storage |
| Hostinger (dominio) | - | ~R$ 40/ano | Renovacao anual |
| **Total minimo** | | **$0/mes** | Usando planos gratuitos |
| **Total recomendado** | | **~$45/mes** | Vercel Pro + Supabase Pro |

### Limites do Plano Gratuito
- Supabase Free: 500MB database, 1GB file storage, 2GB bandwidth, 50k Edge Function invocations
- Vercel Hobby: 100GB bandwidth, 6000 build minutes

### Quando fazer upgrade
- Mais de 50 usuarios ativos: migrar Supabase para Pro ($25/mes)
- Mais de 100GB de trafego: migrar Vercel para Pro ($20/mes)

---

## 6. MONITORAMENTO RECOMENDADO

### Metricas para acompanhar
1. **Usuarios ativos diarios** — Supabase Auth logs
2. **Erros de API** — Vercel Function logs
3. **Uso de storage** — Supabase Dashboard
4. **Tempo de build** — Vercel Dashboard
5. **Feedback dos usuarios** — Pesquisa de satisfacao integrada

### Alertas para configurar
1. Supabase approaching storage limit
2. Vercel build failures
3. Edge Function errors > 5%
4. RDO compliance (via sistema implementado)

---

## 7. RESUMO EXECUTIVO

**A plataforma esta 90% pronta para producao.** Os 10% restantes sao:

1. **Executar migrations no Supabase** (30 min de trabalho)
2. **Verificar RLS em todas tabelas** (1-2 horas)
3. **Testar fluxo completo end-to-end** (2-3 horas)
4. **Substituir dados placeholder do Hub** (futuro — nao impede lancamento)

**Recomendacao:** Lancar agora com os modulos que ja funcionam. Iterar com feedback real dos usuarios.
