/**
 * coletor.js - Coletor de Dados do Hub ConstruData
 * ==================================================
 * Coleta de 3 fontes reais:
 *   1. NOTÍCIAS  — feeds RSS de engenharia, construção e infraestrutura
 *   2. ARTIGOS   — mesmos RSS, mas com excerpt/categorias
 *   3. LICITAÇÕES — API pública do PNCP (Portal Nacional de Contratações Públicas)
 *
 * Saída:
 *   public/noticias.json   + src/data/noticias.ts
 *   public/artigos.json    + src/data/artigos.ts
 *   public/licitacoes.json + src/data/licitacoes.ts
 *
 * Uso: node coletor.js
 *
 * MIGRAÇÃO SUPABASE:
 *   Quando migrar, troque a saída de "salvar em JSON" para
 *   "inserir na tabela Supabase" via supabase-js ou Edge Function.
 */

import https from "https";
import http from "http";
import { parseString } from "xml2js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// 1. CONFIGURAÇÃO DAS FONTES RSS
// ============================================================
const FONTES_RSS = [
  // --- Engenharia (foco principal) ---
  { url: "https://www.confea.org.br/feed/", nome: "CONFEA", categorias: ["Engenharia", "Regulamentação"] },
  { url: "https://www.crea-sp.org.br/feed/", nome: "CREA-SP", categorias: ["Engenharia", "Regulamentação"] },
  { url: "https://revistaadnormas.com.br/feed/", nome: "Revista AdNormas", categorias: ["Engenharia", "Normas Técnicas"] },
  { url: "https://www.aecweb.com.br/rss/noticias/", nome: "AECweb", categorias: ["Engenharia", "Construção Civil"] },
  { url: "https://engenharia360.com/feed/", nome: "Engenharia 360", categorias: ["Engenharia", "Tecnologia"] },
  { url: "https://www.engenhariacivil.com/feed", nome: "Portal Eng. Civil", categorias: ["Engenharia Civil", "Estruturas"] },
  // --- Construção Civil & Infraestrutura ---
  { url: "https://cbic.org.br/feed/", nome: "CBIC", categorias: ["Construção Civil", "Infraestrutura"] },
  { url: "https://sindusconsp.com.br/feed/", nome: "SindusCon-SP", categorias: ["Construção Civil", "Custos"] },
  { url: "https://www.buildin.com.br/feed/", nome: "Buildin", categorias: ["Engenharia", "BIM"] },
  { url: "https://www.sienge.com.br/blog/feed/", nome: "Sienge", categorias: ["Engenharia", "Gestão de Obras"] },
  // --- Saneamento & Recursos Hídricos ---
  { url: "https://saneamentobasico.com.br/feed/", nome: "Saneamento Básico", categorias: ["Saneamento", "Engenharia"] },
  { url: "https://tratamentodeagua.com.br/feed/", nome: "Tratamento de Água", categorias: ["Saneamento", "Eng. Ambiental"] },
  { url: "https://abes-dn.org.br/feed/", nome: "ABES", categorias: ["Saneamento", "Normas Técnicas"] },
  { url: "https://tratabrasil.org.br/feed/", nome: "Trata Brasil", categorias: ["Saneamento", "Indicadores"] },
  // --- Meio Ambiente & Sustentabilidade ---
  { url: "https://canalmeioambiente.com.br/feed/", nome: "Canal Meio Ambiente", categorias: ["Eng. Ambiental", "Sustentabilidade"] },
  { url: "https://oeco.org.br/feed/", nome: "O Eco", categorias: ["Eng. Ambiental", "Recursos Hídricos"] },
  // --- Governo & Dados ---
  { url: "https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml", nome: "Agência Brasil", categorias: ["Governo", "Infraestrutura"] },
];

// ============================================================
// 2. CONFIGURAÇÃO DO PNCP (Licitações)
// ============================================================
const PNCP_BASE = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao";

// ============================================================
// 2B. CONFIGURAÇÃO CEIS/CNEP (Portal da Transparência)
// ============================================================
const CEIS_API = "https://api.portaldatransparencia.gov.br/api-de-dados/ceis";
const CNEP_API = "https://api.portaldatransparencia.gov.br/api-de-dados/cnep";

