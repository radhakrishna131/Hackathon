const GATEWAY = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
export const AI_MODEL = "gemini-2.5-flash";

export type Msg = { role: "system" | "user" | "assistant"; content: string };

/** Single shared Lovable AI Gateway client used by every AI feature in the app. */
export async function callGateway(messages: Msg[], jsonMode = false) {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("AI is not configured");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (res.status === 429) throw new Error("Rate limit reached. Please try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);

  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  return json.choices[0]?.message.content ?? "";
}
