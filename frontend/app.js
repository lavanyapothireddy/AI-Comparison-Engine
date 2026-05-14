// ← Change this to your deployed Render backend URL after deploy
const API_BASE = "https://ai-comparison-engine.onrender.com";

let selectedModels = new Set();

// Load models on page load
async function loadModels() {
  try {
    const res = await fetch(`${API_BASE}/models`);
    const models = await res.json();
    const container = document.getElementById("modelCheckboxes");
    container.innerHTML = "";

    models.forEach((m) => {
      const card = document.createElement("div");
      card.className = "model-card";
      card.dataset.id = m.id;
      card.innerHTML = `<div class="dot"></div>${m.name}`;
      card.onclick = () => toggleModel(m.id, card);
      container.appendChild(card);

      // Select first 2 by default
      if (selectedModels.size < 2) {
        toggleModel(m.id, card);
      }
    });
  } catch (e) {
    document.getElementById("modelCheckboxes").innerHTML =
      `<div style="color:#ef4444">Failed to load models. Check backend URL.</div>`;
  }
}

function toggleModel(id, card) {
  if (selectedModels.has(id)) {
    selectedModels.delete(id);
    card.classList.remove("selected");
  } else {
    selectedModels.add(id);
    card.classList.add("selected");
  }
}

// Slider live values
document.getElementById("temperature").addEventListener("input", (e) => {
  document.getElementById("tempVal").textContent = e.target.value;
});
document.getElementById("maxTokens").addEventListener("input", (e) => {
  document.getElementById("tokensVal").textContent = e.target.value;
});

async function runComparison() {
  const prompt = document.getElementById("userPrompt").value.trim();
  const systemPrompt = document.getElementById("systemPrompt").value.trim();
  const temperature = parseFloat(document.getElementById("temperature").value);
  const maxTokens = parseInt(document.getElementById("maxTokens").value);

  if (!prompt) return alert("Please enter a prompt.");
  if (selectedModels.size === 0) return alert("Please select at least one model.");

  const btn = document.getElementById("compareBtn");
  document.getElementById("btnText").classList.add("hidden");
  document.getElementById("btnLoader").classList.remove("hidden");
  btn.disabled = true;

  const startTime = Date.now();

  try {
    const res = await fetch(`${API_BASE}/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        systemPrompt,
        models: [...selectedModels],
        temperature,
        maxTokens,
      }),
    });

    const data = await res.json();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    renderResults(data.results, elapsed);
  } catch (e) {
    alert("Error connecting to backend: " + e.message);
  } finally {
    document.getElementById("btnText").classList.remove("hidden");
    document.getElementById("btnLoader").classList.add("hidden");
    btn.disabled = false;
  }
}

function renderResults(results, elapsed) {
  const section = document.getElementById("resultsSection");
  const grid = document.getElementById("resultsGrid");
  const meta = document.getElementById("resultsMeta");

  section.classList.remove("hidden");
  meta.textContent = `${results.length} models compared · ${elapsed}s total`;
  grid.innerHTML = "";

  results.forEach((r, i) => {
    const card = document.createElement("div");
    card.className = "result-card" + (r.error ? " error" : "");
    card.style.animationDelay = `${i * 0.08}s`;

    const modelLabel = r.modelId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    card.innerHTML = `
      <div class="result-card-header">
        <div class="model-name">${modelLabel}</div>
        ${r.latencyMs ? `<div class="latency-badge">⚡ ${(r.latencyMs/1000).toFixed(2)}s</div>` : ""}
      </div>
      <div class="result-content">${r.error ? "❌ " + r.error : escapeHtml(r.content)}</div>
      ${r.usage ? `
      <div class="result-footer">
        <span>↑ ${r.usage.prompt_tokens} prompt</span>
        <span>↓ ${r.usage.completion_tokens} completion</span>
        <span>∑ ${r.usage.total_tokens} total</span>
      </div>` : ""}
    `;

    grid.appendChild(card);
  });

  section.scrollIntoView({ behavior: "smooth" });
}

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

loadModels();s
