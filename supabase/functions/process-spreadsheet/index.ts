import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { spreadsheetData, customKeywords, catalogedMaterials } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Processing spreadsheet with AI...');

    // Build enhanced system prompt with custom keywords AND cataloged materials
    let keywordsContext = '';
    let materialsContext = '';
    
    if (customKeywords && Array.isArray(customKeywords) && customKeywords.length > 0) {
      const keywordsByType = customKeywords.reduce((acc: any, kw: any) => {
        if (!acc[kw.keyword_type]) acc[kw.keyword_type] = [];
        acc[kw.keyword_type].push(kw.keyword_value);
        return acc;
      }, {});
      
      keywordsContext = '\n\n=== CUSTOM KEYWORDS TO IDENTIFY (HIGHEST PRIORITY) ===\n';
      for (const [type, values] of Object.entries(keywordsByType)) {
        const typeLabel = type === 'brand' ? 'MARCAS' : 
                         type === 'color' ? 'CORES' : 
                         type === 'unit' ? 'UNIDADES' : 
                         type.toUpperCase();
        keywordsContext += `${typeLabel}: ${(values as string[]).join(', ')}\n`;
      }
      keywordsContext += `
CRITICAL INSTRUCTIONS FOR KEYWORDS:
1. These custom keywords have ABSOLUTE PRIORITY over any other identification
2. Match keywords in a case-insensitive manner: "Tigre", "tigre", "TIGRE" are all the same
3. Recognize SYNONYMS and similar variations:
   - "Tigre" matches "marca tigre", "da tigre", "tigre®"
   - "Branco" matches "cor branca", "na cor branco", "branco gelo"
   - "50kg" matches "50 kg", "50kg.", "50 quilos"
4. When you find ANY of these keywords or their variations, mark confidence as 95-100
5. If the data contains these keywords, they MUST be extracted and used
6. Look for keywords even if they appear mixed with other text in descriptions
`;
    }

    // Build cataloged materials context for automatic pricing
    if (catalogedMaterials && Array.isArray(catalogedMaterials) && catalogedMaterials.length > 0) {
      materialsContext = '\n\n=== CATALOGED MATERIALS FOR PRICING (USE THESE PRICES) ===\n';
      catalogedMaterials.forEach((mat: any) => {
        materialsContext += `\nMaterial: ${mat.name}\n`;
        if (mat.brand) materialsContext += `  Brand: ${mat.brand}\n`;
        if (mat.color) materialsContext += `  Color: ${mat.color}\n`;
        if (mat.measurement) materialsContext += `  Measurement: ${mat.measurement}\n`;
        materialsContext += `  Unit: ${mat.unit}\n`;
        materialsContext += `  Material Price: ${mat.material_price || 0}\n`;
        materialsContext += `  Labor Price: ${mat.labor_price || 0}\n`;
        materialsContext += `  Total Price: ${mat.current_price}\n`;
        if (mat.keywords && mat.keywords.length > 0) {
          materialsContext += `  Keywords: ${mat.keywords.join(', ')}\n`;
        }
      });
      materialsContext += `
CRITICAL PRICING INSTRUCTIONS:
1. When you identify a material that matches one in the catalog, USE THE CATALOG PRICES
2. Match by name, keywords, brand, color, and measurement
3. Extract both material_price and labor_price separately from the catalog
4. Calculate price = material_price + labor_price
5. If no exact match found, set material_price, labor_price, and price to 0
6. ALWAYS calculate total = price × quantity
7. If quantity is 0 or null, set total to 0 and mark confidence accordingly
`;
    }

    const systemPrompt = `You are an AI specialized in extracting construction material information from spreadsheet data.
Your task is to analyze each row and extract structured data intelligently from the "Descrição" (Description) column.

CRITICAL INSTRUCTION: Focus on the "Descrição" column to identify and extract ALL subitems, materials, specifications.

EXTRACTION FIELDS:
- name: Material name (REQUIRED) - the core item being described
- brand: Brand name - look for brand names in description
- color: Color/finish - any color mentioned (branco, preto, cinza, vermelho, etc.)
- measurement: Size/dimensions (e.g., "50kg", "2.5L", "10x20cm", "6mm", "2,5x1m")
- unit: Unit of measurement (m, m², m³, kg, L, un, cx, pç, etc)
- material_price: Material unit price (USE CATALOGED MATERIAL PRICES when material matches, otherwise 0)
- labor_price: Labor unit price (USE CATALOGED LABOR PRICES when material matches, otherwise 0)
- price: Total unit price (material_price + labor_price)
- quantity: Quantity (numeric value only, if null or 0 then 0)
- total: Total price (price × quantity, always calculate this)
- confidence: Your confidence level (0-100) in this extraction

${keywordsContext}
${materialsContext}

INTELLIGENCE RULES FOR "DESCRIÇÃO" COLUMN PARSING:

1. IDENTIFY SUBITEMS AND COMPONENTS:
   Look for detailed specifications within descriptions, such as:
   - Material type (e.g., "cimento", "tinta", "tubo", "fio")
   - Technical specifications (e.g., "CP II-Z", "NBR 5410", "classe A")
   - Dimensions and measurements (e.g., "50kg", "18L", "2,5mm", "10x20cm")
   - Brand names (e.g., "Tigre", "Suvinil", "Gerdau")
   - Colors and finishes (e.g., "branco", "fosco", "acetinado")
   - Additional specs (e.g., "galvanizado", "PVC", "flexível")

2. PARSE COMPLEX DESCRIPTIONS INTELLIGENTLY:
   Example 1: "Cimento CP II-Z 50kg Marca Tigre Branco" extracts:
   - name: "Cimento CP II-Z"
   - brand: "Tigre"
   - color: "Branco"
   - measurement: "50kg"
   - unit: "kg"
   
   Example 2: "Tinta Acrílica Suvinil Premium 18L Branco Gelo Acetinado" extracts:
   - name: "Tinta Acrílica Premium"
   - brand: "Suvinil"
   - color: "Branco Gelo Acetinado"
   - measurement: "18L"
   - unit: "L"
   
   Example 3: "Tubo PVC 25mm Tigre Esgoto Marrom 6m" extracts:
   - name: "Tubo PVC Esgoto"
   - brand: "Tigre"
   - color: "Marrom"
   - measurement: "25mm x 6m"
   - unit: "un"

3. CONSIDER "OBSERVAÇÕES" (OBS/NOTES) FIELD:
   - If there's an "Obs" or "Observações" column, use it to:
     * Refine material specifications
     * Find additional colors, finishes, or technical details
     * Identify alternative brands or substitutes
     * Extract usage context that might clarify measurements

4. HANDLE VARIATIONS IN DATA FORMAT:
   - Prices: "R$ 25,50", "25.50", "R$25,5", "25,50" all = 25.50
   - Units: "M2", "m²", "metro quadrado", "m2" all = "m²"
   - Units: "KG", "kg", "quilos", "Kg" all = "kg"
   - Quantities: "10un", "10 unidades", "10 pcs", "10" all = 10
   - Measurements: "50 kg", "50kg", "50 quilos" all = "50kg"

5. CONTEXT AWARENESS WITH KEYWORDS:
   - If you see "Tinta" and custom keyword "Suvinil", likely brand is "Suvinil"
   - If description has "18L" and custom unit "L", extract measurement "18L" and unit "L"
   - Match keywords case-insensitively: "Tigre" = "tigre" = "TIGRE"
   - Recognize synonyms and variations defined in custom keywords

6. EXTRACT PHASES AND MAJOR ITEMS:
   If the row describes a construction phase or major item (e.g., "ESTRUTURA", "FUNDAÇÃO", "INSTALAÇÕES"):
   - name: Use the phase/item name
   - Leave other fields empty or null
   - Set confidence based on clarity

7. CONFIDENCE SCORING:
   - 95-100: Keyword matched from custom list OR very clear extraction
   - 80-94: Clear identification without keywords, all main fields present
   - 60-79: Reasonable inference, some fields missing
   - 40-59: Uncertain extraction, multiple fields missing
   - Below 40: Very uncertain, minimal information

8. MULTIPLE ITEMS IN ONE DESCRIPTION:
   If a single description contains multiple distinct materials, create separate entries for each.
   Example: "Cimento 50kg + Areia média 1m³" should create 2 entries.

Return a JSON array with ALL extracted materials. Never skip rows even if confidence is low.
Be thorough in identifying ALL subitems, colors, measurements, finishes, and specifications within each description.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract material information from this data:\n${JSON.stringify(spreadsheetData)}` }
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_materials",
            description: "Extract material information from spreadsheet data",
            parameters: {
              type: "object",
              properties: {
                materials: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      brand: { type: "string" },
                      color: { type: "string" },
                      measurement: { type: "string" },
                      unit: { type: "string" },
                      material_price: { type: "number" },
                      labor_price: { type: "number" },
                      price: { type: "number" },
                      quantity: { type: "number" },
                      total: { type: "number" },
                      confidence: { type: "number" }
                    },
                    required: ["name", "unit", "material_price", "labor_price", "price", "quantity", "total", "confidence"]
                  }
                }
              },
              required: ["materials"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_materials" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente mais tarde.' }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao seu workspace Lovable.' }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI gateway error: ${errorText}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const extractedMaterials = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ materials: extractedMaterials.materials }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing spreadsheet:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
