import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import Groq from "groq-sdk";
import { CohereClient } from "cohere-ai";
import { jsonrepair } from "jsonrepair";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const COHERE_MODEL = process.env.COHERE_MODEL ?? "command-a-03-2025";

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const ensureGroq = () => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY env var");
  }
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
};

const ensureCohere = () => {
  if (!process.env.COHERE_API_KEY) {
    throw new Error("Missing COHERE_API_KEY env var");
  }
  return new CohereClient({ token: process.env.COHERE_API_KEY });
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

const findFirstArray = (payload) => {
  if (!payload) return null;
  if (Array.isArray(payload)) {
    return payload;
  }
  if (typeof payload === "object") {
    for (const value of Object.values(payload)) {
      const candidate = findFirstArray(value);
      if (candidate) return candidate;
    }
  }
  return null;
};

const COHERE_CLASSIFICATION_SCHEMA = {
  type: "json_object",
  schema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            classification: { type: "string", enum: ["INCLUIR", "EXCLUIR", "DUDA"] },
            justification: { type: "string" },
            subtopic: { type: "string" },
          },
          required: ["id", "classification", "justification"],
          additionalProperties: false,
        },
      },
    },
    required: ["results"],
    additionalProperties: false,
  },
};

const COHERE_MANUSCRIPT_SCHEMA = {
  type: "json_object",
  schema: {
    type: "object",
    properties: {
      abstract: { type: "string" },
      introduction: { type: "string" },
      methods: { type: "string" },
      results: { type: "string" },
      discussion: { type: "string" },
      conclusions: { type: "string" },
    },
    required: ["abstract", "introduction", "methods", "results", "discussion", "conclusions"],
    additionalProperties: false,
  },
};

const COHERE_SYNTHESIS_SCHEMA = {
  type: "json_object",
  schema: {
    type: "object",
    properties: {
      themes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            theme: { type: "string" },
            subtheme: { type: "string" },
            studyCount: { type: "number" },
            example: { type: "string" },
            relatedStudies: { type: "array", items: { type: "string" } },
          },
          required: ["theme", "subtheme", "studyCount", "example", "relatedStudies"],
          additionalProperties: false,
        },
      },
      divergences: { type: "array", items: { type: "string" } },
      gaps: { type: "array", items: { type: "string" } },
      narrative: { type: "string" },
    },
    required: ["themes", "divergences", "gaps", "narrative"],
    additionalProperties: false,
  },
};

const COHERE_EXTRACTION_SCHEMA = {
  type: "json_object",
  schema: {
    type: "object",
    properties: {
      evidence: {
        type: "array",
        items: {
          type: "object",
          properties: {
            variable: { type: "string" },
            extracted: { type: "string" },
            quote: { type: "string" },
            page: { type: "number" },
          },
          required: ["variable", "extracted", "quote"],
          additionalProperties: false,
        },
      },
      variables: { type: "array", items: { type: "string" } },
      sample: {
        type: "object",
        properties: {
          size: { type: "number" },
          description: { type: "string" },
        },
        required: ["size", "description"],
        additionalProperties: false,
      },
      methodology: {
        type: "object",
        properties: {
          design: { type: "string" },
          duration: { type: "string" },
        },
        required: ["design", "duration"],
        additionalProperties: false,
      },
      intervention: {
        type: "object",
        properties: {
          description: { type: "string" },
          tools: { type: "array", items: { type: "string" } },
        },
        required: ["description", "tools"],
        additionalProperties: false,
      },
      outcomes: {
        type: "object",
        properties: {
          primary: { type: "string" },
          results: { type: "string" },
        },
        required: ["primary", "results"],
        additionalProperties: false,
      },
      conclusions: { type: "string" },
      limitations: { type: "array", items: { type: "string" } },
      context: {
        type: "object",
        properties: {
          year: { type: "number" },
          country: { type: "string" },
        },
        required: ["country"],
        additionalProperties: false,
      },
      effect: {
        type: "object",
        properties: {
          value: { type: "number" },
          lower: { type: "number" },
          upper: { type: "number" },
        },
        required: ["value", "lower", "upper"],
        additionalProperties: false,
      },
    },
    required: ["evidence", "variables", "sample", "methodology", "intervention", "outcomes", "conclusions", "limitations"],
    additionalProperties: false,
  },
};