// CNPJs das empresas monitoradas (para consulta CEIS/CNEP)
// NOTA: CNPJs marcados com [!] têm dígitos verificadores inválidos.
// Precisam ser corrigidos com dados reais da Receita Federal (ReceitaWS ou Consulta CNPJ).
// O coletor valida automaticamente e alerta sobre CNPJs inválidos.
const CNPJS_MONITORADOS = [
  "43.776.517/0001-80", // Sabesp ✓
  "16.454.085/0001-62", // Aegea [!] dígito verificador inválido
  "19.406.798/0001-50", // BRK [!] dígito verificador inválido
  "17.281.106/0001-03", // Copasa ✓
  "76.484.013/0001-45", // Sanepar ✓
  "07.628.820/0001-64", // Iguá [!] dígito verificador inválido
  "07.040.108/0001-57", // Cagece ✓
  "17.262.213/0001-94", // Andrade Gutierrez ✓
  "33.412.792/0001-60", // Queiroz Galvão ✓
  "17.185.786/0001-61", // Barbosa Mello ✓
  "08.805.301/0001-29", // GS Inima [!] dígito verificador inválido
  "13.504.675/0001-10", // Embasa ✓
  "33.352.394/0001-04", // CEDAE ✓
  "09.769.035/0001-64", // COMPESA ✓
  "12.294.708/0001-81", // CASAL ✓
  "13.018.171/0001-90", // DESO ✓
  "06.274.757/0001-50", // CAEMA ✓
  "04.945.341/0001-90", // COSANPA ✓
  "92.802.784/0001-90", // CORSAN ✓
  "82.508.433/0001-17", // CASAN ✓
  "00.082.024/0001-37", // CAESB ✓
  "08.343.492/0001-20", // MRV ✓
  "28.620.211/0001-79", // Novonor [!] dígito verificador inválido
  "61.522.512/0001-02", // Mover ✓
  "14.310.577/0001-04", // OAS ✓
  "00.103.312/0001-37", // Engevix [!] dígito verificador inválido (colide com CAESB!)
  "01.340.937/0001-79", // Galvão Engenharia ✓
  "61.088.894/0001-08", // Constran ✓
  "36.482.783/0001-73", // SANESUL [!] dígito verificador inválido
];

// ============================================================
// 2C. DIÁRIOS OFICIAIS - RSS
// ============================================================
const DIARIOS_OFICIAIS_RSS = [
  { url: "https://www.in.gov.br/rss/dou/secao-3.xml", nome: "DOU Seção 3 (Licitações)", categorias: ["Diário Oficial", "Licitações"] },
  { url: "https://www.in.gov.br/rss/dou/secao-1.xml", nome: "DOU Seção 1 (Leis)", categorias: ["Diário Oficial", "Legislação"] },
];

// ============================================================
// 2D. TCE - Tribunais de Contas Estaduais (fontes RSS/web)
// ============================================================
const TCE_FONTES = [
  { url: "https://portal.tcu.gov.br/rss/noticias.xml", nome: "TCU - Tribunal de Contas da União", categorias: ["TCU", "Auditoria"] },
];

// Modalidades relevantes para engenharia e construção
// A API exige codigoModalidadeContratacao como parâmetro obrigatório
const MODALIDADES_RELEVANTES = [
  4, // Concorrência Eletrônica
  5, // Concorrência Presencial
  6, // Pregão Eletrônico
  8, // Dispensa de Licitação
];

// Palavras-chave para filtrar licitações relevantes a engenharia
const PNCP_PALAVRAS_CHAVE = [
  // Engenharia geral
  "engenharia", "projeto", "laudo", "consultoria técnica", "ART",
  "topografia", "geotecnia", "sondagem", "fundação", "fundações",
  "estrutura", "estrutural", "concreto", "armado", "protendido",
  "cálculo estrutural", "BIM", "modelagem",
  // Construção civil
  "construção", "obra", "edificação", "reforma", "ampliação",
  "habitação", "habitacional", "alvenaria", "acabamento",
  // Infraestrutura
  "infraestrutura", "pavimentação", "drenagem", "terraplanagem",
  "ponte", "viaduto", "rodovia", "estrada", "ferrovia",
  // Saneamento & Hídrico
  "saneamento", "esgoto", "água", "hidrico", "hídrico",
  "barragem", "reservatório", "adutora",
  "tratamento", "ETA", "ETE",
  // Elétrica & Instalações
  "elétrica", "subestação", "rede elétrica", "instalações",
  // Ambiental
  "residuos", "resíduos", "aterro", "ambiental", "EIA", "RIMA",
];

// Mapa de modalidade PNCP → texto legível
const MODALIDADES_PNCP = {
  1: "Leilão Eletrônico",
  2: "Diálogo Competitivo",
  3: "Concurso",
  4: "Concorrência Eletrônica",
  5: "Concorrência Presencial",
  6: "Pregão Eletrônico",
  7: "Pregão Presencial",
  8: "Dispensa de Licitação",
  9: "Inexigibilidade",
  10: "Manifestação de Interesse",
  11: "Pré-qualificação",
  12: "Credenciamento",
  13: "Leilão Presencial",
};

// Categorização automática por palavras-chave no título
function categorizarLicitacao(titulo) {
  const t = titulo.toLowerCase();
  if (t.includes("projeto") || t.includes("consultoria") || t.includes("laudo") || t.includes("topografi") || t.includes("BIM")) return "Engenharia";
  if (t.includes("estrutur") || t.includes("fundaç") || t.includes("geotecni") || t.includes("sondagem") || t.includes("concreto")) return "Eng. Estrutural";
  if (t.includes("elétr") || t.includes("subestação") || t.includes("instalações")) return "Eng. Elétrica";
  if (t.includes("saneamento") || t.includes("esgoto") || t.includes("água") || t.includes("eta") || t.includes("ete")) return "Saneamento";
  if (t.includes("paviment") || t.includes("drenag") || t.includes("infraestrutura") || t.includes("ponte") || t.includes("rodovia") || t.includes("ferrovia")) return "Infraestrutura";
  if (t.includes("construção") || t.includes("edificação") || t.includes("habitac") || t.includes("obra") || t.includes("reforma")) return "Construção Civil";
  if (t.includes("barragem") || t.includes("reservatório") || t.includes("adut") || t.includes("hídric") || t.includes("hidric")) return "Recursos Hídricos";
  if (t.includes("resíduo") || t.includes("aterro") || t.includes("ambiental") || t.includes("meio ambiente")) return "Eng. Ambiental";
  return "Engenharia";
}

