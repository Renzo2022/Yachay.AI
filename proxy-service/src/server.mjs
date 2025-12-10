import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import Groq from "groq-sdk";
import { jsonrepair } from "jsonrepair";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "models/gemini-1.0-pro";

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const ensureGroq = () => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY env var");
  }
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
};

const ensureGoogleKey = () => {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error("Missing GOOGLE_API_KEY env var");
  }
  return process.env.GOOGLE_API_KEY;
};

const cleanJson = (content = "") =>
  content.replace(/```json/gi, "").replace(/```/g, "").trim();

const parseJsonSafe = (content = "") => {
  const cleaned = cleanJson(content);
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    return JSON.parse(jsonrepair(cleaned));
  }
};

const ensureJsonObject = (payload) => {
  if (!payload) {
    throw new Error("Empty Groq response");
  }
  if (typeof payload === "string") {
    return parseJsonSafe(payload);
  }
  if (typeof payload === "object") {
    return payload;
  }
  throw new Error("Unsupported Groq response type");
};

const extractErrorDetails = (error) => {
  if (error?.response?.data) {
    return error.response.data;
  }
  if (error?.response?.statusText) {
    return error.response.statusText;
  }
  if (error?.message) {
    return error.message;
  }
  return "Unknown Groq error";
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const normalizeDecision = (label = "") => {
  const value = label.toLowerCase();
  if (value.includes("inclu")) return "include";
  if (value.includes("exclu")) return "exclude";
  return "uncertain";
};

const extractJsonArray = (text = "") => {
  if (!text) return null;
  const fenced = text.match(/```json([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(jsonrepair(raw));
    } catch {
      return null;
    }
  }
};

const buildGeminiPrompt = (criteria = {}, articles = []) => {
  const inclusion =
    Array.isArray(criteria.inclusionCriteria) && criteria.inclusionCriteria.length
      ? criteria.inclusionCriteria.map((entry) => `- ${entry}`).join("\n")
      : "- Sin criterios proporcionados";
  const exclusion =
    Array.isArray(criteria.exclusionCriteria) && criteria.exclusionCriteria.length
      ? criteria.exclusionCriteria.map((entry) => `- ${entry}`).join("\n")
      : "- Sin criterios proporcionados";
  const question = criteria.mainQuestion || "Pregunta no especificada";
  const payload = articles.map((article) => ({
    id: article.id,
    titulo: article.title ?? "",
    resumen: article.abstract ?? "",
  }));

  return `Eres un asistente experto en revisiones sistemáticas. Clasifica cada artículo según la pregunta y los criterios dados.

Pregunta principal:
${question}

Criterios de inclusión:
${inclusion}

Criterios de exclusión:
${exclusion}

Debes responder EXCLUSIVAMENTE en JSON válido con este formato:
[
  {
    "id": "ID_DEL_ARTICULO",
    "classification": "INCLUIR|EXCLUIR|DUDA",
    "justification": "Razón corta citando criterios",
    "subtopic": "Subtema sugerido"
  }
]

Artículos a clasificar:
${JSON.stringify(payload, null, 2)}
`;
};

app.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

app.post("/groq/protocol", async (req, res) => {
  const topic = req.body?.topic;
  if (!topic) {
    res.status(400).json({ error: "Missing topic" });
    return;
  }

  try {
    const groq = ensureGroq();
    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.2,
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content:
            "Eres un metodólogo PRISMA 2020. Devuelve exclusivamente JSON válido y completo para cada sección solicitada.",
        },
        {
          role: "user",
          content: `Genera un protocolo para "${topic}" siguiendo este esquema (exactamente 5 subpreguntas, cada texto detallado y específico):
{
  "mainQuestion": "",
  "pico": {
    "population": "",
    "intervention": "",
    "comparison": "",
    "outcome": ""
  },
  "subquestions": [
    "Subpregunta 1 enfocada al tema",
    "Subpregunta 2 coherente con PICO",
    "Subpregunta 3",
    "Subpregunta 4",
    "Subpregunta 5"
  ],
  "objectives": "Describe objetivos específicos, métricas y contexto (min. 2 oraciones).",
  "coherenceAnalysis": "Explica cómo la pregunta principal, las subpreguntas y PICO se alinean metodológicamente (min. 3 oraciones).",
  "methodologicalJustification": "Describe por qué se usa PICO y cómo asegura comparabilidad y reproducibilidad (min. 3 oraciones).",
  "inclusionCriteria": [],
  "exclusionCriteria": []
}`,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    const parsed = ensureJsonObject(content);
    res.json({ topic, protocol: parsed, generatedAt: Date.now() });
  } catch (error) {
    const details = extractErrorDetails(error);
    console.error("/groq/protocol", details);
    res.status(500).json({ error: "Groq protocol generation failed", details });
  }
});

app.post("/groq/extraction", async (req, res) => {
  const pdfText = req.body?.pdfText;
  if (!pdfText) {
    res.status(400).json({ error: "Missing pdfText" });
    return;
  }

  try {
    const groq = ensureGroq();
    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.1,
      max_tokens: 1536,
      messages: [
        {
          role: "system",
          content: "Eres un especialista en extracción de datos. Responde sólo JSON válido.",
        },
        {
          role: "user",
          content: `Resume el siguiente texto con este esquema:
{
  "sample": {"size": number, "description": string},
  "methodology": {"design": string, "duration": string},
  "intervention": {"description": string, "tools": string[]},
  "outcomes": {"primary": string, "results": string},
  "limitations": string[]
}

Texto:
${pdfText.slice(0, 12000)}`,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    res.json(ensureJsonObject(content));
  } catch (error) {
    const details = extractErrorDetails(error);
    console.error("/groq/extraction", details);
    res.status(500).json({ error: "Groq extraction failed", details });
  }
});

app.post("/groq/narrative", async (req, res) => {
  const { themes, stats } = req.body ?? {};
  if (!themes || !stats) {
    res.status(400).json({ error: "Missing payload" });
    return;
  }

  try {
    const groq = ensureGroq();
    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.3,
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: "Eres un científico de datos que redacta síntesis narrativas concisas (máx 3 párrafos).",
        },
        {
          role: "user",
          content: `Temas:
${JSON.stringify(themes)}

Estadísticas:
${JSON.stringify(stats)}

Escribe una narrativa cohesiva en español neutro.`,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty Groq response" );
    }

    res.json({ narrative: content.trim() });
  } catch (error) {
    console.error("/groq/narrative", error);
    res.status(500).json({ error: "Groq narrative failed" });
  }
});

app.post("/groq/manuscript", async (req, res) => {
  const { projectId, aggregated } = req.body ?? {};
  if (!projectId || !aggregated) {
    res.status(400).json({ error: "Missing project data" });
    return;
  }

  try {
    const groq = ensureGroq();
    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.15,
      max_tokens: 3072,
      messages: [
        {
          role: "system",
          content:
            "Eres un redactor científico PRISMA 2020. Responde en JSON válido con {abstract,introduction,methods,results,discussion,conclusions,references[]} (máx 6 referencias).",
        },
        {
          role: "user",
          content: `Genera el manuscrito para:
${JSON.stringify(aggregated, null, 2)}`,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty Groq response");
    }

    const manuscript = parseJsonSafe(content);
    res.json({ ...manuscript, generatedAt: Date.now(), projectId });
  } catch (error) {
    console.error("/groq/manuscript", error);
    res.status(500).json({ error: "Groq manuscript failed" });
  }
});

app.post("/groq/search-strategy", async (req, res) => {
  const { topic, phase1, sources, step, keywordMatrix } = req.body ?? {};
  if (!topic || !phase1) {
    res.status(400).json({ error: "Missing topic or phase1 data" });
    return;
  }

  const normalizedStep = ["derivation", "subquestions"].includes(step) ? step : "full";
  const sourcesList = Array.isArray(sources) && sources.length ? sources.join(", ") : "PubMed, Semantic Scholar, CrossRef y Europe PMC";

  const baseSystemPrompt =
    "Eres un documentalista experto en búsquedas federadas (PubMed, Semantic Scholar, CrossRef, Europe PMC). Mantén un estilo altamente estructurado y responde únicamente en JSON válido.";

  let systemContent = baseSystemPrompt;
  let userContent = "";

  if (normalizedStep === "derivation") {
    systemContent +=
      " Devuelve solo {question, keywordMatrix}. question DEBE estar redactada en español. keywordMatrix debe incluir exactamente las 4 entradas PICO con campos {component, concept, terms[]} y al menos 4 términos por componente. El campo concept debe ser un enunciado breve en español que resuma el foco del componente (no repitas literalmente el nombre del componente ni lo dejes en inglés). Los términos deben mantenerse en inglés para maximizar la compatibilidad con las bases.";
    userContent = `Tema: "${topic}"
Fuentes seleccionadas: ${sourcesList}
Protocolo Fase 1:
${JSON.stringify(phase1, null, 2)}

Objetivo del paso 1:
1. Redacta question alineada a la pregunta principal de la fase 1, siempre en español (puedes reformularla).
2. Construye keywordMatrix derivando términos SINÓNIMOS y controlados para cada componente PICO (P, I, C, O) usando solo inglés, y redacta concept como un concepto central en español derivado de cada componente.
3. Evita generar subpreguntas, keywords adicionales o recomendaciones en este paso.`;
  } else if (normalizedStep === "subquestions") {
    const matrixReference = Array.isArray(keywordMatrix) ? JSON.stringify(keywordMatrix, null, 2) : "[]";
    systemContent +=
      " Devuelve solo {question, subquestionStrategies, recommendations}. question y cada subpregunta deben estar redactadas en español. Para cada subpregunta genera keywords en inglés y databaseStrategies específicos para PubMed, Semantic Scholar, CrossRef y Europe PMC con el formato {database, query}. Las cadenas deben ser booleanas completas y adaptadas a la sintaxis de cada base; no te limites a repetir un solo término ni dejes bases sin cubrir. No incluyas filtros ni campos adicionales en databaseStrategies. recommendations debe ser una lista accionable en español.";
    userContent = `Tema: "${topic}"
Fuentes seleccionadas: ${sourcesList}
Derivación confirmada (keywordMatrix):
${matrixReference}
Protocolo Fase 1:
${JSON.stringify(phase1, null, 2)}

Objetivo del paso 2:
1. Con base en la derivación anterior, genera EXACTAMENTE 5 subpreguntas estratégicas en español.
2. Para cada subpregunta define al menos 3 keywords en inglés y construye databaseStrategies con cadenas booleanas específicas para cada fuente (PubMed, Semantic Scholar, CrossRef, Europe PMC) en el formato {database, query}. No generes filtros ni estimaciones; enfócate únicamente en la cadena de búsqueda y asegúrate de cubrir las cuatro bases.
3. Incluye recomendaciones finales en español sobre cómo ajustar o refinar la búsqueda.
4. No repitas keywordMatrix en este paso.`;
  } else {
    systemContent +=
      " Devuelve {question, keywordMatrix, subquestionStrategies, recommendations}. question y subquestionStrategies deben estar en español. keywordMatrix debe traer objetos {component:'P'|'I'|'C'|'O', concept, terms[]} (mínimo 4 términos cada uno) y TODOS los términos deben estar en inglés. subquestionStrategies debe contener EXACTAMENTE 5 elementos, cada uno con {subquestion, keywords[], databaseStrategies[]}. Cada databaseStrategies[] interno incluye objetos {database, query} para las cuatro bases mencionadas, personalizadas a esa subpregunta. recommendations es un arreglo de strings accionables en español.";
    userContent = `Tema: "${topic}"
Fuentes seleccionadas: ${sourcesList}
Protocolo Fase 1:
${JSON.stringify(phase1, null, 2)}

Instrucciones:
1. Define question con la pregunta principal resultante (o reformulada si falta).
2. keywordMatrix debe integrar términos y sinónimos derivados de cada componente PICO y de las subpreguntas.
3. Genera exactamente 5 subpreguntas derivadas en español. Para cada subpregunta construye subquestionStrategies[i] con: subquestion (en español), keywords específicos (al menos 3 en inglés) y databaseStrategies con objetos {database, query} para PubMed, Semantic Scholar, CrossRef y Europe PMC. No incluyas filtros ni estimaciones.
4. recommendations debe justificar la cobertura semántica, comparación explícita, refinamientos sugeridos y consideraciones de reproducibilidad, todo EN ESPAÑOL.
5. Asegúrate de que los campos "terms", "keywords" y cada "query" estén totalmente en inglés para maximizar la compatibilidad con las bases.`;
  }

  try {
    const groq = ensureGroq();
    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.15,
      max_tokens: 2048,
      messages: [
        {
          role: "system",
          content: systemContent,
        },
        {
          role: "user",
          content: userContent,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    res.json(ensureJsonObject(content));
  } catch (error) {
    const details = extractErrorDetails(error);
    console.error("/groq/search-strategy", details);
    res.status(500).json({ error: "Groq search strategy failed", details });
  }
});

app.post("/gemini/classify", async (req, res) => {
  const { criteria, articles } = req.body ?? {};
  if (!criteria || !Array.isArray(articles) || articles.length === 0) {
    res.status(400).json({ error: "Missing criteria or articles" });
    return;
  }

  try {
    const apiKey = ensureGoogleKey();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const batches = chunkArray(articles, 10);
    const aggregated = [];

    for (const batch of batches) {
      const prompt = buildGeminiPrompt(criteria, batch);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${text}`);
      }

      const data = await response.json();
      const text =
        data?.candidates
          ?.map((candidate) => candidate?.content?.parts?.map((part) => part?.text ?? "").join("\n"))
          .filter(Boolean)
          .join("\n") ?? "";
      const parsed = extractJsonArray(text);
      if (!Array.isArray(parsed)) {
        throw new Error("Gemini devolvió un formato inesperado.");
      }

      parsed.forEach((entry) => {
        const cast = entry ?? {};
        if (!cast?.id || !cast?.classification) {
          return;
        }
        aggregated.push({
          id: cast.id,
          decision: normalizeDecision(cast.classification),
          justification: cast.justification || "Sin justificación proporcionada.",
          subtopic: cast.subtopic,
        });
      });
    }

    res.json({ results: aggregated });
  } catch (error) {
    console.error("/gemini/classify", error);
    res.status(500).json({
      error: "Gemini classification failed",
      details: error?.message ?? "Unknown Gemini error",
    });
  }
});

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed: ${response.status} ${text}`);
  }
  return response.json();
};

app.get("/pubmed/search", async (req, res) => {
  const query = req.query.q?.toString();
  const limit = Number(req.query.limit ?? 10);
  if (!query) {
    res.status(400).json({ error: "Missing q parameter" });
    return;
  }

  try {
    const params = new URLSearchParams({
      db: "pubmed",
      term: query,
      retmode: "json",
      retmax: String(limit),
    });
    if (process.env.PUBMED_API_KEY) {
      params.set("api_key", process.env.PUBMED_API_KEY);
    }

    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${params.toString()}`;
    const searchJson = await fetchJson(searchUrl);
    const idList = searchJson?.esearchresult?.idlist ?? [];

    if (idList.length === 0) {
      res.json({ items: [] });
      return;
    }

    const summaryParams = new URLSearchParams({
      db: "pubmed",
      id: idList.join(","),
      retmode: "json",
    });

    if (process.env.PUBMED_API_KEY) {
      summaryParams.set("api_key", process.env.PUBMED_API_KEY);
    }

    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${summaryParams.toString()}`;
    const summaryJson = await fetchJson(summaryUrl);
    const summaries = summaryJson?.result ?? {};

    const items = idList.map((id) => {
      const entry = summaries[id] ?? {};
      return {
        id,
        source: "pubmed",
        title: entry.title,
        authors: entry.authors?.map((a) => a.name) ?? [],
        year: Number(entry.pubdate?.slice(0, 4)) || null,
        doi: entry.elocationid,
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        isOpenAccess: Boolean(entry.classes?.includes("Free")),
        citationCount: entry.pmid ? Number(entry.pmid) : undefined,
      };
    });

    res.json({ items });
  } catch (error) {
    console.error("/pubmed/search", error);
    res.status(500).json({ error: "PubMed request failed" });
  }
});

app.get("/semantic-scholar/search", async (req, res) => {
  const query = req.query.q?.toString();
  const limit = Number(req.query.limit ?? 10);
  if (!query) {
    res.status(400).json({ error: "Missing q parameter" });
    return;
  }

  try {
    const url = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
    url.searchParams.set("query", query);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("fields", "title,abstract,year,authors,url,isOpenAccess,citationCount,externalIds");

    const response = await fetch(url, {
      headers: process.env.SEMANTIC_SCHOLAR_API_KEY
        ? { "x-api-key": process.env.SEMANTIC_SCHOLAR_API_KEY }
        : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Semantic Scholar error: ${response.status} ${text}`);
    }

    const data = await response.json();
    const items = (data.data ?? []).map((paper) => ({
      id: paper.paperId,
      source: "semantic_scholar",
      title: paper.title,
      authors: paper.authors?.map((a) => a.name) ?? [],
      year: paper.year ?? null,
      abstract: paper.abstract ?? "",
      doi: paper.externalIds?.DOI ?? null,
      url: paper.url,
      isOpenAccess: Boolean(paper.isOpenAccess),
      citationCount: paper.citationCount,
    }));

    res.json({ items });
  } catch (error) {
    console.error("/semantic-scholar/search", error);
    res.status(500).json({ error: "Semantic Scholar request failed" });
  }
});