const QUALITY_QUESTION_BANK = {
  CASP: [
    "¿La pregunta de investigación está claramente definida?",
    "¿El diseño metodológico es apropiado para la pregunta?",
    "¿La selección de participantes minimiza sesgos?",
    "¿Las variables fueron medidas con precisión?",
    "¿Se controlaron factores de confusión clave?",
    "¿Los resultados son consistentes y aplicables?",
    "¿Se evaluaron adecuadamente los riesgos/beneficios?",
    "¿Las conclusiones están justificadas por los datos?",
  ],
  AMSTAR: [
    "¿La pregunta de investigación está claramente definida?",
    "¿El protocolo fue establecido antes del estudio?",
    "¿La estrategia de búsqueda fue adecuada y reproducible?",
    "¿La selección y extracción de estudios se hizo por duplicado?",
    "¿Se evaluó el riesgo de sesgo de los estudios incluidos?",
    "¿Se consideró el riesgo de sesgo al interpretar resultados?",
    "¿Se evaluó la heterogeneidad y se explicó adecuadamente?",
    "¿Se evaluó sesgo de publicación cuando fue pertinente?",
    "¿Se declararon conflictos de interés y fuentes de financiamiento?",
  ],
  STROBE: [
    "¿El diseño del estudio está claramente descrito?",
    "¿La población y el contexto están claramente definidos?",
    "¿Las variables de exposición y resultado están definidas?",
    "¿Se describen métodos para minimizar sesgos?",
    "¿El tamaño muestral está justificado?",
    "¿Los métodos estadísticos son apropiados?",
    "¿Se reportan los resultados principales con precisión?",
    "¿Se discuten limitaciones del estudio?",
    "¿Las conclusiones están sustentadas por los datos?",
  ],
};

const COHERE_QUALITY_SCHEMA = {
  type: "json_object",
  schema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            studyId: { type: "string" },
            studyType: {
              type: "string",
              enum: [
                "RCT",
                "Quasi-experimental",
                "Observational",
                "Cohort",
                "Case-control",
                "Cross-sectional",
                "Qualitative",
                "Systematic Review",
              ],
            },
            checklistType: { type: "string", enum: ["CASP", "AMSTAR", "STROBE"] },
            criteria: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  answer: { type: "string", enum: ["Yes", "Partial", "No"] },
                  evidence: { type: "string" },
                  justification: { type: "string" },
                },
                required: ["id", "answer"],
                additionalProperties: false,
              },
            },
          },
          required: ["studyId", "studyType", "checklistType", "criteria"],
          additionalProperties: false,
        },
      },
    },
    required: ["results"],
    additionalProperties: false,
  },
};