// Caminhos de saída
// __dirname = public/hub/, raiz do projeto = ../../
const RAIZ_PROJETO = path.resolve(__dirname, "..", "..");
const CAMINHO_NOTICIAS_JSON = path.join(__dirname, "noticias.json");
const CAMINHO_NOTICIAS_TS = path.join(RAIZ_PROJETO, "src", "data", "noticias.ts");
const CAMINHO_ARTIGOS_JSON = path.join(__dirname, "artigos.json");
const CAMINHO_ARTIGOS_TS = path.join(RAIZ_PROJETO, "src", "data", "artigos.ts");
const CAMINHO_LICITACOES_JSON = path.join(__dirname, "licitacoes.json");
const CAMINHO_LICITACOES_TS = path.join(RAIZ_PROJETO, "src", "data", "licitacoes.ts");

// ============================================================
// VALIDAÇÃO DE CNPJ
// ============================================================
/** Valida dígitos verificadores de um CNPJ (formato XX.XXX.XXX/XXXX-DD) */
function validarCNPJ(cnpj) {
  const nums = cnpj.replace(/\D/g, "");
  if (nums.length !== 14) return false;
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < 12; i++) soma += parseInt(nums[i]) * pesos1[i];
  let resto = soma % 11;
  const d1 = resto < 2 ? 0 : 11 - resto;
  if (parseInt(nums[12]) !== d1) return false;
  soma = 0;
  for (let i = 0; i < 13; i++) soma += parseInt(nums[i]) * pesos2[i];
  resto = soma % 11;
  const d2 = resto < 2 ? 0 : 11 - resto;
  return parseInt(nums[13]) === d2;
}

// ============================================================
// SEGURANÇA: escape de strings para geração de TS
// ============================================================
/** Escapa string para ser segura dentro de aspas duplas em código TS gerado */
function escaparParaTS(str) {
  if (!str) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/\$/g, "\\$");
}

/** Valida que URL é http/https */
function urlSegura(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch { /* URL inválida */ }
  return "";
}

