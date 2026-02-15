import * as pdfjsLib from "pdfjs-dist";

let workerConfigured = false;

const ensureWorker = async () => {
  if (workerConfigured) return;
  
  try {
    // Import the worker from the package directly - this works with Vite bundler
    const workerUrl = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch {
    // Fallback: disable worker and use main thread (slower but works)
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  }
  
  workerConfigured = true;
};

export async function extractPdfText(file: File): Promise<string> {
  await ensureWorker();

  const data = new Uint8Array(await file.arrayBuffer());
  
  // Disable worker if it fails to load - use main thread instead
  const pdf = await pdfjsLib.getDocument({ 
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // pdfjs returns positioned text chunks; to preserve table rows we must rebuild lines
    // using the Y coordinate (otherwise everything vira uma "linha gigante").
    const rawItems = (content.items as any[])
      .map((it) => {
        const str = typeof it?.str === "string" ? it.str : "";
        const t = Array.isArray(it?.transform) ? it.transform : null;
        const x = t ? Number(t[4]) : 0;
        const y = t ? Number(t[5]) : 0;
        return { str: str.trim(), x, y };
      })
      .filter((it) => it.str);

    // Sort: top-to-bottom (y desc), then left-to-right (x asc)
    rawItems.sort((a, b) => (b.y - a.y) || (a.x - b.x));

    const lines: string[] = [];
    const LINE_Y_THRESHOLD = 2.8; // works well for typical PDF table text

    let currentY: number | null = null;
    let currentLine: { str: string; x: number }[] = [];

    const flush = () => {
      if (!currentLine.length) return;
      currentLine.sort((a, b) => a.x - b.x);

      const GAP_TAB_THRESHOLD = 32; // heurística p/ separar colunas (tab) vs palavras (espaço)
      let lineText = "";
      let prevX: number | null = null;

      for (const p of currentLine) {
        if (prevX === null) {
          lineText += p.str;
          prevX = p.x;
          continue;
        }

        const gap = p.x - prevX;
        lineText += gap > GAP_TAB_THRESHOLD ? "\t" : " ";
        lineText += p.str;
        prevX = p.x;
      }

      // normaliza sem destruir tabs (usadas como separador de colunas)
      lineText = lineText
        .replace(/\t+/g, "\t")
        .replace(/[ ]{2,}/g, " ")
        .trim();

      if (lineText) lines.push(lineText);
      currentLine = [];
    };

    for (const it of rawItems) {
      if (currentY === null) {
        currentY = it.y;
        currentLine.push({ str: it.str, x: it.x });
        continue;
      }

      if (Math.abs(it.y - currentY) <= LINE_Y_THRESHOLD) {
        currentLine.push({ str: it.str, x: it.x });
      } else {
        flush();
        currentY = it.y;
        currentLine.push({ str: it.str, x: it.x });
      }
    }

    flush();

    try {
      await (page as any).cleanup?.();
    } catch {
      // ignore
    }

    pages.push(lines.join("\n"));
  }

  try {
    await (pdf as any).destroy?.();
  } catch {
    // ignore
  }

  return pages.join("\n\n");
}