const buildClassificationPrompt = (criteria = {}, articles = []) => {
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

Debes responder EXCLUSIVAMENTE en JSON válido que cumpla con este esquema:
{
  "results": [
    {
      "id": "ID_DEL_ARTICULO",
      "classification": "INCLUIR|EXCLUIR|DUDA",
      "justification": "Razón corta citando criterios",
      "subtopic": "Subtema sugerido"
    }
  ]
}

AArtículos a clasificar:
${JSON.stringify(payload, null, 2)}
`;
};

app.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

app.get("/unpaywall/resolve", async (req, res) => {
  const doi = req.query.doi?.toString();
  const email = (process.env.UNPAYWALL_EMAIL ?? req.query.email?.toString() ?? "").trim();
  if (!doi) {
    res.status(400).json({ error: "Missing doi" });
    return;
  }
  if (!email) {
    res.status(400).json({ error: "Missing UNPAYWALL_EMAIL env var" });
    return;
  }

  try {
    const url = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(email)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "yachay-ai-proxy (mailto:" + email + ")",
      },
    });
    if (!response.ok) {
      const text = await response.text();
      res.status(response.status).json({ error: "Unpaywall request failed", details: text });
      return;
    }
    const payload = await response.json();

    const best = payload?.best_oa_location;
    const locations = Array.isArray(payload?.oa_locations) ? payload.oa_locations : [];
    const pdfUrl =
      best?.url_for_pdf ??
      locations.find((entry) => typeof entry?.url_for_pdf === "string")?.url_for_pdf ??
      null;

    res.json({
      doi,
      isOa: Boolean(payload?.is_oa),
      pdfUrl,
      landingUrl: best?.url ?? payload?.best_oa_location?.url ?? null,
    });
  } catch (error) {
    console.error("/unpaywall/resolve", error);
    res.status(500).json({ error: "Unpaywall resolve failed" });
  }
});

const handleCohereManuscript = async (req, res) => {
  const { projectId, aggregated } = req.body ?? {};
  if (!projectId || !aggregated) {
    res.status(400).json({ error: "Missing project data" });
    return;
  }

  try {
    const cohere = ensureCohere();

    const includedStudies = Array.isArray(aggregated?.includedStudies) ? aggregated.includedStudies : [];
    const extractionMatrix = Array.isArray(aggregated?.extractionMatrix) ? aggregated.extractionMatrix : [];
    const synthesis = aggregated?.synthesis ?? {};
    const prisma = aggregated?.prisma ?? {};
    const phase1 = aggregated?.phase1 ?? {};

    const matrixMap = new Map(
      extractionMatrix
        .filter((entry) => entry && typeof entry.studyId === "string")
        .map((entry) => [entry.studyId, entry]),
    );

    const compactIncluded = includedStudies.slice(0, 60).map((study) => {
      const entry = matrixMap.get(String(study?.id ?? ""));
      const evidence = Array.isArray(entry?.evidence) ? entry.evidence.slice(0, 4) : [];
      return {
        id: String(study?.id ?? ""),
        title: String(study?.title ?? "").slice(0, 240),
        year: study?.year,
        authors: Array.isArray(study?.authors) ? study.authors.slice(0, 8) : [],
        doi: String(study?.doi ?? "").slice(0, 80),
        url: String(study?.url ?? "").slice(0, 320),
        studyType: String(study?.studyType ?? "").slice(0, 80),
        qualityLevel: String(study?.qualityLevel ?? "").slice(0, 40),
        country: String(entry?.context?.country ?? "").slice(0, 80),
        variables: Array.isArray(entry?.variables) ? entry.variables.slice(0, 12) : [],
        results: String(entry?.outcomes?.results ?? entry?.outcomes?.primary ?? "").slice(0, 900),
        conclusions: String(entry?.conclusions ?? "").slice(0, 900),
        evidence: evidence.map((row) => ({
          variable: String(row?.variable ?? "").slice(0, 120),
          extracted: String(row?.extracted ?? "").slice(0, 180),
          quote: String(row?.quote ?? "").slice(0, 260),
          page: row?.page,
        })),
      };
    });

    const compactPayload = {
      phase1: {
        mainQuestion: phase1?.mainQuestion,
        inclusionCriteria: phase1?.inclusionCriteria,
        exclusionCriteria: phase1?.exclusionCriteria,
        pico: phase1?.pico,
      },
      prisma,
      includedStudies: compactIncluded,
      synthesis: {
        narrative: synthesis?.narrative ?? "",
        themes: Array.isArray(synthesis?.themes) ? synthesis.themes.slice(0, 12) : [],
        divergences: Array.isArray(synthesis?.divergences) ? synthesis.divergences.slice(0, 8) : [],
        gaps: Array.isArray(synthesis?.gaps) ? synthesis.gaps.slice(0, 8) : [],
      },
    };

    const prompt = `Eres un redactor científico experto en PRISMA 2020.

Debes redactar un manuscrito académico en español neutro usando EXCLUSIVAMENTE los datos entregados.

Devuelve EXCLUSIVAMENTE JSON válido con el esquema EXACTO:
{abstract,introduction,methods,results,discussion,conclusions}

Reglas:
- No inventes datos, números, resultados ni referencias.
- Mantén estilo formal y coherente.
- Citas APA en el texto: cuando afirmes un hallazgo específico o compares resultados, agrega una cita en formato APA dentro del texto, por ejemplo (Apellido, 2021) o (Apellido et al., 2020). Usa SOLO autores/años presentes en includedStudies; si faltan autores usa un título abreviado + año.
- NO incluyas una lista de referencias dentro del JSON (las referencias se generan localmente).
- Abstract: 150–250 palabras.
- Introduction: 250–400 palabras.
- Methods: describe el proceso PRISMA, cribado, evaluación de calidad y extracción.
- Results: resume PRISMA, características y hallazgos. Menciona que:
  - Figura 1 corresponde al diagrama PRISMA.
  - Tabla 1 corresponde a la matriz comparativa (extracción).
  - Figura 2 corresponde a la distribución por año.
  - Figura 3 corresponde a la distribución por país.
  No crees una sección de anexos.
- Discussion: interpreta, limitaciones y implicaciones.
- Conclusions: 80–150 palabras.

Datos del proyecto (JSON):
${JSON.stringify(compactPayload)}`;

    const response = await cohere.chat({
      model: COHERE_MODEL,
      message: prompt,
      temperature: 0.2,
      response_format: COHERE_MANUSCRIPT_SCHEMA,
    });

    const contentParts = response?.message?.content ?? [];
    const jsonPart = contentParts.find((part) => part?.json);
    const textBlob =
      contentParts.map((part) => part?.text ?? "").join("\n").trim() ||
      response?.text ||
      response?.message?.content?.[0]?.text ||
      "";

    const payload =
      jsonPart?.json ??
      (() => {
        if (!textBlob) return null;
        try {
          return parseJsonSafe(textBlob);
        } catch {
          return null;
        }
      })();

    if (!payload || typeof payload !== "object") {
      console.error(
        "Cohere manuscript payload inválido",
        JSON.stringify({ payload, textBlob, sample: compactIncluded.slice(0, 1) }, null, 2),
      );
      throw new Error("Cohere devolvió un formato inesperado para manuscript.");
    }

    res.json({ ...payload, generatedAt: Date.now(), projectId });
  } catch (error) {
    console.error("/cohere/manuscript", error);
    res.status(500).json({
      error: "Cohere manuscript failed",
      details: error?.message ?? "Unknown Cohere error",
    });
  }
};

app.post("/cohere/manuscript", handleCohereManuscript);

app.post("/cohere/synthesis", async (req, res) => {
  const studies = req.body?.studies;
  if (!Array.isArray(studies) || studies.length === 0) {
    res.status(400).json({ error: "Missing studies" });
    return;
  }

  try {
    const cohere = ensureCohere();

    const compactStudies = studies.map((study) => {
      const evidence = Array.isArray(study?.evidence) ? study.evidence.slice(0, 6) : [];
      return {
        id: String(study?.id ?? ""),
        title: String(study?.title ?? "").slice(0, 220),
        year: study?.year,
        country: String(study?.country ?? "").slice(0, 80),
        studyType: String(study?.studyType ?? "").slice(0, 80),
        qualityLevel: String(study?.qualityLevel ?? "").slice(0, 40),
        variables: Array.isArray(study?.variables) ? study.variables.slice(0, 12) : [],
        results: String(study?.results ?? "").slice(0, 900),
        conclusions: String(study?.conclusions ?? "").slice(0, 900),
        evidence: evidence.map((row) => ({
          variable: String(row?.variable ?? "").slice(0, 120),
          extracted: String(row?.extracted ?? "").slice(0, 180),
          quote: String(row?.quote ?? "").slice(0, 260),
          page: row?.page,
        })),
      };
    });

    const allowedStudyIds = compactStudies
      .map((study) => study.id)
      .filter((id) => typeof id === "string" && id.trim())
      .slice(0, 100);

    const prompt = `Eres un investigador experto en síntesis y análisis de revisiones.

Recibirás una tabla de resultados (JSON) con datos extraídos de múltiples estudios.

Objetivo:
1) Identificar temas o categorías comunes.
2) Identificar convergencias y divergencias.
3) Detectar vacíos de evidencia.
4) Detectar patrones generales (por método, contexto o resultado).