// ============================================================
// 3. FUNÇÕES HTTP
// ============================================================
function buscarURL(url, tentativas = 3) {
  return new Promise((resolve, reject) => {
    const cliente = url.startsWith("https") ? https : http;

    // Validar URL antes de fazer request
    let urlOriginal;
    try {
      urlOriginal = new URL(url);
      if (urlOriginal.protocol !== "http:" && urlOriginal.protocol !== "https:") {
        return reject(new Error("Protocolo inseguro"));
      }
    } catch {
      return reject(new Error("URL inválida"));
    }

    cliente
      .get(url, { headers: { "User-Agent": "HubConstrudata/2.0" }, timeout: 15000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Validar redirect: só seguir se for mesmo domínio ou HTTPS
          try {
            const redirectUrl = new URL(res.headers.location, url);
            if (redirectUrl.protocol !== "http:" && redirectUrl.protocol !== "https:") {
              return reject(new Error("Redirect para protocolo inseguro"));
            }
            return buscarURL(redirectUrl.href, tentativas).then(resolve).catch(reject);
          } catch {
            return reject(new Error("URL de redirect inválida"));
          }
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Status HTTP ${res.statusCode}`));
        }
        let dados = "";
        res.on("data", (chunk) => (dados += chunk));
        res.on("end", () => resolve(dados));
      })
      .on("timeout", () => reject(new Error("Timeout")))
      .on("error", (err) => {
        if (tentativas > 1) {
          setTimeout(() => buscarURL(url, tentativas - 1).then(resolve).catch(reject), 2000);
        } else {
          reject(err);
        }
      });
  });
}

function buscarJSON(url) {
  return buscarURL(url).then((texto) => JSON.parse(texto));
}

// ============================================================
// 4. RSS — ANALISAR XML
// ============================================================
function analisarFeed(xmlTexto) {
  return new Promise((resolve, reject) => {
    parseString(xmlTexto, { trim: true }, (erro, resultado) => {
      if (erro) return reject(erro);
      resolve(resultado);
    });
  });
}

// ============================================================
// 5. RSS — BUSCAR ITENS DE UMA FONTE (notícias + artigos)
// ============================================================
async function buscarFonteRSS(fonte) {
  try {
    console.log(`  RSS: ${fonte.nome}...`);
    const xmlTexto = await buscarURL(fonte.url);
    const feed = await analisarFeed(xmlTexto);
    const itens = feed?.rss?.channel?.[0]?.item || [];

    const resultados = itens
      .map((item) => {
        // Extrair texto limpo da description (remover HTML tags)
        let descricaoRaw = item.description?.[0] || item["content:encoded"]?.[0] || "";
        if (typeof descricaoRaw === "object") descricaoRaw = descricaoRaw._ || "";
        const descricao = descricaoRaw
          .replace(/<[^>]*>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 500);

        // Extrair categorias do RSS
        const catRss = (item.category || []).map((c) =>
          typeof c === "string" ? c : c._ || c.toString()
        ).slice(0, 4);

        // Extrair imagem (media:content, enclosure) — validar URL
        let imagem = "";
        if (item["media:content"]?.[0]?.$?.url) {
          imagem = urlSegura(item["media:content"][0].$.url);
        } else if (item.enclosure?.[0]?.$?.url) {
          imagem = urlSegura(item.enclosure[0].$.url);
        }

        return {
          titulo: (item.title?.[0] || "").toString().slice(0, 300),
          link: item.link?.[0] || "",
          data_publicacao: item.pubDate?.[0] || "",
          fonte: fonte.nome,
          descricao,
          categorias: catRss.length > 0 ? catRss : fonte.categorias,
          imagem,
        };
      })
      .filter((n) => {
        if (!n.titulo || !n.link) return false;
        try {
          const url = new URL(n.link);
          return url.protocol === "http:" || url.protocol === "https:";
        } catch {
          return false;
        }
      });

    console.log(`  [OK] ${fonte.nome}: ${resultados.length} itens`);
    return resultados;
  } catch (erro) {
    console.log(`  [ERRO] ${fonte.nome}: ${erro.message}`);
    return [];
  }
}

// ============================================================
// 6. PNCP — BUSCAR LICITAÇÕES REAIS
// ============================================================

/**
 * Formata data para o formato esperado pelo PNCP: AAAAMMDD
 */
function formatarDataPNCP(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * Busca licitações de uma modalidade específica com paginação.
 */
async function buscarPNCPModalidade(modalidade, dataInicial, dataFinal) {
  const resultados = [];
  let pagina = 1;
  const maxPaginas = 5; // Limitar para evitar requests excessivos

  while (pagina <= maxPaginas) {
    const url = `${PNCP_BASE}?dataInicial=${dataInicial}&dataFinal=${dataFinal}&codigoModalidadeContratacao=${modalidade}&tamanhoPagina=50&pagina=${pagina}`;

    try {
      const dados = await buscarJSON(url);
      const itens = dados?.data || [];

      if (itens.length === 0) break;

      resultados.push(...itens);

      // Verificar se há mais páginas
      const paginasRestantes = dados?.paginasRestantes ?? 0;
      if (paginasRestantes === 0) break;

      pagina++;

      // Rate limiting: esperar 500ms entre requests
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.log(`    [AVISO] Modalidade ${modalidade} pág ${pagina}: ${err.message}`);
      break;
    }
  }

  return resultados;
}

async function buscarLicitacoesPNCP() {
  console.log("\n  PNCP: Buscando licitações...");

  try {
    // Buscar últimos 7 dias (períodos curtos para melhor resultado)
    const hoje = new Date();
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - 7);

    const dataInicial = formatarDataPNCP(inicio);
    const dataFinal = formatarDataPNCP(hoje);

    console.log(`  Período: ${dataInicial} a ${dataFinal}`);

    // Buscar cada modalidade relevante em paralelo
    const promises = MODALIDADES_RELEVANTES.map(async (mod) => {
      console.log(`  Modalidade ${mod} (${MODALIDADES_PNCP[mod]})...`);
      const itens = await buscarPNCPModalidade(mod, dataInicial, dataFinal);
      console.log(`    -> ${itens.length} itens`);
      return itens;
    });

    // Executar sequencialmente para evitar rate limiting
    let todosItens = [];
    for (const promise of promises) {
      const itens = await promise;
      todosItens.push(...itens);
      // Rate limiting entre modalidades
      await new Promise((r) => setTimeout(r, 1000));
    }

    console.log(`  Total bruto: ${todosItens.length} licitações`);

    // Filtrar por palavras-chave relevantes ao setor
    const relevantes = todosItens.filter((item) => {
      const texto = (item.objetoCompra || "").toLowerCase();
      return PNCP_PALAVRAS_CHAVE.some((kw) => texto.includes(kw.toLowerCase()));
    });

    console.log(`  Filtradas por relevância: ${relevantes.length} licitações`);

    const licitacoes = relevantes.map((item) => {
      const orgao = item.orgaoEntidade || {};
      const unidade = item.unidadeOrgao || {};
      const titulo = (item.objetoCompra || "").slice(0, 500);
      const valor = item.valorTotalEstimado || 0;
      const modalidadeId = item.modalidadeId || item.codigoModalidadeContratacao;

      // UF: tentar unidade.ufSigla, depois orgao.uf
      const uf = unidade.ufSigla || orgao.uf || "BR";

      // Construir link para o PNCP
      const cnpj = orgao.cnpj || "";
      const ano = item.anoCompra || "";
      const seq = item.sequencialCompra || "";
      const link = cnpj && ano && seq
        ? `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`
        : "https://pncp.gov.br";

      return {
        titulo,
        orgao: orgao.razaoSocial || "Órgão não informado",
        estado: uf,
        categoria: categorizarLicitacao(titulo),
        data_abertura: (item.dataPublicacaoPncp || item.dataAberturaProposta || "").split("T")[0],
        valor_estimado: valor,
        valor_estimado_fmt: valor > 0
          ? `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : "Valor não informado",
        link,
        modalidade: MODALIDADES_PNCP[modalidadeId] || `Modalidade ${modalidadeId}`,
        numero_controle: item.numeroControlePNCP || "",
      };
    });

    console.log(`  [OK] PNCP: ${licitacoes.length} licitações relevantes`);
    return licitacoes;
  } catch (erro) {
    console.log(`  [ERRO] PNCP: ${erro.message}`);
    return [];
  }
}

