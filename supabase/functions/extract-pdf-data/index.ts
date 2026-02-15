import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BASE64_LENGTH = Math.ceil((MAX_PDF_BYTES / 3) * 4) + 16;
const MAX_PDF_TEXT_CHARS = 250_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isPdfHeader = (bytes: Uint8Array) =>
  bytes.length >= 4 &&
  bytes[0] === 0x25 &&
  bytes[1] === 0x50 &&
  bytes[2] === 0x44 &&
  bytes[3] === 0x46;

const safeJson = (s: string) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

const parseJsonArrayFromModel = (raw: string) => {
  const cleaned = raw.replace(/```json\n?|```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Modelo não retornou um array JSON válido");
  }
  const slice = cleaned.slice(start, end + 1);
  const parsed = JSON.parse(slice);
  if (!Array.isArray(parsed)) throw new Error("Saída do modelo não é um array");
  return parsed;
};

const coerceNumber = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(
      v
        .replace(/R\$\s*/gi, "")
        .replace(/\./g, "")
        .replace(/,/g, ".")
        .replace(/[^0-9.-]/g, "")
        .trim(),
    );
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const normalizeItem = (item: any) => {
  let description = typeof item?.description === "string" ? item.description.trim() : "";

  // Remove tokens de preço quando o parser “vaza” R$ / valores para dentro da descrição
  // (sem remover medidas do tipo "01,00" que aparecem em nomes: só remove quando há R$ associado)
  description = description
    .replace(/R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/gi, " ")
    .replace(/\d{1,3}(?:\.\d{3})*,\d{2}\s*R\$/gi, " ")
    .replace(/\bR\$\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Clean up description: remove trailing price patterns
  description = description
    .replace(/\s+\d{1,3}(?:\.\d{3})*,\d{2}\s*$/g, "")
    .trim();

  // Remove unit if it appears at the end of description (already captured separately)
  const UNITS_PATTERN = /\s+(UN|UND|PC|PÇ|PCA|CX|MT|M|M2|M3|KG|GL|LT|L|RL|BA|SC|CJ|VB|MES|MÊS|LA|CH|CT|ML|PT|BAL)\s*$/i;
  description = description.replace(UNITS_PATTERN, "").trim();

  const unit =
    typeof item?.unit === "string" && item.unit.trim()
      ? item.unit.trim().toUpperCase()
      : "UN";
  const supplier = typeof item?.supplier === "string" && item.supplier.trim() ? item.supplier.trim() : null;
  const material_price = coerceNumber(item?.material_price);
  const labor_price = coerceNumber(item?.labor_price);
  const price = coerceNumber(item?.price) || material_price + labor_price;
  // Clean keywords: filter out price-like strings and pure numbers
  const cleanKeyword = (k: string): string => {
    // Remove price patterns (e.g., "186 00", "1.234,56")
    const cleaned = k
      .replace(/R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/gi, "")
      .replace(/\d{1,3}(?:\.\d{3})*,\d{2}/g, "")
      .replace(/^\d+(?:\s+\d+)*$/, "") // pure numbers like "186 00"
      .replace(/\s+/g, " ")
      .trim();
    return cleaned;
  };

  const keywords = Array.isArray(item?.keywords)
    ? item.keywords
        .filter((kw: any) => typeof kw === "string")
        .map((kw: string) => cleanKeyword(kw))
        .filter((kw: string) => kw.length > 2 && !/^\d+$/.test(kw)) // ignore if only digits or too short
    : [];

  return { description, unit, supplier, material_price, labor_price, price, keywords };
};

const normalizeTextKey = (s: string) =>
  s
    // remove “vazamento” de preços na chave de dedupe (somente quando há R$ associado)
    .replace(/R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/gi, " ")
    .replace(/\d{1,3}(?:\.\d{3})*,\d{2}\s*R\$/gi, " ")
    .replace(/\bR\$\b/gi, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const dedupeItems = (items: Array<ReturnType<typeof normalizeItem>>) => {
  const seen = new Set<string>();
  const out: typeof items = [];

  for (const it of items) {
    const key = `${normalizeTextKey(it.description)}|${normalizeTextKey(it.unit || "UN")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }

  return out;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized - Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.error("Authentication failed:", authError?.message || "No user found");
      return new Response(JSON.stringify({ error: "Unauthorized - Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Authenticated user: ${user.id}`);

    const contentType = req.headers.get("content-type") ?? "";
    const isMultipart = contentType.includes("multipart/form-data");
    const isJson = contentType.includes("application/json");

    let pdfBytes: Uint8Array | null = null;
    let pdfText: string | null = null;

    if (isMultipart) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return new Response(JSON.stringify({ error: "Invalid input: missing file field" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (file.size > MAX_PDF_BYTES) {
        return new Response(JSON.stringify({ error: "PDF file is too large. Maximum size is 5MB." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      pdfBytes = new Uint8Array(await file.arrayBuffer());
    } else if (isJson) {
      const body = await req.json().catch(() => ({} as any));

      const maybeText = body?.pdfText;
      const base64 = body?.pdfBase64;

      if (typeof maybeText === "string" && maybeText.trim()) {
        if (maybeText.length > MAX_PDF_TEXT_CHARS) {
          return new Response(
            JSON.stringify({ error: `PDF text is too large. Max ${MAX_PDF_TEXT_CHARS} characters.` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        pdfText = maybeText;
      } else if (typeof base64 === "string" && base64) {
        if (base64.length > MAX_PDF_BASE64_LENGTH) {
          return new Response(JSON.stringify({ error: "PDF file is too large. Maximum size is 5MB." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        try {
          const binaryStr = atob(base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
          pdfBytes = bytes;
        } catch {
          return new Response(JSON.stringify({ error: "Invalid PDF format: not valid base64 encoding" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: "Invalid input: pdfText or pdfBase64 is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const bytes = new Uint8Array(await req.arrayBuffer());
      if (bytes.byteLength === 0) {
        return new Response(JSON.stringify({ error: "Invalid input: empty request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!contentType.includes("application/octet-stream") && !isPdfHeader(bytes)) {
        return new Response(
          JSON.stringify({ error: "Unsupported content-type. Send PDF bytes, multipart/form-data, or JSON." }),
          {
            status: 415,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (bytes.byteLength > MAX_PDF_BYTES) {
        return new Response(JSON.stringify({ error: "PDF file is too large. Maximum size is 5MB." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      pdfBytes = bytes;
    }

    // Validations
    if (!pdfText) {
      if (!pdfBytes) {
        return new Response(JSON.stringify({ error: "Invalid input: PDF bytes missing" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!isPdfHeader(pdfBytes)) {
        return new Response(JSON.stringify({ error: "Invalid input: body does not look like a PDF" }), {
          status: 415,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fast path: if we already have searchable PDF text, parse deterministically (no AI).
    const parsePdfTextToItems = (text: string) => {
      const KNOWN_UNITS = new Set([
        "UN", "UND", "PC", "PÇ", "PCA", "CX", "MT", "M", "M2", "M3",
        "KG", "GL", "LT", "L", "RL", "BA", "SC", "CJ", "VB", "MES",
        "MÊS", "LA", "CH", "CT", "ML", "PT", "BAL",
      ]);

      const isLikelyHeaderOrNoise = (line: string) => {
        const l = line.trim();
        if (!l || l.length < 3) return true;
        const n = normalizeTextKey(l);
        if (n.includes("descricao") && n.includes("unidade")) return true;
        if (n.includes("preco material") && n.includes("preco total")) return true;
        if (n === "product list") return true;
        if (/^page\s+\d+/i.test(l)) return true;
        if (/^#/.test(l)) return true;
        // Skip lines that are only "R$" patterns or numbers
        if (/^R\$\s*[\d.,]+$/i.test(l)) return true;
        return false;
      };

      const parseMoneyNumbers = (line: string): number[] => {
        // Capture Brazilian money formats: R$ 1.234,56 or 123,45
        const matches = line.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g) ?? [];
        return matches.map((m) => coerceNumber(m));
      };

      // Remove "R$" prefix from supplier names and clean up
      const cleanSupplier = (s: string | null): string | null => {
        if (!s) return null;
        // If it starts with R$ it's a price, not a supplier
        if (/^R\$\s*\d/.test(s)) return null;
        return s.replace(/^R\$\s*/i, "").trim() || null;
      };

      const itemsRaw: any[] = [];
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => !isLikelyHeaderOrNoise(l));

      console.log(`Parser: processing ${lines.length} lines from PDF text`);

      for (const line of lines) {
        // Parse columns by splitting on 2+ spaces or tabs
        const cols = line
          .split(/\s{2,}|\t/)
          .map((c) => c.trim())
          .filter(Boolean);

        if (cols.length === 0) continue;

        let description = "";
        let unit: string = "UN";
        let supplier: string | null = null;

        // Strategy: find the unit column (usually 2nd column)
        // Format expected: Description | Unit | Supplier | Preço Material | Preço M.O. | Preço Total | Keywords

        if (cols.length >= 2) {
          // Check if second column is a known unit
          const candidateUnit = cols[1]?.toUpperCase().replace(/[^A-Z0-9ÇÃÉÊÔ]/g, "");
          if (candidateUnit && KNOWN_UNITS.has(candidateUnit)) {
            description = cols[0];
            unit = candidateUnit === "UND" ? "UN" : candidateUnit;
            // Third column might be supplier (if not starting with R$)
            if (cols.length >= 3) {
              supplier = cleanSupplier(cols[2]);
            }
          } else {
            // Maybe unit is embedded in description or missing
            // Check if any column is a unit
            let foundUnit = false;
            for (let i = 1; i < Math.min(cols.length, 4); i++) {
              const cu = cols[i]?.toUpperCase().replace(/[^A-Z0-9ÇÃÉÊÔ]/g, "");
              if (cu && KNOWN_UNITS.has(cu)) {
                description = cols.slice(0, i).join(" ");
                unit = cu === "UND" ? "UN" : cu;
                if (cols.length > i + 1) {
                  supplier = cleanSupplier(cols[i + 1]);
                }
                foundUnit = true;
                break;
              }
            }
            if (!foundUnit) {
              // Use first column as description
              description = cols[0];
            }
          }
        } else {
          description = cols[0] || line;
        }

        // Skip if description is too short or looks like noise
        const descClean = description.replace(/[^a-zA-Z0-9À-ÿ]/g, "");
        if (descClean.length < 3) continue;
        // Skip if description is just numbers/prices
        if (/^[\d.,R$\s]+$/.test(description)) continue;

        const nums = parseMoneyNumbers(line);
        let material_price = 0;
        let labor_price = 0;
        let price = 0;

        // Usually format is: Preço Material | Preço M.O. | Preço Total
        // The last number is typically the total
        if (nums.length === 1) {
          material_price = nums[0];
          price = nums[0];
        } else if (nums.length === 2) {
          material_price = nums[0];
          price = nums[1];
        } else if (nums.length >= 3) {
          material_price = nums[0];
          labor_price = nums[1];
          price = nums[2];
        }

        // Keywords: look for comma/semicolon-separated values in last columns
        let keywords: string[] = [];
        if (cols.length >= 7) {
          const maybeKeywords = cols[cols.length - 1];
          if (maybeKeywords && /[,;|]/.test(maybeKeywords) && !/R\$/.test(maybeKeywords)) {
            keywords = maybeKeywords
              .split(/[,;|]/)
              .map((k) => k.trim())
              .filter(Boolean);
          }
        }

        itemsRaw.push({ description, unit, supplier, material_price, labor_price, price, keywords });
      }

      console.log(`Parser: extracted ${itemsRaw.length} raw items before normalization`);
      return itemsRaw;
    };

    if (pdfText) {
      console.log(`Parsing PDF text (no AI) for user: ${user.id}...`);
      const rawItems = parsePdfTextToItems(pdfText)
        .map(normalizeItem)
        .filter((it) => it.description);

      const items = dedupeItems(rawItems);

      if (items.length === 0) {
        return new Response(JSON.stringify({ error: "Nenhum item válido encontrado no texto do PDF." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Successfully parsed ${items.length} items from PDF text for user: ${user.id}`);
      return new Response(JSON.stringify({ items }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Slow path: binary/scanned PDFs require AI.
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    console.log(`Extracting data from PDF using AI for user: ${user.id}...`);

    // Prepare payload (PDF bytes -> base64)
    const pdfBase64 = encodeBase64(new Uint8Array(pdfBytes!).buffer as ArrayBuffer);

    const systemPrompt = `Você é um extrator de dados de tabelas de materiais em PDF com ALTA PRECISÃO.
IMPORTANTE: Extraia TODOS os itens da tabela - TODAS AS PÁGINAS do documento.

⚠️ ATENÇÃO MÁXIMA À ORTOGRAFIA:
- Copie os nomes dos materiais EXATAMENTE como aparecem no documento
- NÃO corrija, altere ou "interprete" os nomes - transcreva-os LITERALMENTE

Retorne um array JSON com objetos contendo:
- description (texto)
- unit (texto, default "UN")
- supplier (texto|null)
- material_price (número)
- labor_price (número)
- price (número)
- keywords (array)

REGRAS CRÍTICAS:
1) EXTRAIA TODOS OS ITENS DISPONÍVEIS NO CONTEÚDO RECEBIDO
2) TRANSCREVA OS NOMES EXATAMENTE como aparecem
3) Normalize números com vírgula/ponto (R$ 12,90 → 12.9)
4) Se preço vazio, use 0
5) Retorne APENAS o array JSON, sem explicações`;

    type Payload = { mode: "pdf"; pdfBase64: string };

    const callAi = async (model: string, payload: Payload, timeoutMs = 180_000) => {
      const controller = new AbortController();
      // Increased timeout to 180 seconds for large PDFs
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const messages = [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia TODOS os itens deste documento PDF (todas as páginas) em formato JSON:" },
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${payload.pdfBase64}` },
              },
            ],
          },
        ];

        console.log(`Calling AI model: ${model} with ${Math.round(payload.pdfBase64.length / 1024)}KB PDF`);

        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages,
            temperature: 0,
          }),
        });

        const raw = await resp.text();

        if (!resp.ok) {
          console.error("AI API error:", resp.status, raw);
          if (resp.status === 429) throw new HttpError(429, "Rate limit exceeded. Please try again later.");
          if (resp.status === 402) throw new HttpError(402, "AI service unavailable. Please try again later.");
          throw new Error(`AI API error: ${resp.status} ${raw || ""}`.trim());
        }

        if (!raw.trim()) throw new Error("AI API returned an empty response body");

        const data = safeJson(raw);
        const extractedText = data?.choices?.[0]?.message?.content;
        if (!extractedText || typeof extractedText !== "string") throw new Error("AI response missing content");

        console.log(`AI response received: ${extractedText.length} chars`);
        return extractedText;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.error(`AI call timed out for model: ${model}`);
          throw new Error(`Timeout: processamento demorou demais. Tente um PDF menor.`);
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }
    };

    const modelsToTry = ["google/gemini-2.5-flash", "google/gemini-3-flash-preview", "google/gemini-2.5-pro"];

    const runAiWithFallbacks = async (payload: Payload): Promise<string> => {
      let extractedText: string | null = null;
      let lastErr: unknown = null;

      for (const model of modelsToTry) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            console.log(`AI call: model=${model} attempt=${attempt} mode=${payload.mode}`);
            extractedText = await callAi(model, payload);
            break;
          } catch (err) {
            lastErr = err;
            if (err instanceof HttpError) throw err;
            console.error(`AI call failed: model=${model} attempt=${attempt}`, err);
            if (attempt < 2) await sleep(400 * attempt);
          }
        }
        if (extractedText) break;
      }

      if (!extractedText) throw (lastErr instanceof Error ? lastErr : new Error("Failed to extract PDF data"));
      return extractedText;
    };

    const extracted = await runAiWithFallbacks({ mode: "pdf", pdfBase64 });
    const rawItemsAll = parseJsonArrayFromModel(extracted).map(normalizeItem).filter((it) => it.description);

    const items = dedupeItems(rawItemsAll);

    if (items.length === 0) throw new Error("No valid items extracted from PDF");

    console.log(`Successfully extracted ${items.length} items (${rawItemsAll.length} before dedupe) for user: ${user.id}`);

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.error("Error in extract-pdf-data function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

