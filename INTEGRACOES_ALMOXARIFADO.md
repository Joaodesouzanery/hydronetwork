# Integrações do Almoxarifado

## 🔗 Funcionalidades Integradas

### 1. **Pedidos de Material → Almoxarifado**

#### Como funciona:
- Ao criar um pedido de material, o sistema sugere materiais disponíveis no almoxarifado do projeto selecionado
- Você pode selecionar um material do almoxarifado para preencher automaticamente nome e unidade
- Quando um pedido é **aprovado**, o sistema automaticamente:
  - Busca se existe um material correspondente no almoxarifado (por nome e projeto)
  - Cria uma movimentação de entrada no estoque
  - Atualiza a quantidade disponível no almoxarifado

#### Benefícios:
- ✅ Preenchimento automático de dados
- ✅ Entrada automática no estoque quando pedidos são aprovados
- ✅ Histórico completo de movimentações
- ✅ Rastreabilidade de pedidos → estoque

---

### 2. **Controle de Material → Almoxarifado**

#### Como funciona:
- Ao registrar consumo de material, o sistema mostra materiais disponíveis no almoxarifado
- Você pode selecionar um material do estoque para dar baixa automática
- Quando seleciona do almoxarifado e registra o consumo:
  - Sistema valida se há quantidade suficiente
  - Atualiza automaticamente o estoque (subtrai a quantidade consumida)
  - Cria movimentação de saída no histórico
  - Registra o consumo no controle de material

#### Benefícios:
- ✅ Baixa automática no estoque
- ✅ Validação de quantidade disponível
- ✅ Histórico de consumo rastreável
- ✅ Evita digitação manual e erros

---

### 3. **Alertas Automáticos de Estoque Baixo**

#### Como funciona:
- Quando a quantidade disponível atinge ou fica abaixo do estoque mínimo
- Sistema cria automaticamente um alerta no histórico
- Alerta inclui: nome do material, quantidade atual, quantidade mínima
- Funciona em tempo real sempre que o estoque é atualizado

#### Benefícios:
- ✅ Notificação automática de estoque baixo
- ✅ Prevenção de falta de materiais
- ✅ Gestão proativa do almoxarifado

---

## 📊 Fluxo de Trabalho Integrado

### Cenário 1: Compra de Material
```
1. Criar Pedido de Material (status: pendente)
2. Aprovar Pedido → Status muda para "aprovado"
3. ✨ Sistema automaticamente adiciona ao Almoxarifado
4. Material fica disponível para uso
```

### Cenário 2: Consumo de Material
```
1. Abrir Controle de Material
2. Selecionar material do Almoxarifado
3. Informar quantidade consumida
4. ✨ Sistema dá baixa automática no estoque
5. Se atingir estoque mínimo → Alerta criado
```

### Cenário 3: Gestão de Estoque
```
1. Entrar no Almoxarifado
2. Visualizar materiais com estoque baixo (badge vermelho)
3. Ver estatísticas de valor total e itens
4. Fazer movimentações manuais se necessário
```

---

## 🎯 Vantagens da Integração

1. **Automação**: Menos trabalho manual, menos erros
2. **Rastreabilidade**: Histórico completo de todas as movimentações
3. **Controle**: Validações automáticas de quantidade
4. **Alertas**: Notificações proativas de problemas
5. **Conectividade**: Dados fluem automaticamente entre módulos
6. **Eficiência**: Processo mais rápido e organizado

---

## ⚙️ Configurações Recomendadas

### Para Alertas de Estoque Baixo:
1. Ir em **Alertas**
2. Criar nova configuração
3. Tipo: `estoque_baixo`
4. Adicionar destinatários (emails)
5. Ativar a configuração

### Para Melhor Aproveitamento:
1. Cadastrar materiais no Almoxarifado com:
   - Estoque mínimo adequado
   - Código de identificação
   - Categoria bem definida
   - Localização física
2. Sempre usar a busca do almoxarifado ao criar pedidos ou registrar consumo
3. Manter pedidos atualizados (aprovar quando chegarem)

---

## 🔒 Segurança

Todas as integrações respeitam as políticas RLS (Row Level Security):
- ✅ Usuários só veem dados de seus projetos
- ✅ Movimentações rastreadas por usuário
- ✅ Validações de quantidade antes de operações
- ✅ Triggers executados com privilégios seguros (SECURITY DEFINER)

---

## 📝 Nota sobre Segurança Adicional

O sistema alertou sobre **"Leaked Password Protection"** estar desabilitada. Esta é uma funcionalidade do Supabase que verifica senhas contra bancos de dados de senhas vazadas.

**Para habilitar (opcional mas recomendado):**
1. Acesse as configurações de autenticação do projeto
2. Ative "Password Strength & Leaked Password Protection"
3. Isso adiciona uma camada extra de segurança nas senhas dos usuários

Esta configuração não afeta o funcionamento do sistema, apenas adiciona uma camada adicional de proteção.