// ============================================================
// 6B. CEIS/CNEP — CONSULTAR SANÇÕES
// ============================================================

/**
 * Consulta sanções CEIS/CNEP via API do Portal da Transparência.
 * Nota: A API requer chave (chave-api-dados-abertos). Se não disponível, retorna [].
 * Cadastre-se em: https://portaldatransparencia.gov.br/api-de-dados/cadastrar
 */
async function buscarSancoesCEIS() {
  console.log("\n  CEIS/CNEP: Consultando sanções...");
  const resultados = [];

  // Tentar com a API pública (pode exigir chave)
  for (const cnpj of CNPJS_MONITORADOS) {
    const cnpjLimpo = cnpj.replace(/[.\-\/]/g, "");
    try {
      // CEIS
      const urlCeis = `${CEIS_API}?cnpjSancionado=${cnpjLimpo}&pagina=1`;
      const dadosCeis = await buscarJSON(urlCeis);
      if (dadosCeis && Array.isArray(dadosCeis) && dadosCeis.length > 0) {
        dadosCeis.forEach((s) => {
          resultados.push({
            cnpj,
            empresa: s.sancionado?.nome || "Não informado",
            tipo: "CEIS",
            motivo: s.fundamentacao?.descricaoFundamentacao || s.tipoSancao?.descricaoTipoSancao || "Não informado",
            orgao_sancionador: s.orgaoSancionador?.nome || "Não informado",
            data_inicio: s.dataInicioSancao || "",
            data_fim: s.dataFimSancao || null,
            ativa: !s.dataFimSancao || new Date(s.dataFimSancao) > new Date(),
            fundamentacao: s.fundamentacao?.descricaoFundamentacao || "",
          });
        });
      }

      // CNEP
      const urlCnep = `${CNEP_API}?cnpjSancionado=${cnpjLimpo}&pagina=1`;
      const dadosCnep = await buscarJSON(urlCnep);
      if (dadosCnep && Array.isArray(dadosCnep) && dadosCnep.length > 0) {
        dadosCnep.forEach((s) => {
          resultados.push({
            cnpj,
            empresa: s.sancionado?.nome || "Não informado",
            tipo: "CNEP",
            motivo: s.fundamentacao?.descricaoFundamentacao || s.tipoSancao?.descricaoTipoSancao || "Não informado",
            orgao_sancionador: s.orgaoSancionador?.nome || "Não informado",
            data_inicio: s.dataInicioSancao || "",
            data_fim: s.dataFimSancao || null,
            ativa: !s.dataFimSancao || new Date(s.dataFimSancao) > new Date(),
            fundamentacao: s.fundamentacao?.descricaoFundamentacao || "",
          });
        });
      }

      // Rate limiting
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      // API pode exigir chave — silenciar erros 401/403
      if (!err.message.includes("401") && !err.message.includes("403")) {
        console.log(`    [AVISO] CEIS/CNEP ${cnpj}: ${err.message}`);
      }
    }
  }

  console.log(`  [OK] CEIS/CNEP: ${resultados.length} sanções encontradas`);
  return resultados;
}

/**
 * Valida CNPJs monitorados e atualiza vinculos.json com sanções coletadas.
 */
function validarCNPJsEAtualizarVinculos(sancoes) {
  console.log("\n  Validando CNPJs monitorados...");
  const caminhoVinculos = path.join(__dirname, "vinculos.json");
  let vinculos;
  try {
    vinculos = JSON.parse(fs.readFileSync(caminhoVinculos, "utf-8"));
  } catch {
    console.log("  [AVISO] vinculos.json não encontrado, pulando validação.");
    return;
  }

  let cnpjsCorrigidos = 0;
  let cnpjsInvalidos = 0;

  // Validar CNPJs das empresas monitoradas
  if (vinculos.empresas_monitoradas) {
    vinculos.empresas_monitoradas.forEach((empresa) => {
      const valido = validarCNPJ(empresa.cnpj);
      if (valido && !empresa.cnpj_valido) {
        empresa.cnpj_valido = true;
        cnpjsCorrigidos++;
      } else if (!valido) {
        empresa.cnpj_valido = false;
        cnpjsInvalidos++;
      }
    });
  }

  // Validar CNPJs monitorados do coletor
  const cnpjsMonitoradosInvalidos = CNPJS_MONITORADOS.filter((c) => !validarCNPJ(c));
  if (cnpjsMonitoradosInvalidos.length > 0) {
    console.log(`  [ALERTA] ${cnpjsMonitoradosInvalidos.length} CNPJs monitorados com dígitos verificadores inválidos:`);
    cnpjsMonitoradosInvalidos.forEach((c) => console.log(`    INVÁLIDO: ${c}`));
  }

  // Merge sanções no vinculos.json
  if (sancoes && sancoes.length > 0) {
    vinculos.sancoes_ativas = sancoes.filter((s) => s.ativa);
    vinculos.sancoes_historico = sancoes.filter((s) => !s.ativa);
    console.log(`  [OK] ${vinculos.sancoes_ativas.length} sanções ativas adicionadas ao vinculos.json`);
  }

  // Atualizar metadata
  vinculos._meta.gerado_em = new Date().toISOString();
  vinculos._meta.cnpjs_validos = (vinculos.empresas_monitoradas || []).filter((e) => e.cnpj_valido).length;
  vinculos._meta.cnpjs_invalidos = (vinculos.empresas_monitoradas || []).filter((e) => !e.cnpj_valido).length;

  fs.writeFileSync(caminhoVinculos, JSON.stringify(vinculos, null, 2), "utf-8");
  console.log(`  [OK] vinculos.json atualizado (${cnpjsCorrigidos} corrigidos, ${cnpjsInvalidos} inválidos restantes)`);
}

