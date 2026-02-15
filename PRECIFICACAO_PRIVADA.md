# 📊 Precificação Privada - Documentação Completa

## 🎯 Visão Geral

O módulo de **Precificação Privada** do ConstruData é um sistema inteligente de gestão de preços de materiais e serviços para empresas de construção civil. Ele permite importar, gerenciar e manter um catálogo privado de preços que pode ser usado em orçamentos.

---

## ✨ Funcionalidades Principais

### 1. **Importação Inteligente de Materiais**
- Suporte a **PDF** e **Excel/CSV**
- Extração automática de dados usando IA (Gemini)
- Reconhecimento de padrões de preços brasileiros (R$ 1.234,56)
- Detecção automática de colunas da planilha

### 2. **Matching Inteligente de Materiais**
- Busca por **nome exato** (nome + unidade)
- Busca por **sinônimos customizados**
- Busca por **palavras-chave normalizadas** (tokens)
- Busca por **similaridade Levenshtein** (tolerância a erros de digitação)
- Score de confiança para cada match

### 3. **Gestão de Preços**
- Preço separado: **Material** + **Mão de Obra**
- Histórico de alterações de preço (auditoria)
- Edição inline de preços
- Ações em lote (alterar categoria, fornecedor, preço)

### 4. **Deduplicação Automática**
- Detecta materiais duplicados no arquivo importado
- Detecta materiais já existentes no catálogo
- Oferece opções: usar existente, criar novo, atualizar preço

### 5. **Palavras-Chave Customizadas**
- Adicione sinônimos para facilitar buscas
- Ex: "Cabo PP" = "Cabo de força", "Fio PP"
- Melhora o matching automático

---

## 📋 Formato de Importação Padronizado

### Colunas Suportadas

| Coluna | Obrigatória | Descrição | Exemplos |
|--------|-------------|-----------|----------|
| **Descrição** | ✅ Sim | Nome do material | "Cabo PP 2x2,5mm", "Tubo PVC 100mm" |
| **Unidade** | Não | Unidade de medida | UN, M, KG, M2, CX |
| **Fornecedor** | Não | Nome do fornecedor | "Leroy Merlin", "Tigre" |
| **Preço Material** | Não | Custo do material | R$ 12,50 |
| **Preço M.O.** | Não | Custo da mão de obra | R$ 8,00 |
| **Preço Total** | Não | Soma material + M.O. | R$ 20,50 |
| **Palavras-Chave** | Não | Tags separadas por vírgula | elétrica, cabo, condutor |

### Variações Aceitas nos Nomes das Colunas

- **Descrição**: `descricao`, `description`, `nome`, `name`, `item`, `material`
- **Unidade**: `unidade`, `unit`, `un`, `und`
- **Fornecedor**: `fornecedor`, `supplier`
- **Preço Material**: `preco material`, `preço material`, `material_price`
- **Preço M.O.**: `preco m.o.`, `preço m.o.`, `preco mo`, `labor_price`, `mao de obra`
- **Preço Total**: `preco total`, `preço total`, `total`, `price`
- **Palavras-Chave**: `palavras-chave`, `palavras chave`, `keywords`, `tags`

---

## 🔧 Como Funciona o Matching

### Níveis de Correspondência

1. **Exato (100%)** - Nome + Unidade idênticos
2. **Sinônimo Customizado (92%)** - Match via palavras-chave configuradas
3. **Palavras-Chave (70-95%)** - 2+ tokens em comum
4. **Similaridade (60-85%)** - Algoritmo Levenshtein

### Score de Matching

```
Score Total = Token Match (até 70) + Medida (20) + Unidade (10) + Categoria (10)
```

- **≥80**: "Mesmo material" - alta confiança
- **60-79**: "Possivelmente igual" - requer confirmação
- **30-59**: "Palavra-chave similar" - baixa confiança

---

## 💡 Fluxo de Importação

