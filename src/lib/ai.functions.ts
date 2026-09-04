import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MODEL = "gemini-2.0-flash";

type Msg = { role: "system" | "user" | "assistant"; content: string };

async function callGateway(messages: Msg[], jsonMode = false) {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("AI is not configured");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
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

const SYSTEM = `You are the Capacity Connect learning assistant for India's Ministry of Earth Sciences (MoES).
You help officers and scientists learn oceanography, atmospheric science, seismology, remote sensing,
disaster risk management and data science. Be concise, factual and practical. Use plain language and
short markdown-free paragraphs or simple dashes for lists.`;

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().trim().min(1).max(4000),
            }),
          )
          .min(1)
          .max(20),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const content = await callGateway([{ role: "system", content: SYSTEM }, ...data.messages]);
    return { content };
  });

export const recommendCourses = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        interests: z.string().trim().max(500).default(""),
        completed: z.array(z.string().max(200)).max(50).default([]),
        catalog: z
          .array(z.object({ title: z.string().max(200), category: z.string().max(100) }))
          .max(50),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const prompt = `Learner interests: ${data.interests || "not stated"}.
Completed or enrolled programmes: ${data.completed.join(", ") || "none yet"}.
Available catalog: ${data.catalog.map((c) => `${c.title} (${c.category})`).join("; ")}.

Return strict JSON: {"recommendations":[{"title":"exact catalog title","reason":"one sentence"}],"gaps":["skill gap"],"roadmap":[{"step":"phase name","detail":"one sentence"}]}
Recommend at most 3 programmes, at most 4 gaps and at most 4 roadmap steps.`;

    const raw = await callGateway(
      [
        { role: "system", content: SYSTEM + " Always answer with valid JSON only." },
        { role: "user", content: prompt },
      ],
      true,
    );

    try {
      return JSON.parse(raw) as {
        recommendations: { title: string; reason: string }[];
        gaps: string[];
        roadmap: { step: string; detail: string }[];
      };
    } catch {
      return { recommendations: [], gaps: [], roadmap: [] };
    }
  });

export const generateQuiz = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        topic: z.string().trim().min(3).max(200),
        source: z.string().trim().max(8000).default(""),
        count: z.number().int().min(1).max(10).default(5),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const prompt = `Create ${data.count} multiple-choice questions on "${data.topic}".
${data.source ? `Base them on this source material:\n${data.source}` : ""}
Return strict JSON: {"questions":[{"prompt":"...","options":["a","b","c","d"],"correct_index":0,"explanation":"..."}]}`;

    const raw = await callGateway(
      [
        { role: "system", content: SYSTEM + " Always answer with valid JSON only." },
        { role: "user", content: prompt },
      ],
      true,
    );

    try {
      const parsed = JSON.parse(raw) as {
        questions: { prompt: string; options: string[]; correct_index: number; explanation: string }[];
      };
      return { questions: parsed.questions ?? [] };
    } catch {
      return { questions: [] };
    }
  });