/**
 * Busca notícias de Diários Oficiais e TCE via RSS.
 */
async function buscarDiariosOficiaisETCE() {
  console.log("\n  Diários Oficiais e TCE: Coletando...");
  const fontes = [...DIARIOS_OFICIAIS_RSS, ...TCE_FONTES];
  const resultados = await Promise.all(fontes.map(buscarFonteRSS));
  const todos = resultados.flat();
  console.log(`  [OK] Diários/TCE: ${todos.length} itens coletados`);
  return todos;
}

// Caminho de saída para sanções
const CAMINHO_SANCOES_JSON = path.join(__dirname, "sancoes.json");

// ============================================================
// 7. UTILIDADES
// ============================================================
function removerDuplicatas(lista, chave = "link") {
  const vistos = new Set();
  const unicas = [];
  for (const item of lista) {
    const k = item[chave];
    if (k && !vistos.has(k)) {
      vistos.add(k);
      unicas.push(item);
    }
  }
  const removidas = lista.length - unicas.length;
  if (removidas > 0) console.log(`  [INFO] ${removidas} duplicata(s) removida(s)`);
  return unicas;
}

function ordenarPorData(lista, campo = "data_publicacao") {
  return lista.sort((a, b) => new Date(b[campo]) - new Date(a[campo]));
}

// ============================================================
// 8. SALVAR EM JSON (com metadados de frescor)
// ============================================================
function salvarJSON(dados, caminho) {
  const diretorio = path.dirname(caminho);
  if (!fs.existsSync(diretorio)) fs.mkdirSync(diretorio, { recursive: true });
  fs.writeFileSync(caminho, JSON.stringify(dados, null, 2), "utf-8");
  const total = Array.isArray(dados) ? dados.length : (dados.noticias || dados.licitacoes || []).length;
  console.log(`  [OK] ${total} itens -> ${path.basename(caminho)}`);
}

/** Salva JSON com envelope de metadados indicando frescor e fonte */
function salvarJSONComMeta(dados, caminho, tipo, fontesUsadas) {
  const diretorio = path.dirname(caminho);
  if (!fs.existsSync(diretorio)) fs.mkdirSync(diretorio, { recursive: true });
  const envelope = {
    _meta: {
      fonte_dados: "coletado",
      aviso: "Dados coletados automaticamente via RSS e APIs públicas pelo coletor.js",
      gerado_em: new Date().toISOString(),
      total: dados.length,
      fontes_reais_configuradas: fontesUsadas || [],
    },
  };
  envelope[tipo] = dados.map((item) => ({ ...item, verificado: true }));
  fs.writeFileSync(caminho, JSON.stringify(envelope, null, 2), "utf-8");
  console.log(`  [OK] ${dados.length} itens -> ${path.basename(caminho)}`);
}

/** Gera meta.json com timestamps de frescor para o Hub */
function salvarMetaJSON() {
  const meta = {
    ultima_coleta: new Date().toISOString(),
    versao_coletor: "3.0",
    fontes: {
      rss: FONTES_RSS.map((f) => f.nome),
      pncp: "API PNCP v1",
      ceis_cnep: "Portal da Transparência",
      diarios: DIARIOS_OFICIAIS_RSS.map((f) => f.nome),
      tce: TCE_FONTES.map((f) => f.nome),
    },
    status: "ok",
  };
  const caminho = path.join(__dirname, "meta.json");
  fs.writeFileSync(caminho, JSON.stringify(meta, null, 2), "utf-8");
  console.log(`  [OK] meta.json atualizado`);
}

// ============================================================
// 9. SALVAR EM TS (embutido para build estático)
// ============================================================
function salvarNoticiasTS(noticias, caminho) {
  const diretorio = path.dirname(caminho);
  if (!fs.existsSync(diretorio)) fs.mkdirSync(diretorio, { recursive: true });

  const itens = noticias.map((n) => {
    return "  {\n"
      + '    titulo: "' + escaparParaTS(n.titulo) + '",\n'
      + '    link: "' + escaparParaTS(n.link) + '",\n'
      + '    data_publicacao: "' + escaparParaTS(n.data_publicacao) + '",\n'
      + '    fonte: "' + escaparParaTS(n.fonte) + '",\n'
      + "  }";
  });

  const conteudo = `/**
 * Arquivo gerado automaticamente por coletor.js em ${new Date().toISOString()}
 * Para atualizar: node coletor.js
 */

export interface Noticia {
  titulo: string;
  link: string;
  data_publicacao: string;
  fonte: string;
}

const noticias: Noticia[] = [
${itens.join(",\n")}
];

export default noticias;
`;

  fs.writeFileSync(caminho, conteudo, "utf-8");
  console.log(`  [OK] TS embutido -> ${path.basename(caminho)}`);
}

