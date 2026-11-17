// Supabase Edge Function: analizar-comida
// Recibe { imagen: <base64 JPEG sin prefijo>, modo: "comida" | "etiqueta" }
// y devuelve la estimación de calorías.
// Proveedor de IA (configura UNO como secreto en Supabase):
//   GEMINI_API_KEY    → Google Gemini (tiene nivel gratuito). Opcional: GEMINI_MODEL
//   ANTHROPIC_API_KEY → Claude (de pago).                      Opcional: ANTHROPIC_MODEL

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPT_COMIDA = `Eres un nutricionista experto. Analiza la foto de comida.
Identifica cada alimento visible, estima su porción y sus calorías, y suma el total.
Responde SOLO con JSON válido, sin texto adicional ni bloques de código, con esta forma exacta:
{"descripcion":"resumen breve en español (máx. 60 caracteres)","items":[{"nombre":"...","porcion":"ej. 150 g","calorias":0}],"calorias":0,"confianza":"baja|media|alta"}
Si no hay comida en la imagen responde:
{"descripcion":"Sin comida detectada","items":[],"calorias":0,"confianza":"baja"}`;

const PROMPT_ETIQUETA = `Lee la tabla de información nutricional del envase de la foto (etiqueta chilena u otra).
Usa la energía en kcal. Si la tabla trae valores por 100 g y por porción, usa los de la porción;
si solo trae por 100 g y el tamaño de porción, calcula por porción.
Responde SOLO con JSON válido, sin texto adicional ni bloques de código, con esta forma exacta:
{"producto":"nombre del producto si se ve, si no 'Snack'","porcion":"ej. 30 g","calorias_por_porcion":0,"porciones_envase":null,"calorias_envase":null}`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

async function conGemini(apiKey: string, imagen: string, prompt: string): Promise<string> {
  const modelo = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: "image/jpeg", data: imagen } }, { text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    }),
  });
  if (!r.ok) throw new Error(`Gemini respondió ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
}

async function conClaude(apiKey: string, imagen: string, prompt: string): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-5-5",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imagen } },
          { type: "text", text: prompt },
        ],
      }],
    }),
  });
  if (!r.ok) throw new Error(`Claude respondió ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";
}

// Comprueba que quien llama tenga una sesión iniciada en tu proyecto
async function usuarioValido(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? "";
  if (!auth.startsWith("Bearer ") || !apikey) return false;
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
    headers: { authorization: auth, apikey },
  });
  return r.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    if (!(await usuarioValido(req))) return json({ error: "Inicia sesión para usar la IA" }, 401);

    const gemini = Deno.env.get("GEMINI_API_KEY");
    const claude = Deno.env.get("ANTHROPIC_API_KEY");
    if (!gemini && !claude) return json({ error: "Falta el secreto GEMINI_API_KEY (o ANTHROPIC_API_KEY)" }, 500);

    const { imagen, modo } = await req.json();
    if (typeof imagen !== "string" || imagen.length < 100) return json({ error: "Imagen no recibida" }, 400);
    if (imagen.length > 6_000_000) return json({ error: "Imagen demasiado grande" }, 413);

    const prompt = modo === "etiqueta" ? PROMPT_ETIQUETA : PROMPT_COMIDA;
    const texto = gemini ? await conGemini(gemini, imagen, prompt) : await conClaude(claude!, imagen, prompt);

    const ini = texto.indexOf("{");
    const fin = texto.lastIndexOf("}");
    if (ini < 0 || fin < ini) return json({ error: "La IA no devolvió un resultado legible" }, 502);
    return json(JSON.parse(texto.slice(ini, fin + 1)));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
