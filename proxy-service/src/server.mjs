import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import Groq from "groq-sdk";
import { jsonrepair } from "jsonrepair";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.1-70b-versatile";

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const ensureGroq = () => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY env var");
  }
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
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
            "Eres un metodólogo experto en revisiones sistemáticas PRISMA. Responde únicamente en JSON válido.",
        },
        {
          role: "user",
          content: `Genera un protocolo para \\\"${topic}\\\" siguiendo este esquema:
{
  "mainQuestion": "",
  "pico": {
    "population": "",
    "intervention": "",
    "comparison": "",
    "outcome": ""
  },
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