Devuelve EXCLUSIVAMENTE JSON válido con el esquema EXACTO solicitado.

Reglas:
- themes: genera entre 5 y 12 filas si hay suficientes datos.
- theme y subtheme: concisos (máx. 6 palabras cada uno).
- relatedStudies: DEBE ser una lista de IDs EXACTOS tomados de la tabla de entrada.
- NO inventes estudios ni uses IDs no presentes.
- Si no puedes vincular un tema a ningún estudio, pon relatedStudies: [] y studyCount: 0.
- studyCount: DEBE ser exactamente igual a relatedStudies.length.
- example: frase breve apoyada por evidencia (si puedes, incluye una cita textual corta entre comillas).
- divergences: 2 a 8 ítems.
- gaps: 2 a 8 ítems.
- narrative: 200–300 palabras, español neutro, 1–2 párrafos.

IDs permitidos para relatedStudies (usa SOLO estos):
${JSON.stringify(allowedStudyIds)}

Tabla de resultados (JSON):
${JSON.stringify(compactStudies)}`;

    const response = await cohere.chat({
      model: COHERE_MODEL,
      message: prompt,
      temperature: 0.2,
      response_format: COHERE_SYNTHESIS_SCHEMA,
    });

    const contentParts = response?.message?.content ?? [];
    const jsonPart = contentParts.find((part) => part?.json);
    const textBlob =
      contentParts.map((part) => part?.text ?? "").join("\n").trim() ||
      response?.text ||
      response?.message?.content?.[0]?.text ||
      "";

    const payload =
      jsonPart?.json ??
      (() => {
        if (!textBlob) return null;
        try {
          return parseJsonSafe(textBlob);
        } catch {
          return null;
        }
      })();

    if (!payload || typeof payload !== "object") {
      console.error(
        "Cohere synthesis payload inválido",
        JSON.stringify({ payload, textBlob, sample: compactStudies.slice(0, 2) }, null, 2),
      );
      throw new Error("Cohere devolvió un formato inesperado para synthesis.");
    }

    res.json(payload);
  } catch (error) {
    console.error("/cohere/synthesis", error);
    res.status(500).json({
      error: "Cohere synthesis failed",
      details: error?.message ?? "Unknown Cohere error",
    });
  }
});

app.post("/cohere/extraction", async (req, res) => {
  const pdfText = req.body?.pdfText;
  if (!pdfText) {
    res.status(400).json({ error: "Missing pdfText" });
    return;
  }

  try {
    const cohere = ensureCohere();

    const prompt = `Extrae información del siguiente texto y responde con el esquema EXACTO indicado.

