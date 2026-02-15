# 🔐 Segurança do ConstruData

## Visão Geral

O ConstruData implementa segurança de nível empresarial para proteger dados confidenciais da sua empresa, incluindo informações de funcionários, localização de obras, métricas de produção e custos de materiais.

## 🛡️ Medidas de Segurança Implementadas

### 1. **Autenticação Robusta**
- ✅ Sistema de login/cadastro com validação de senha
- ✅ Proteção contra senhas vazadas (Leaked Password Protection)
- ✅ Confirmação automática de email habilitada para desenvolvimento
- ✅ Tokens JWT para autenticação de API

### 2. **Isolamento de Dados por Projeto**
Todas as tabelas críticas implementam Row-Level Security (RLS) para garantir que:

#### Dados Protegidos por Propriedade de Projeto:
- **Projetos**: Apenas o criador pode visualizar
- **Funcionários**: Visíveis apenas para o proprietário do projeto associado
- **Locais de Obra**: Restritos ao proprietário do projeto
- **Relatórios Diários (RDO)**: Acessíveis apenas pelo dono do projeto
- **Serviços Executados**: Visíveis apenas para o proprietário do projeto
- **Metas de Produção**: Restritas ao proprietário do projeto
- **Frentes de Serviço**: Protegidas por projeto
- **Pedidos de Material**: Isolados por projeto
- **Controle de Material**: Segregados por projeto
- **Justificativas**: Acessíveis apenas ao dono do projeto

#### Dados Protegidos por Propriedade Direta:
- **Catálogo de Serviços**: Cada usuário vê apenas seus próprios serviços
- **Configurações de Alerta**: Isoladas por usuário
- **Histórico de Alertas**: Acessível apenas pelo dono da obra
- **Modelos de Formulário**: Privados por usuário

### 3. **APIs Protegidas**
Todas as Edge Functions requerem autenticação JWT:

#### `weather-data`
- ✅ JWT obrigatório
- ✅ Validação de coordenadas (latitude/longitude)
- ✅ Proteção contra consumo indevido de API

#### `send-production-report`
- ✅ JWT obrigatório
- ✅ Verificação de propriedade do projeto antes de gerar relatório
- ✅ Logs de tentativas de acesso não autorizado
- ✅ Impede que usuários gerem relatórios de projetos de terceiros

#### `configure-reports`
- ✅ JWT obrigatório
- ✅ Verificação de propriedade do projeto
- ✅ Previne configuração de relatórios para projetos não autorizados

#### `process-alerts`
- ✅ JWT obrigatório
- ✅ Processa apenas alertas do usuário autenticado
- ✅ Impede acesso a alertas de outros usuários

### 4. **Validação de Entrada**
- ✅ Validação de coordenadas GPS com limites geográficos
- ✅ Schemas Zod para validação de autenticação
- ✅ Validação de tipos e limites em todas as APIs

## 🎯 Proteção Contra Ameaças

### ✅ Vazamento de Dados
**Antes**: Qualquer usuário autenticado podia ver TODOS os dados de TODAS as empresas  
**Depois**: Cada empresa só acessa seus próprios projetos e dados relacionados

### ✅ Acesso Não Autorizado
**Antes**: Edge functions públicas permitiam extração de dados sem autenticação  
**Depois**: Todas as APIs requerem JWT válido e verificam propriedade do projeto

### ✅ Inteligência Competitiva
**Antes**: Concorrentes podiam criar conta gratuita e acessar:
- Dados de funcionários (nomes, emails, telefones)
- Localização de obras
- Métricas de produção
- Custos de materiais
- Estrutura de serviços

**Depois**: Isolamento completo de dados entre empresas

### ✅ Ataques de Injeção
- Proteção contra SQL injection via cliente Supabase
- Validação de entrada em todas as Edge Functions
- Sanitização de coordenadas GPS

## 📊 Índices de Performance

Para garantir que as verificações de segurança não impactem a performance, foram adicionados índices nas colunas mais consultadas:

```sql
idx_projects_created_by
idx_employees_project_id
idx_construction_sites_project_id
idx_daily_reports_project_id
idx_service_fronts_project_id
idx_material_requests_project_id
idx_material_control_project_id
```

## 🔍 Auditoria de Segurança

### Status Atual
- ✅ RLS habilitado em todas as tabelas
- ✅ Políticas restritivas implementadas em 11+ tabelas críticas
- ✅ Autenticação JWT em todas as Edge Functions
- ✅ Validação de propriedade de projeto implementada
- ✅ Validação de entrada em APIs críticas
- ✅ Proteção contra senhas vazadas habilitada

### Recomendações para Produção

1. **Testes de Penetração**: Considere contratar auditoria de segurança profissional antes do lançamento em produção
2. **Monitoramento**: Configure alertas para tentativas de acesso não autorizado (já logadas no código)
3. **Rate Limiting**: Considere implementar rate limiting nas Edge Functions para prevenir abuso
4. **Backup**: Configure backups automáticos regulares do banco de dados
5. **2FA**: Considere adicionar autenticação de dois fatores para contas administrativas