```
┌─────────────────┐
│ Upload Arquivo  │
│ (PDF ou Excel)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Extração de     │
│ Dados (Parser)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Normalização    │
│ e Deduplicação  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Matching com    │
│ Catálogo        │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌────────┐
│ Novo  │ │Similar │
│ Item  │ │Encontr.│
└───┬───┘ └────┬───┘
    │          │
    ▼          ▼
┌───────────────────┐
│ Revisão do Usuário│
│ • Confirmar novos │
│ • Resolver simil. │
│ • Atualizar preços│
└─────────┬─────────┘
          │
          ▼
┌─────────────────┐
│ Salvar no       │
│ Catálogo        │
└─────────────────┘
```

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `materials`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador único |
| name | TEXT | Nome do material |
| description | TEXT | Descrição detalhada |
| unit | TEXT | Unidade (UN, M, KG, etc.) |
| current_price | NUMERIC | Preço total atual |
| material_price | NUMERIC | Preço do material |
| labor_price | NUMERIC | Preço da mão de obra |
| category | TEXT | Categoria |
| supplier | TEXT | Fornecedor |
| brand | TEXT | Marca |
| measurement | TEXT | Medida específica |
| keywords | TEXT[] | Palavras-chave |
| keywords_norm | TEXT[] | Keywords normalizadas (auto) |
| description_norm | TEXT | Descrição normalizada (auto) |
| created_by_user_id | UUID | Usuário criador |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Última atualização |

### Tabela: `price_history`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador |
| material_id | UUID | FK para materials |
| old_price | NUMERIC | Preço anterior |
| new_price | NUMERIC | Novo preço |
| changed_by_user_id | UUID | Quem alterou |
| created_at | TIMESTAMP | Data da alteração |

### Tabela: `custom_keywords`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador |
| keyword_type | TEXT | Tipo ("material", etc.) |
| keyword_value | TEXT | Palavra-chave principal |
| synonyms | TEXT[] | Sinônimos relacionados |
| created_by_user_id | UUID | Usuário criador |

---

## 🚀 API / Edge Functions

### `extract-pdf-data`

Extrai dados de PDFs com tabelas de materiais.

**Input:**
- `pdfText`: Texto extraído do PDF (preferido)
- `pdfBase64`: PDF em base64 (fallback para PDFs escaneados)

**Output:**
```json
{
  "items": [
    {
      "description": "Cabo PP 2x2,5mm",
      "unit": "M",
      "supplier": "Fornecedor X",
      "material_price": 5.50,
      "labor_price": 2.00,
      "price": 7.50,
      "keywords": ["cabo", "eletrica"]
    }
  ]
}
```

### `process-spreadsheet`

Processa planilhas Excel e busca preços no catálogo.

**Input:**
```json
{
  "spreadsheetData": [...],
  "customKeywords": [...],
  "catalogedMaterials": [...]
}
```

---

## ⚡ Triggers Automáticos

### `track_material_price_change`
Registra automaticamente alterações de preço no histórico.

### `update_materials_normalized_fields`
Atualiza campos normalizados (keywords_norm, description_norm) ao inserir/atualizar materiais.

---

## 📊 Gráficos e Relatórios

### Histórico de Preços
- Gráfico de linha mostrando evolução de preços
- Filtro por material e período
- Comparação entre materiais

### Dashboard de Materiais
- Total de materiais cadastrados
- Distribuição por categoria
- Materiais sem preço
- Duplicados potenciais

---

## 🔒 Segurança (RLS)

Todas as tabelas possuem Row Level Security:
- Usuários só veem/editam seus próprios materiais
- Histórico de preços vinculado ao material
- Keywords customizadas por usuário

---

## 📝 Boas Práticas

1. **Mantenha descrições consistentes** - Use o mesmo padrão de nomenclatura
2. **Configure sinônimos** - Adicione variações comuns dos nomes
3. **Revise duplicados** - Periodicamente verifique materiais similares
4. **Atualize preços** - Importe novas tabelas regularmente
5. **Use categorias** - Facilita a busca e organização

---

## 🐛 Troubleshooting

### Preços não são importados
- Verifique se os valores estão no formato brasileiro (R$ 1.234,56)
- Certifique-se de que a coluna de preço está nomeada corretamente

### Materiais não são reconhecidos como similares
- Adicione palavras-chave nos materiais existentes
- Configure sinônimos customizados
- Verifique se a unidade está consistente

### PDF não é processado
- Limite de 5MB por arquivo
- PDFs escaneados podem ter menor precisão
- Prefira PDFs com texto selecionável

---

## 🔄 Integrações

### Com Orçamentos
- Ao criar item de orçamento, busca preço do catálogo
- Histórico de preço na época do orçamento é preservado

### Com Pedidos de Material
- Sugere materiais do catálogo ao criar pedido
- Preenche unidade e preço automaticamente

---

**Versão:** 1.0  
**Última atualização:** Janeiro 2026  
**Desenvolvido por:** ConstruData