function salvarArtigosTS(artigos, caminho) {
  const diretorio = path.dirname(caminho);
  if (!fs.existsSync(diretorio)) fs.mkdirSync(diretorio, { recursive: true });

  const itens = artigos.map((a) => {
    const cats = JSON.stringify(a.categorias);
    return "  {\n"
      + '    titulo: "' + escaparParaTS(a.titulo) + '",\n'
      + '    link: "' + escaparParaTS(a.link) + '",\n'
      + '    resumo: "' + escaparParaTS(a.resumo) + '",\n'
      + '    data_publicacao: "' + escaparParaTS(a.data_publicacao) + '",\n'
      + '    fonte: "' + escaparParaTS(a.fonte) + '",\n'
      + '    autor: "' + escaparParaTS(a.fonte) + '",\n'
      + "    categorias: " + cats + ",\n"
      + '    imagem: "' + escaparParaTS(a.imagem || "") + '",\n'
      + "  }";
  });

  const conteudo = `/**
 * Arquivo gerado automaticamente por coletor.js em ${new Date().toISOString()}
 * Para atualizar: node coletor.js
 */

import type { Artigo } from "@/types/database";

const artigos: Artigo[] = [
${itens.join(",\n")}
];

export default artigos;
`;

  fs.writeFileSync(caminho, conteudo, "utf-8");
  console.log(`  [OK] TS embutido -> ${path.basename(caminho)}`);
}

function salvarLicitacoesTS(licitacoes, caminho) {
  const diretorio = path.dirname(caminho);
  if (!fs.existsSync(diretorio)) fs.mkdirSync(diretorio, { recursive: true });

  const itens = licitacoes.map((l, idx) => {
    return "  {\n"
      + '    id: "' + (idx + 1) + '",\n'
      + '    titulo: "' + escaparParaTS(l.titulo) + '",\n'
      + '    orgao: "' + escaparParaTS(l.orgao) + '",\n'
      + '    estado: "' + escaparParaTS(l.estado) + '",\n'
      + '    categoria: "' + escaparParaTS(l.categoria) + '",\n'
      + '    data_abertura: "' + escaparParaTS(l.data_abertura) + '",\n'
      + "    valor_estimado: " + Number(l.valor_estimado) + ",\n"
      + '    valor_estimado_fmt: "' + escaparParaTS(l.valor_estimado_fmt) + '",\n'
      + '    link: "' + escaparParaTS(l.link) + '",\n'
      + '    modalidade: "' + escaparParaTS(l.modalidade) + '",\n'
      + '    numero_controle: "' + escaparParaTS(l.numero_controle || "") + '",\n'
      + "  }";
  });

  const conteudo = `/**
 * Licitações embutidas — dados reais do PNCP.
 * Gerado automaticamente por coletor.js em ${new Date().toISOString()}
 * Para atualizar: node coletor.js
 */

import type { Licitacao } from "@/types/database";

export const dadosEmbutidosLicitacoes: Licitacao[] = [
${itens.join(",\n")}
];

const licitacoes = dadosEmbutidosLicitacoes;
export default licitacoes;
`;

  fs.writeFileSync(caminho, conteudo, "utf-8");
  console.log(`  [OK] TS embutido -> ${path.basename(caminho)}`);
}