## 🚨 Reportar Vulnerabilidades

Se você descobrir uma vulnerabilidade de segurança, por favor:
1. **NÃO** crie uma issue pública
2. Entre em contato diretamente com a equipe de desenvolvimento
3. Forneça detalhes sobre a vulnerabilidade e como reproduzi-la
4. Aguarde confirmação antes de divulgar publicamente

## 📝 Histórico de Atualizações

### 2026-01-29 - Hardening de Segurança v5
- ✅ **weather-data JWT Enforcement**: Implementada verificação JWT completa na edge function usando `getClaims()`, alinhando implementação com config.toml
- ✅ **Rate Limits RLS Hardening**: Removidas políticas permissivas de service_role. Mantida apenas INSERT para edge function e DELETE para limpeza automática
- ✅ **Supply Chain Mitigations Documented**: Vulnerabilidades em html2pdf.js, jspdf e xlsx documentadas com justificativas de mitigação
- ✅ **Data Access Findings Reviewed**: Todas as tabelas com dados sensíveis verificadas - RLS já implementado conforme v4

### 2026-01-27 - Hardening de Segurança v4
- ✅ **Políticas RLS Verificadas e Endurecidas**:
  - `employees`: Acesso restrito via `created_by_user_id` ou `is_project_manager()` - protege dados pessoais (email, telefone)
  - `labor_tracking`: Acesso restrito via `created_by_user_id` ou `is_project_manager()` - protege dados financeiros (salários)
  - `budgets` e `budget_items`: Acesso exclusivo via `created_by_user_id` - protege informações de precificação
  - `materials` e `price_history`: Acesso exclusivo via `created_by_user_id` - protege dados de preços
  - `maintenance_requests`: Acesso restrito a gerentes de projeto via `is_project_manager()`
- ✅ **Funções Security Definer**: `has_project_access()`, `is_project_manager()`, `has_qrcode_access()`, `has_role()`, `is_admin()` previnem recursão infinita em RLS
- ✅ **Edge Functions com JWT**: Todas as funções sensíveis validam tokens JWT via `getClaims()`
- ✅ **Rate Limiting**: Implementado em `maintenance-request-upload` (5 req/IP/hora, 10 req/QR/hora)
- ✅ **Sanitização de Inputs**: Proteção contra XSS em formulários públicos
- ✅ **URLs Assinadas**: Uploads de fotos usam URLs temporárias (5 min expiry)

### 2026-01-20 - Hardening de Segurança v3
- ✅ **Rate Limiting**: Edge function `maintenance-request-upload` implementada com:
  - Limite de 5 requisições por IP por hora
  - Limite de 10 requisições por QR Code por hora
  - Sanitização de inputs contra XSS
  - URLs assinadas para uploads de fotos (expiram em 5 minutos)
- ✅ **Políticas RLS corrigidas**: Removidas políticas duplicadas/antigas da tabela `employees`
- ✅ **Proteção de IPs**: Tabela `maintenance_request_rate_limits` agora restringe acesso a IPs
- ✅ **Dados financeiros protegidos**: Tabela `purchase_orders` usa `is_project_manager()` para validação
- ⚠️ **Supply Chain**: Vulnerabilidades conhecidas em `html2pdf.js`, `jspdf`, `xlsx` - mitigadas por uso controlado

### 2025-10-20 - Correção Crítica de Segurança
- ✅ Implementadas políticas RLS restritivas em todas as tabelas
- ✅ Adicionada autenticação JWT em todas as Edge Functions
- ✅ Implementada validação de propriedade de projeto
- ✅ Adicionada validação de entrada em APIs
- ✅ Corrigida exposição de dados de funcionários
- ✅ Corrigida exposição de localização de obras
- ✅ Corrigida exposição de dados de produção e materiais
- ✅ Corrigido acesso não autorizado a Edge Functions

---

**Última atualização**: 29 de Janeiro de 2026  
**Versão de Segurança**: 5.0 - Enterprise Hardened

## 🔒 Resumo de Proteções por Tabela

| Tabela | Dados Sensíveis | Proteção RLS |
|--------|-----------------|--------------|
| `employees` | Email, Telefone | `created_by_user_id` OR `is_project_manager()` |
| `labor_tracking` | Salários, Custos | `created_by_user_id` OR `is_project_manager()` |
| `budgets` | Preços, Clientes | `created_by_user_id` apenas |
| `budget_items` | Valores unitários | Validação via JOIN com `budgets` |
| `materials` | Preços de materiais | `created_by_user_id` apenas |
| `price_history` | Histórico de preços | Validação via JOIN com `materials` |
| `maintenance_requests` | Contato solicitante | `is_project_manager()` apenas |
| `purchase_orders` | Valores de compra | `is_project_manager()` apenas |

Para mais informações sobre as funcionalidades do sistema, consulte [FUNCIONALIDADES.md](./FUNCIONALIDADES.md)