Debes devolver EXCLUSIVAMENTE JSON válido.

Reglas:
- evidence debe incluir al menos 3 filas si el texto lo permite.
- variables debe listar las variables principales evaluadas o reportadas (si aplica).
- quote debe ser una cita textual corta (máx. 240 caracteres).
- Si no encuentras un dato, usa string vacío o 0, pero mantén la estructura.

Texto:
${pdfText.slice(0, 12000)}`;

    const response = await cohere.chat({
      model: COHERE_MODEL,
      message: prompt,
      temperature: 0.1,
      response_format: COHERE_EXTRACTION_SCHEMA,
    });

    const contentParts = response?.message?.content ?? [];
    const jsonPart = contentParts.find((part) => part?.json);
    const textBlob =
      contentParts.map((part) => part?.text ?? "").join("\n").trim() ||
      response?.text ||
      response?.message?.content?.[0]?.text ||
      "";

    const payload =
      jsonPart?.json ??
      (() => {
        if (!textBlob) return null;
        try {
          return parseJsonSafe(textBlob);
        } catch {
          return null;
        }
      })();

    if (!payload || typeof payload !== "object") {
      console.error("Cohere extraction payload inválido", JSON.stringify({ payload, textBlob }, null, 2));
      throw new Error("Cohere devolvió un formato inesperado para extraction.");
    }

    res.json(payload);
  } catch (error) {
    console.error("/cohere/extraction", error);
    res.status(500).json({
      error: "Cohere extraction failed",
      details: error?.message ?? "Unknown Cohere error",
    });
  }
});

app.get("/pdf/proxy", async (req, res) => {
  const url = req.query.url?.toString();
  if (!url) {
    res.status(400).json({ error: "Missing url" });
    return;
  }
  if (!/^https?:\/\//i.test(url)) {
    res.status(400).json({ error: "Only http(s) URLs are allowed" });
    return;
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "yachay-ai-proxy",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(response.status).json({ error: "PDF fetch failed", details: text });
      return;
    }

    const lengthHeader = response.headers.get("content-length");
    if (lengthHeader) {
      const length = Number(lengthHeader);
      if (!Number.isNaN(length) && length > 25 * 1024 * 1024) {
        res.status(413).json({ error: "PDF too large" });
        return;
      }
    }

    const contentType = response.headers.get("content-type") ?? "application/pdf";
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(buffer);
  } catch (error) {
    console.error("/pdf/proxy", error);
    res.status(500).json({ error: "PDF proxy failed" });
  }
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
          content:
            "Eres un especialista en extracción de datos para revisiones sistemáticas. Responde SOLO JSON válido (sin markdown, sin texto extra).",
        },
        {
          role: "user",
          content: `Extrae información del siguiente texto y responde con este esquema EXACTO:
{
  "evidence": [
    {"variable": string, "extracted": string, "quote": string, "page"?: number}
  ],
  "variables": string[],
  "sample": {"size": number, "description": string},
  "methodology": {"design": string, "duration": string},
  "intervention": {"description": string, "tools": string[]},
  "outcomes": {"primary": string, "results": string},
  "conclusions": string,
  "limitations": string[],
  "context"?: {"year"?: number, "country"?: string},
  "effect"?: {"value": number, "lower": number, "upper": number}
}