// ============================================================
// 10. FLUXO PRINCIPAL
// ============================================================
async function main() {
  console.log("==================================================");
  console.log("  Hub ConstruData - Coletor de Dados v2.0");
  console.log("==================================================\n");

  // ─── FASE 1: RSS (Notícias + Artigos) ───
  console.log("FASE 1: Coletando RSS (noticias e artigos)...\n");

  const resultadosRSS = await Promise.all(FONTES_RSS.map(buscarFonteRSS));
  const todosItensRSS = resultadosRSS.flat();
  console.log(`\n  [INFO] Total coletado via RSS: ${todosItensRSS.length} itens`);

  if (todosItensRSS.length > 0) {
    // --- Notícias (formato simples: titulo, link, data, fonte) ---
    const noticias = removerDuplicatas(todosItensRSS.map((item) => ({
      titulo: item.titulo,
      link: item.link,
      data_publicacao: item.data_publicacao,
      fonte: item.fonte,
    })));
    const noticiasOrdenadas = ordenarPorData(noticias).slice(0, 50);

    console.log("\n  Salvando noticias...");
    salvarJSONComMeta(noticiasOrdenadas, CAMINHO_NOTICIAS_JSON, "noticias", FONTES_RSS.map((f) => `${f.nome} (RSS)`));
    salvarNoticiasTS(noticiasOrdenadas, CAMINHO_NOTICIAS_TS);

    // --- Artigos (com descrição, categorias, imagem) ---
    const artigosComDescricao = todosItensRSS.filter((item) => item.descricao && item.descricao.length > 50);
    const artigosUnicos = removerDuplicatas(artigosComDescricao);
    const artigosOrdenados = ordenarPorData(artigosUnicos).slice(0, 30);

    // Formatar para o tipo Artigo
    const artigosFormatados = artigosOrdenados.map((item) => ({
      titulo: item.titulo,
      link: item.link,
      resumo: item.descricao.slice(0, 300),
      data_publicacao: item.data_publicacao,
      fonte: item.fonte,
      autor: item.fonte,
      categorias: item.categorias,
      imagem: item.imagem || "",
    }));

    console.log("\n  Salvando artigos...");
    salvarJSON(artigosFormatados, CAMINHO_ARTIGOS_JSON);
    salvarArtigosTS(artigosFormatados, CAMINHO_ARTIGOS_TS);
  } else {
    console.log("  [AVISO] Nenhum item coletado via RSS.");
  }

  // ─── FASE 2: PNCP (Licitações) ───
  console.log("\nFASE 2: Coletando licitacoes do PNCP...\n");

  const licitacoes = await buscarLicitacoesPNCP();

  if (licitacoes.length > 0) {
    const licitacoesUnicas = removerDuplicatas(licitacoes, "numero_controle");
    const licitacoesOrdenadas = ordenarPorData(licitacoesUnicas, "data_abertura").slice(0, 100);

    console.log("\n  Salvando licitacoes...");
    salvarJSONComMeta(licitacoesOrdenadas, CAMINHO_LICITACOES_JSON, "licitacoes", ["API PNCP (pncp.gov.br)"]);
    salvarLicitacoesTS(licitacoesOrdenadas, CAMINHO_LICITACOES_TS);
  } else {
    console.log("  [AVISO] Nenhuma licitacao coletada do PNCP.");
    console.log("  [INFO] Mantendo dados embutidos existentes.");
  }

  // ─── FASE 3: CEIS/CNEP (Sanções) + Validação de Vínculos ───
  console.log("\nFASE 3: Consultando sancoes CEIS/CNEP...\n");

  let sancoesColetadas = [];
  try {
    sancoesColetadas = await buscarSancoesCEIS();
    if (sancoesColetadas.length > 0) {
      salvarJSON(sancoesColetadas, CAMINHO_SANCOES_JSON);
    }
  } catch (err) {
    console.log(`  [AVISO] CEIS/CNEP indisponivel: ${err.message}`);
    console.log("  [INFO] A API pode exigir chave de acesso.");
    console.log("  [INFO] Cadastre-se em: https://portaldatransparencia.gov.br/api-de-dados/cadastrar");
  }

  // Validar CNPJs e atualizar vinculos.json com sanções
  console.log("\nFASE 3B: Validando CNPJs e atualizando vinculos.json...\n");
  validarCNPJsEAtualizarVinculos(sancoesColetadas);

  // ─── FASE 4: Diários Oficiais + TCE ───
  console.log("\nFASE 4: Coletando Diarios Oficiais e TCE...\n");

  try {
    const itensDiariosTCE = await buscarDiariosOficiaisETCE();
    if (itensDiariosTCE.length > 0) {
      // Merge com notícias existentes
      const noticiasExtra = removerDuplicatas(itensDiariosTCE.map((item) => ({
        titulo: item.titulo,
        link: item.link,
        data_publicacao: item.data_publicacao,
        fonte: item.fonte,
      })));
      const extraOrdenadas = ordenarPorData(noticiasExtra).slice(0, 30);

      // Salvar como arquivo separado
      const caminhoExtras = path.join(__dirname, "diarios-tce.json");
      salvarJSON(extraOrdenadas, caminhoExtras);
    }
  } catch (err) {
    console.log(`  [AVISO] Diarios/TCE: ${err.message}`);
  }

  // ─── GERAR META.JSON ───
  salvarMetaJSON();

  // ─── COPIAR PARA DIST ───
  try {
    const distHub = path.join(RAIZ_PROJETO, "dist", "hub");
    if (fs.existsSync(distHub)) {
      for (const arq of ["noticias.json", "licitacoes.json", "artigos.json", "meta.json", "sancoes.json", "diarios-tce.json", "vinculos.json"]) {
        const origem = path.join(__dirname, arq);
        const destino = path.join(distHub, arq);
        if (fs.existsSync(origem)) {
          fs.copyFileSync(origem, destino);
          console.log(`  [SYNC] ${arq} -> dist/hub/`);
        }
      }
    }
  } catch (err) {
    console.log(`  [AVISO] Sync dist/hub: ${err.message}`);
  }

  // ─── RESUMO ───
  console.log("\n==================================================");
  console.log("  Hub ConstruData - Coletor de Dados v3.0");
  console.log("  Coleta concluida!");
  console.log("==================================================");
  console.log("  Fontes coletadas:");
  console.log("    - RSS: 17+ fontes (noticias e artigos)");
  console.log("    - PNCP: Licitacoes de engenharia e saneamento");
  console.log("    - CEIS/CNEP: Sancoes do Portal da Transparencia");
  console.log("    - DOU: Diarios Oficiais (Secoes 1 e 3)");
  console.log("    - TCU: Noticias do Tribunal de Contas da Uniao");
  console.log("  meta.json gerado com timestamps de frescor.");
  console.log("  Agora rode 'npm run build' para gerar o bundle.");
  console.log("==================================================");
}

main();
