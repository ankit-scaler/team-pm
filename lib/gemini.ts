// Thin wrapper over the Gemini REST API (free tier). Reads GEMINI_API_KEY from
// the server env. If GEMINI_MODEL is set we use only that; otherwise we try a
// short list of free-tier models in order, falling through on quota/rate errors
// (some keys have limit:0 on a given model — the next one usually works).
const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-1.5-flash",
];

async function callModel(model: string, key: string, prompt: string, schema?: any) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const generationConfig: any = { temperature: 0.3, maxOutputTokens: 8192 };
  // 2.5 models "think" by default, which burns the output budget and can leak
  // reasoning into the reply. Turn it off so we get a clean, complete summary.
  if (model.includes("2.5")) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  // JSON mode: force a machine-parseable, well-structured response.
  if (schema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = schema;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig,
    }),
  });
  const json: any = await res.json().catch(() => null);
  return { status: res.status, json };
}

export async function geminiGenerate(
  prompt: string,
  opts?: { schema?: any }
): Promise<{ text?: string; error?: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { error: "AI summary isn't configured yet (GEMINI_API_KEY is missing on the server)." };

  const models = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : FALLBACK_MODELS;
  let lastError = "Gemini request failed.";

  try {
    for (const model of models) {
      const { status, json } = await callModel(model, key, prompt, opts?.schema);

      // Quota / rate / model-not-available for this key → try the next model.
      if (status === 429 || status === 404) {
        lastError = json?.error?.message || `Model ${model} unavailable on this key.`;
        continue;
      }
      if (status < 200 || status >= 300) {
        return { error: json?.error?.message || `Gemini request failed (${status}).` };
      }

      const blocked = json?.promptFeedback?.blockReason;
      if (blocked) return { error: `Gemini blocked the request (${blocked}).` };

      const text: string | undefined = json?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text ?? "")
        .join("")
        .trim();
      if (text) return { text };
      lastError = "Gemini returned an empty response.";
    }
    return { error: lastError };
  } catch (e: any) {
    return { error: e?.message ?? "Couldn't reach Gemini." };
  }
}
