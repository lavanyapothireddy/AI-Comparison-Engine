require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Groq = require("groq-sdk");

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// GET /models — fetch live from Groq API (never goes stale)
app.get("/models", async (req, res) => {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    // Filter only active chat models (exclude audio/guard/tts models)
    const chatModels = data.data
      .filter(
  (m) =>
    m.active &&
    !m.id.includes("whisper") &&
    !m.id.includes("guard") &&
    !m.id.includes("tts") &&
    !m.id.includes("safeguard") &&
    !m.id.includes("prompt-guard") &&
    !m.id.includes("distil") &&
    !m.id.includes("canopylabs") &&
    !m.id.includes("orpheus") &&
    !m.id.includes("qwen")
)
      .map((m) => ({
        id: m.id,
        name: m.id
          .replace(/\//g, " › ")
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        contextWindow: m.context_window,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json(chatModels);
  } catch (e) {
    console.error("Failed to fetch models from Groq:", e.message);

    // Fallback hardcoded list if Groq API fails
    res.json([
      { id: "llama-3.1-8b-instant",                      name: "LLaMA 3.1 8B Instant"      },
      { id: "llama-3.3-70b-versatile",                   name: "LLaMA 3.3 70B Versatile"   },
      { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "LLaMA 4 Scout 17B"         },
      { id: "meta-llama/llama-4-maverick-17b-128e-instruct", name: "LLaMA 4 Maverick 17B"  },
      { id: "qwen/qwen-3-32b",                           name: "Qwen 3 32B"                },
      { id: "openai/gpt-oss-120b",                       name: "GPT OSS 120B"              },
    ]);
  }
});

// POST /compare — run prompt against selected models in parallel
app.post("/compare", async (req, res) => {
  const { prompt, models, temperature = 0.7, maxTokens = 1024 } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }
  if (!models || models.length === 0) {
    return res.status(400).json({ error: "at least one model is required" });
  }

  const messages = [{ role: "user", content: prompt }];

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

  // Map results — fulfilled = success, rejected = error
  const response = results.map((r, i) => {
    if (r.status === "fulfilled") {
      return r.value;
    } else {
      return {
        modelId: models[i],
        error: r.reason?.message || "Unknown error occurred",
      };
    }
  });

  res.json({ results: response });
});

// GET /health — health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
