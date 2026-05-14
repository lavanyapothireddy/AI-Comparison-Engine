require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Groq = require("groq-sdk");

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Available models to compare
// NEW - replace with these active models
const AVAILABLE_MODELS = [
  { id: "llama-3.1-8b-instant",              name: "LLaMA 3.1 8B Instant"    },
  { id: "llama-3.3-70b-versatile",           name: "LLaMA 3.3 70B Versatile" },
  { id: "gemma2-9b-it",                      name: "Gemma 2 9B"               },
  { id: "qwen-qwq-32b",                      name: "Qwen QwQ 32B"             },
  { id: "deepseek-r1-distill-llama-70b",     name: "DeepSeek R1 70B"          },
  { id: "mistral-saba-24b",                  name: "Mistral Saba 24B"         },
];

// GET /models — return available model list
app.get("/models", (req, res) => {
  res.json(AVAILABLE_MODELS);
});

// POST /compare — run prompt against selected models
app.post("/compare", async (req, res) => {
  const { prompt, models, systemPrompt, temperature = 0.7, maxTokens = 1024 } = req.body;

  if (!prompt || !models || models.length === 0) {
    return res.status(400).json({ error: "prompt and models are required" });
  }

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  // Run all model calls in parallel
  const results = await Promise.allSettled(
    models.map(async (modelId) => {
      const start = Date.now();
      const completion = await groq.chat.completions.create({
        model: modelId,
        messages,
        temperature,
        max_tokens: maxTokens,
      });
      const elapsed = Date.now() - start;
      const choice = completion.choices[0];
      return {
        modelId,
        content: choice.message.content,
        finishReason: choice.finish_reason,
        usage: completion.usage,
        latencyMs: elapsed,
      };
    })
  );

  const response = results.map((r, i) => {
    if (r.status === "fulfilled") {
      return r.value;
    } else {
      return {
        modelId: models[i],
        error: r.reason?.message || "Unknown error",
      };
    }
  });

  res.json({ results: response });
});

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
