import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from '../_shared/cors.ts'

const PNCP_BASE =
  "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao";

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

function categorizarLicitacao(titulo: string): string {
  const t = titulo.toLowerCase();
  if (t.includes("estrutur") || t.includes("fundaç")) return "Eng. Estrutural";
  if (t.includes("elétr") || t.includes("subestação") || t.includes("energia")) return "Eng. Elétrica";
  if (t.includes("saneamento") || t.includes("esgot") || t.includes("água") || t.includes("agua") || t.includes("ete ") || t.includes("eta ") || t.includes("captação")) return "Saneamento";
  if (t.includes("drenagem") || t.includes("pluvial") || t.includes("enchente") || t.includes("inundaç")) return "Drenagem";
  if (t.includes("paviment") || t.includes("asfalto") || t.includes("rodovi") || t.includes("estrada") || t.includes("ponte")) return "Infraestrutura";
  if (t.includes("construç") || t.includes("reform") || t.includes("amplia") || t.includes("edifica")) return "Construção Civil";
  if (t.includes("barragem") || t.includes("irrigaç") || t.includes("reservatório") || t.includes("hídric")) return "Recursos Hídricos";
  if (t.includes("ambient") || t.includes("licenciamento") || t.includes("remediação")) return "Eng. Ambiental";
  return "Engenharia";
}

function formatarData(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const { termo, uf, dias = 30, modalidade, pagina = 1 } = await req.json();

    if (!termo || termo.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: "Informe um termo de busca com pelo menos 2 caracteres." }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const dataFinal = new Date();
    const dataInicial = new Date();
    dataInicial.setDate(dataInicial.getDate() - dias);

    const modalidades = modalidade
      ? [Number(modalidade)]
      : [4, 5, 6, 7, 8, 9, 12];

    const termoLower = termo.toLowerCase();
    const resultados: any[] = [];

    for (const modId of modalidades) {
      const params = new URLSearchParams({
        dataInicial: formatarData(dataInicial),
        dataFinal: formatarData(dataFinal),
        codigoModalidadeContratacao: String(modId),
        tamanhoPagina: "50",
        pagina: String(pagina),
      });

      if (uf && uf !== "Todos" && uf.length === 2) {
        params.set("codigoUf", uf);
      }

      const url = `${PNCP_BASE}?${params}`;

      try {
        const resp = await fetch(url, {
          headers: { Accept: "application/json" },
        });

        if (!resp.ok) continue;

        const data = await resp.json();
        const items = data?.data || data?.resultado || [];

        if (!Array.isArray(items)) continue;

        for (const item of items) {
          const titulo = item.objetoCompra || item.descricao || "";
          const orgao = item.orgaoEntidade?.razaoSocial || item.nomeOrgao || "";
          const textoCompleto = `${titulo} ${orgao}`.toLowerCase();

          if (!textoCompleto.includes(termoLower)) continue;

          const modalidadeId = item.modalidadeId || modId;
          const cnpj = item.orgaoEntidade?.cnpj || item.cnpjOrgao || "";
          const anoCompra = item.anoCompra || new Date().getFullYear();
          const seqCompra = item.sequencialCompra || 0;
          const numeroControle = cnpj && anoCompra && seqCompra
            ? `${cnpj}-${anoCompra}-${seqCompra}`
            : `PNCP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          const valorEstimado = item.valorTotalEstimado || item.valorEstimado || 0;

          const ufItem =
            item.unidadeOrgao?.ufSigla ||
            item.orgaoEntidade?.ufSigla ||
            item.ufSigla ||
            uf ||
            "BR";

          const dataAbertura =
            item.dataEncerramentoProposta ||
            item.dataAberturaProposta ||
            item.dataPublicacaoPncp ||
            null;

          const link =
            cnpj && anoCompra && seqCompra
              ? `https://pncp.gov.br/app/editais/${cnpj}/${anoCompra}/${seqCompra}`
              : `https://pncp.gov.br/app/editais?q=${encodeURIComponent(termo)}`;

          resultados.push({
            id: numeroControle,
            titulo,
            orgao,
            estado: ufItem,
            categoria: categorizarLicitacao(titulo),
            data_abertura: dataAbertura ? dataAbertura.substring(0, 10) : null,
            valor_estimado: valorEstimado,
            valor_estimado_fmt: valorEstimado
              ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorEstimado)
              : "Não informado",
            link,
            modalidade: MODALIDADES_MAP[modalidadeId] || `Modalidade ${modalidadeId}`,
            modalidade_id: modalidadeId,
            numero_controle: numeroControle,
            verificado: true,
            fonte: "PNCP Tempo Real",
          });
        }
      } catch {
        // Skip failed modalities
      }

      // Rate limit between modalities
      await new Promise((r) => setTimeout(r, 300));
    }

    // Deduplicate by numero_controle
    const seen = new Set<string>();
    const unicos = resultados.filter((r) => {
      if (seen.has(r.numero_controle)) return false;
      seen.add(r.numero_controle);
      return true;
    });

    // Sort by value descending
    unicos.sort((a, b) => (b.valor_estimado || 0) - (a.valor_estimado || 0));

    return new Response(
      JSON.stringify({
        licitacoes: unicos,
        total: unicos.length,
        termo,
        uf: uf || "Todos",
        dias,
        fonte: "PNCP API (tempo real via proxy)",
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro ao buscar no PNCP", detail: String(err) }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
