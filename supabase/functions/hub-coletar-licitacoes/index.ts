import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts'

// ============================================================
// CONFIGURAÇÃO PNCP - Máxima cobertura
// ============================================================
const PNCP_BASE =
  "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao";

// TODAS as modalidades para máxima cobertura
const MODALIDADES = [
  { id: 4, nome: "Concorrência Eletrônica" },
  { id: 5, nome: "Concorrência Presencial" },
  { id: 6, nome: "Pregão Eletrônico" },
  { id: 7, nome: "Pregão Presencial" },
  { id: 8, nome: "Dispensa de Licitação" },
  { id: 9, nome: "Inexigibilidade" },
  { id: 12, nome: "Credenciamento" },
];

const MODALIDADES_MAP: Record<number, string> = {
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

// Palavras-chave ampliadas para máxima cobertura
const PALAVRAS_CHAVE = [
  // Engenharia geral
  "engenharia",
  "projeto",
  "laudo",
  "consultoria técnica",
  "ART",
  "topografia",
  "geotecnia",
  "sondagem",
  "fundação",
  "fundações",
  "estrutura",
  "estrutural",
  "concreto",
  "armado",
  "protendido",
  "cálculo estrutural",
  "BIM",
  "modelagem",
  "levantamento",
  "fiscalização",
  "supervisão",
  "gerenciamento de obras",
  // Construção civil
  "construção",
  "obra",
  "edificação",
  "reforma",
  "ampliação",
  "habitação",
  "habitacional",
  "alvenaria",
  "acabamento",
  "demolição",
  "recuperação",
  "restauração",
  "manutenção predial",
  // Infraestrutura
  "infraestrutura",
  "pavimentação",
  "drenagem",
  "terraplanagem",
  "ponte",
  "viaduto",
  "rodovia",
  "estrada",
  "ferrovia",
  "porto",
  "aeroporto",
  "metrô",
  "túnel",
  "passarela",
  "contenção",
  "muro de arrimo",
  "urbanização",
  "iluminação pública",
  "sinalização",
  // Saneamento & Hídrico
  "saneamento",
  "esgoto",
  "água",
  "hídrico",
  "hidrico",
  "barragem",
  "reservatório",
  "adutora",
  "tratamento",
  "ETA",
  "ETE",
  "rede de distribuição",
  "interceptor",
  "emissário",
  "captação",
  "poço",
  "cisternas",
  "irrigação",
  "canal",
  "açude",
  "dessalinização",
  // Elétrica & Instalações
  "elétrica",
  "subestação",
  "rede elétrica",
  "instalações",
  "SPDA",
  "cabeamento",
  "energia solar",
  "fotovoltaico",
  "geração",
  "transmissão",
  // Ambiental
  "resíduos",
  "residuos",
  "aterro",
  "ambiental",
  "EIA",
  "RIMA",
  "licenciamento ambiental",
  "recuperação ambiental",
  "reflorestamento",
  "monitoramento ambiental",
  // Geotécnica e mineração
  "perfuração",
  "estaca",
  "tubulão",
  "aterro sanitário",
  "terraplenagem",
  // Outras engenharias
  "ar condicionado",
  "HVAC",
  "climatização",
  "incêndio",
  "elevador",
  "hidráulica",
  "mecânica",
];

function categorizarLicitacao(titulo: string): string {
  const t = titulo.toLowerCase();
  if (
    t.includes("projeto") ||
    t.includes("consultoria") ||
    t.includes("laudo") ||
    t.includes("topografi") ||
    t.includes("bim") ||
    t.includes("fiscalização")
  )
    return "Engenharia";
  if (
    t.includes("estrutur") ||
    t.includes("fundaç") ||
    t.includes("geotecni") ||
    t.includes("sondagem") ||
    t.includes("concreto") ||
    t.includes("estaca") ||
    t.includes("contenção")
  )
    return "Eng. Estrutural";
  if (
    t.includes("elétr") ||
    t.includes("subestação") ||
    t.includes("instalações") ||
    t.includes("energia solar") ||
    t.includes("fotovoltaic")
  )
    return "Eng. Elétrica";
  if (
    t.includes("saneamento") ||
    t.includes("esgoto") ||
    t.includes("água") ||
    t.includes(" eta ") ||
    t.includes(" ete ") ||
    t.includes("adutora") ||
    t.includes("captação")
  )
    return "Saneamento";
  if (
    t.includes("paviment") ||
    t.includes("drenag") ||
    t.includes("infraestrutura") ||
    t.includes("ponte") ||
    t.includes("rodovia") ||
    t.includes("ferrovia") ||
    t.includes("urbanização")
  )
    return "Infraestrutura";
  if (
    t.includes("construção") ||
    t.includes("edificação") ||
    t.includes("habitac") ||
    t.includes("obra") ||
    t.includes("reforma")
  )
    return "Construção Civil";
  if (
    t.includes("barragem") ||
    t.includes("reservatório") ||
    t.includes("adut") ||
    t.includes("hídric") ||
    t.includes("hidric") ||
    t.includes("irrigação") ||
    t.includes("canal")
  )
    return "Recursos Hídricos";
  if (
    t.includes("resíduo") ||
    t.includes("aterro") ||
    t.includes("ambiental") ||
    t.includes("meio ambiente") ||
    t.includes("licenciamento")
  )
    return "Eng. Ambiental";
  return "Engenharia";
}

function formatarDataPNCP(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function formatarMoeda(valor: number): string {
  if (!valor || valor <= 0) return "Valor não informado";
  return `R$ ${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function fetchJSON(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": "HubConstrudata/3.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function buscarModalidade(
  modalidadeId: number,
  dataInicial: string,
  dataFinal: string
): Promise<unknown[]> {
  const resultados: unknown[] = [];
  const maxPaginas = 10;

  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const url = `${PNCP_BASE}?dataInicial=${dataInicial}&dataFinal=${dataFinal}&codigoModalidadeContratacao=${modalidadeId}&tamanhoPagina=50&pagina=${pagina}`;

    try {
      const dados = (await fetchJSON(url)) as {
        data?: unknown[];
        paginasRestantes?: number;
      };
      const itens = dados?.data || [];
      if (itens.length === 0) break;

      resultados.push(...itens);
      if ((dados?.paginasRestantes ?? 0) === 0) break;

      // Rate limiting
      await new Promise((r) => setTimeout(r, 400));
    } catch {
      break;
    }
  }

  return resultados;
}

interface PNCPItem {
  objetoCompra?: string;
  orgaoEntidade?: {
    razaoSocial?: string;
    cnpj?: string;
    uf?: string;
  };
  unidadeOrgao?: {
    ufSigla?: string;
  };
  valorTotalEstimado?: number;
  modalidadeId?: number;
  codigoModalidadeContratacao?: number;
  dataPublicacaoPncp?: string;
  dataAberturaProposta?: string;
  anoCompra?: number;
  sequencialCompra?: number;
  numeroControlePNCP?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    // Auth - verificar usuário autenticado
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Usar service role para inserir dados
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar se o usuário é válido via anon key
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!,{
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseAnon.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    console.log(`Coleta iniciada por usuário: ${userData.user.id}`);

    // Parâmetros opcionais
    let diasAtras = 15;
    try {
      const body = await req.json();
      if (body?.dias) diasAtras = Math.min(Math.max(body.dias, 1), 60);
    } catch {
      // sem body, usar default
    }

    const hoje = new Date();
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - diasAtras);

    const dataInicial = formatarDataPNCP(inicio);
    const dataFinal = formatarDataPNCP(hoje);

    console.log(`Buscando PNCP: ${dataInicial} a ${dataFinal} (${diasAtras} dias)`);

    // Buscar todas as modalidades
    let todosItens: PNCPItem[] = [];
    for (const mod of MODALIDADES) {
      console.log(`Modalidade ${mod.id} (${mod.nome})...`);
      const itens = await buscarModalidade(mod.id, dataInicial, dataFinal);
      console.log(`  -> ${itens.length} itens`);
      todosItens.push(...(itens as PNCPItem[]));
      // Rate limiting entre modalidades
      await new Promise((r) => setTimeout(r, 800));
    }

    console.log(`Total bruto: ${todosItens.length}`);

    // Filtrar por palavras-chave
    const relevantes = todosItens.filter((item) => {
      const texto = (item.objetoCompra || "").toLowerCase();
      return PALAVRAS_CHAVE.some((kw) => texto.includes(kw.toLowerCase()));
    });

    console.log(`Filtradas: ${relevantes.length} relevantes`);

    // Mapear para formato da tabela
    const licitacoes = relevantes.map((item) => {
      const orgao = item.orgaoEntidade || {};
      const unidade = item.unidadeOrgao || {};
      const titulo = (item.objetoCompra || "").slice(0, 500);
      const valor = item.valorTotalEstimado || 0;
      const modalidadeId =
        item.modalidadeId || item.codigoModalidadeContratacao;
      const uf = unidade.ufSigla || orgao.uf || "BR";
      const cnpj = orgao.cnpj || "";
      const ano = item.anoCompra || 0;
      const seq = item.sequencialCompra || 0;

      const link =
        cnpj && ano && seq
          ? `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`
          : "https://pncp.gov.br";

      const numeroControle = item.numeroControlePNCP || `PNCP-${cnpj}-${ano}-${seq}`;

      return {
        numero_controle: numeroControle,
        titulo,
        orgao: orgao.razaoSocial || "Órgão não informado",
        estado: uf,
        categoria: categorizarLicitacao(titulo),
        data_abertura:
          (item.dataPublicacaoPncp || item.dataAberturaProposta || "").split(
            "T"
          )[0] || null,
        valor_estimado: valor,
        valor_estimado_fmt: formatarMoeda(valor),
        link,
        modalidade: MODALIDADES_MAP[modalidadeId || 0] || `Modalidade ${modalidadeId}`,
        modalidade_id: modalidadeId,
        cnpj_orgao: cnpj,
        ano_compra: ano,
        sequencial_compra: seq,
        fonte: "PNCP",
        verificado: true,
        updated_at: new Date().toISOString(),
      };
    });

    // Deduplicate por numero_controle
    const vistos = new Set<string>();
    const unicos = licitacoes.filter((l) => {
      if (vistos.has(l.numero_controle)) return false;
      vistos.add(l.numero_controle);
      return true;
    });

    console.log(`Únicos: ${unicos.length}`);

    // Upsert no Supabase em lotes de 50
    let totalInseridos = 0;
    let totalNovos = 0;

    for (let i = 0; i < unicos.length; i += 50) {
      const lote = unicos.slice(i, i + 50);

      const { data, error } = await supabase
        .from("hub_licitacoes")
        .upsert(lote, { onConflict: "numero_controle", ignoreDuplicates: false })
        .select("id");

      if (error) {
        console.error(`Erro no lote ${i}: ${error.message}`);
      } else {
        totalInseridos += (data?.length || 0);
      }
    }

    // Contar total na tabela
    const { count } = await supabase
      .from("hub_licitacoes")
      .select("*", { count: "exact", head: true });

    // Registrar metadados da coleta
    await supabase.from("hub_coleta_meta").insert({
      tipo: "licitacoes",
      total_coletado: unicos.length,
      total_novos: totalInseridos,
      fonte: "PNCP",
      status: "ok",
    });

    const resultado = {
      sucesso: true,
      periodo: `${dataInicial} a ${dataFinal}`,
      total_bruto: todosItens.length,
      total_relevantes: relevantes.length,
      total_unicos: unicos.length,
      total_upserted: totalInseridos,
      total_na_base: count || 0,
      modalidades_consultadas: MODALIDADES.map((m) => m.nome),
      coletado_em: new Date().toISOString(),
    };

    console.log("Coleta concluída:", JSON.stringify(resultado));

    return new Response(JSON.stringify(resultado), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Erro na coleta:", message);

    // Tentar registrar erro
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase.from("hub_coleta_meta").insert({
        tipo: "licitacoes",
        total_coletado: 0,
        total_novos: 0,
        fonte: "PNCP",
        status: "erro",
        erro: message,
      });
    } catch {
      // silenciar
    }

    return new Response(JSON.stringify({ error: message }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 500,
    });
  }
});