Reglas:
- "evidence" debe incluir al menos 3 filas si el texto lo permite.
- "variables" debe listar las variables principales evaluadas o reportadas (si aplica).
- "quote" debe ser una cita textual corta (máx. 240 caracteres).
- Si no encuentras un dato, usa string vacío o 0, pero mantén la estructura.

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
  await handleCohereManuscript(req, res);
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

app.post("/cohere/classify", async (req, res) => {
  const { criteria, articles } = req.body ?? {};
  if (!criteria || !Array.isArray(articles) || articles.length === 0) {
    res.status(400).json({ error: "Missing criteria or articles" });
    return;
  }

  try {
    const cohere = ensureCohere();
    const batches = chunkArray(articles, 10);
    const aggregated = [];

    for (const batch of batches) {
      const prompt = buildClassificationPrompt(criteria, batch);
      const response = await cohere.chat({
        model: COHERE_MODEL,
        message: prompt,
        temperature: 0.2,
        response_format: COHERE_CLASSIFICATION_SCHEMA,
      });

      if (!response?.message?.content?.length) {
        console.error("Respuesta Cohere cruda", JSON.stringify(response, null, 2));
      }

      const contentParts = response?.message?.content ?? [];
      const jsonPart = contentParts.find((part) => part?.json);
      const textBlob =
        contentParts.map((part) => part?.text ?? "").join("\n").trim() ||
        response?.text ||
        response?.message?.content?.[0]?.text ||
        "";

      const coherePayload =
        jsonPart?.json ??
        (() => {
          if (!textBlob) return null;
          try {
            return parseJsonSafe(textBlob);
          } catch {
            return extractJsonArray(textBlob);
          }
        })();

      const parsed =
        (Array.isArray(coherePayload) && coherePayload) ||
        (Array.isArray(coherePayload?.results) && coherePayload.results) ||
        (Array.isArray(coherePayload?.output) && coherePayload.output) ||
        (Array.isArray(coherePayload?.data) && coherePayload.data) ||
        (Array.isArray(coherePayload?.items) && coherePayload.items) ||
        findFirstArray(coherePayload);

      if (!parsed) {
        console.error(
          "Cohere payload sin array interpretable",
          JSON.stringify({ payload: coherePayload, textBlob }, null, 2),
        );
        throw new Error("Cohere devolvió un formato inesperado.");
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
    console.error("/cohere/classify", error);
    res.status(500).json({
      error: "Cohere classification failed",
      details: error?.message ?? "Unknown Cohere error",
    });
  }
});

const buildQualityBatchPrompt = (studies = []) => {
  const normalizedStudies = studies.map((study) => ({
    studyId: study.id,
    title: (study.title ?? "").toString(),
    abstract: (study.abstract ?? "").toString(),
  }));

  const checklistPayload = {
    CASP: QUALITY_QUESTION_BANK.CASP.map((question, index) => ({
      id: `casp-${index + 1}`,
      question,
    })),
    AMSTAR: QUALITY_QUESTION_BANK.AMSTAR.map((question, index) => ({
      id: `amstar-${index + 1}`,
      question,
    })),
    STROBE: QUALITY_QUESTION_BANK.STROBE.map((question, index) => ({
      id: `strobe-${index + 1}`,
      question,
    })),
  };

  return `Eres un metodólogo experto en evaluación crítica de estudios.

Usa SOLO el título y el resumen. No inventes datos; si no hay evidencia suficiente, usa answer='Partial' o 'No' y explica.

Debes devolver EXCLUSIVAMENTE JSON válido siguiendo el esquema solicitado.

Reglas:
1) Elige studyType: RCT | Quasi-experimental | Observational | Cohort | Case-control | Cross-sectional | Qualitative | Systematic Review
2) Elige checklistType: CASP | AMSTAR | STROBE
   - Systematic Review => AMSTAR
   - Observational/Cohort/Case-control/Cross-sectional => STROBE
   - RCT/Quasi-experimental/Qualitative => CASP
3) criteria debe contener EXACTAMENTE los criterios del checklist elegido (ids incluidos abajo), en el mismo orden.
4) Para cada criterio: answer (Yes|Partial|No), evidence (cita textual breve), justification (breve explicación).

Checklists disponibles (con ids):
${JSON.stringify(checklistPayload, null, 2)}

Estudios a evaluar:
${JSON.stringify(normalizedStudies, null, 2)}
`;
};

app.post("/cohere/quality-batch", async (req, res) => {
  const { studies } = req.body ?? {};
  if (!Array.isArray(studies) || studies.length === 0) {
    res.status(400).json({ error: "Missing studies" });
    return;
  }

  try {
    const cohere = ensureCohere();
    const batches = chunkArray(studies, 4);
    const aggregated = [];

    for (const batch of batches) {
      const prompt = buildQualityBatchPrompt(batch);
      const response = await cohere.chat({
        model: COHERE_MODEL,
        message: prompt,
        temperature: 0.2,
        response_format: COHERE_QUALITY_SCHEMA,
      });

      const contentParts = response?.message?.content ?? [];
      const jsonPart = contentParts.find((part) => part?.json);
      const textBlob =
        contentParts.map((part) => part?.text ?? "").join("\n").trim() ||
        response?.text ||
        response?.message?.content?.[0]?.text ||
        "";

      const payload =
        jsonPart?.json ??
        (() => {
          if (!textBlob) return null;
          try {
            return parseJsonSafe(textBlob);
          } catch {
            return null;
          }
        })();

      const items =
        (Array.isArray(payload?.results) && payload.results) ||
        (Array.isArray(payload?.output) && payload.output) ||
        (Array.isArray(payload?.data) && payload.data) ||
        (Array.isArray(payload?.items) && payload.items) ||
        findFirstArray(payload);

      if (!items) {
        console.error("Cohere quality payload sin resultados", JSON.stringify({ payload, textBlob }, null, 2));
        throw new Error("Cohere devolvió un formato inesperado para quality-batch.");
      }

      items.forEach((entry) => {
        const cast = entry ?? {};
        if (!cast?.studyId || !cast?.checklistType || !cast?.studyType) {
          return;
        }
        aggregated.push({
          studyId: cast.studyId,
          studyType: cast.studyType,
          checklistType: cast.checklistType,
          criteria: Array.isArray(cast.criteria) ? cast.criteria : [],
        });
      });
    }

    res.json({ results: aggregated });
  } catch (error) {
    console.error("/cohere/quality-batch", error);
    res.status(500).json({
      error: "Cohere quality-batch failed",
      details: error?.message ?? "Unknown Cohere error",
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

app.get("/semantic-scholar/paper", async (req, res) => {
  const paperId = req.query.paperId?.toString();
  if (!paperId) {
    res.status(400).json({ error: "Missing paperId parameter" });
    return;
  }

  try {
    const url = new URL(`https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(paperId)}`);
    url.searchParams.set("fields", "title,url,isOpenAccess,externalIds,openAccessPdf");

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
    res.json({
      paperId,
      openAccessPdfUrl: data?.openAccessPdf?.url ?? null,
      doi: data?.externalIds?.DOI ?? null,
      url: data?.url ?? null,
      isOpenAccess: Boolean(data?.isOpenAccess),
    });
  } catch (error) {
    console.error("/semantic-scholar/paper", error);
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
