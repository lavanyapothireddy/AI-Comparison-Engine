// ← Change this to your Render backend URL
const API_BASE = "https://ai-comparison-engine.onrender.com";

let selectedModels = new Set();

// Load models on page load
async function loadModels() {
  try {
    const res = await fetch(`${API_BASE}/models`);
    const models = await res.json();
    const container = document.getElementById("modelCheckboxes");
    container.innerHTML = "";

    models.forEach((m, i) => {
      const card = document.createElement("div");
      card.className = "model-card";
      card.dataset.id = m.id;
      card.innerHTML = `<div class="dot"></div>${m.name}`;
      card.onclick = () => toggleModel(m.id, card);
      container.appendChild(card);

      // Select first 2 by default
      if (i < 2) {
        toggleModel(m.id, card);
      }
    });
  } catch (e) {
    document.getElementById("modelCheckboxes").innerHTML =
      `<div style="color:#ef4444">❌ Failed to load models. Check your backend URL.</div>`;
  }
}

// Toggle model selection
function toggleModel(id, card) {
  if (selectedModels.has(id)) {
    selectedModels.delete(id);
    card.classList.remove("selected");
  } else {
    selectedModels.add(id);
    card.classList.add("selected");
  }
}

// Slider live value display
document.getElementById("temperature").addEventListener("input", (e) => {
  document.getElementById("tempVal").textContent = parseFloat(e.target.value).toFixed(1);
});

document.getElementById("maxTokens").addEventListener("input", (e) => {
  document.getElementById("tokensVal").textContent = e.target.value;
});

// Main comparison function
async function runComparison() {
  const prompt = document.getElementById("userPrompt").value.trim();
  const temperature = parseFloat(document.getElementById("temperature").value);
  const maxTokens = parseInt(document.getElementById("maxTokens").value);

  if (!prompt) {
    alert("Please enter a prompt.");
    return;
  }
  if (selectedModels.size === 0) {
    alert("Please select at least one model.");
    return;
  }

  // Show loading state
  const btn = document.getElementById("compareBtn");
  document.getElementById("btnText").classList.add("hidden");
  document.getElementById("btnLoader").classList.remove("hidden");
  btn.disabled = true;

  // Hide previous results
  document.getElementById("resultsSection").classList.add("hidden");

  const startTime = Date.now();

  try {
    const res = await fetch(`${API_BASE}/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        models: [...selectedModels],
        temperature,
        maxTokens,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Server error");
    }

    const data = await res.json();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    renderResults(data.results, elapsed);

  } catch (e) {
    alert("Error: " + e.message);
  } finally {
    // Restore button
    document.getElementById("btnText").classList.remove("hidden");
    document.getElementById("btnLoader").classList.add("hidden");
    btn.disabled = false;
  }
}

// Render results to the grid
function renderResults(results, elapsed) {
  const section = document.getElementById("resultsSection");
  const grid = document.getElementById("resultsGrid");
  const meta = document.getElementById("resultsMeta");

  meta.textContent = `${results.length} model${results.length > 1 ? "s" : ""} compared · ${elapsed}s total`;
  grid.innerHTML = "";

  results.forEach((r, i) => {
    const card = document.createElement("div");
    card.className = "result-card" + (r.error ? " error" : "");
    card.style.animationDelay = `${i * 0.08}s`;

    const modelLabel = r.modelId
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const latencyHtml = r.latencyMs
      ? `<div class="latency-badge">⚡ ${(r.latencyMs / 1000).toFixed(2)}s</div>`
      : "";

    const contentHtml = r.error
      ? `<div class="result-content" style="color:var(--error)">❌ ${escapeHtml(r.error)}</div>`
      : `<div class="result-content">${escapeHtml(r.content)}</div>`;

    const footerHtml = r.usage
      ? `<div class="result-footer">
           <span>↑ ${r.usage.prompt_tokens} prompt</span>
           <span>↓ ${r.usage.completion_tokens} completion</span>
           <span>∑ ${r.usage.total_tokens} total</span>
         </div>`
      : "";

    card.innerHTML = `
      <div class="result-card-header">
        <div class="model-name">${modelLabel}</div>
        ${latencyHtml}
      </div>
      ${contentHtml}
      ${footerHtml}
    `;

    grid.appendChild(card);
  });

  section.classList.remove("hidden");
  section.scrollIntoView({ behavior: "smooth" });
}

// Escape HTML to prevent XSS
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Init
loadModels();