app.get("/crossref/search", async (req, res) => {
  const query = req.query.q?.toString();
  const rows = Number(req.query.rows ?? 20);
  if (!query) {
    res.status(400).json({ error: "Missing q parameter" });
    return;
  }

  try {
    const url = `https://api.crossref.org/works?${new URLSearchParams({ query, rows: String(rows) }).toString()}`;
    const data = await fetchJson(url);
    const items = (data.message?.items ?? []).map((item) => ({
      id: item.DOI ?? item.URL,
      source: "crossref",
      title: item.title?.[0] ?? "",
      authors: item.author?.map((a) => `${a.given ?? ""} ${a.family ?? ""}`.trim()).filter(Boolean) ?? [],
      year: item.issued?.["date-parts"]?.[0]?.[0] ?? null,
      abstract: item.abstract ? item.abstract.replace(/<[^>]+>/g, "") : "",
      doi: item.DOI ?? null,
      url: item.URL,
      isOpenAccess: Boolean(item.license?.length),
      citationCount: item["is-referenced-by-count"],
    }));

    res.json({ items });
  } catch (error) {
    console.error("/crossref/search", error);
    res.status(500).json({ error: "CrossRef request failed" });
  }
});

app.get("/europe-pmc/search", async (req, res) => {
  const query = req.query.q?.toString();
  const pageSize = Number(req.query.pageSize ?? 25);
  if (!query) {
    res.status(400).json({ error: "Missing q parameter" });
    return;
  }

  try {
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?${new URLSearchParams({
      query,
      format: "json",
      pageSize: String(pageSize),
    }).toString()}`;

    const data = await fetchJson(url);
    const items = (data.resultList?.result ?? []).map((item) => ({
      id: item.id,
      source: "europe_pmc",
      title: item.title,
      authors: item.authorString?.split(", ") ?? [],
      year: Number(item.pubYear) || null,
      abstract: item.abstractText ?? "",
      doi: item.doi ?? null,
      url: item.fullTextUrlList?.fullTextUrl?.[0]?.url ?? item.uri,
      isOpenAccess: item.isOpenAccess === "Y",
      citationCount: item.citedByCount,
    }));

    res.json({ items });
  } catch (error) {
    console.error("/europe-pmc/search", error);
    res.status(500).json({ error: "Europe PMC request failed" });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

app.listen(PORT, () => {
  console.log(`[proxy] listening on port ${PORT}`);
});
