/* =============================================
   RAILWATCH AI — JAVASCRIPT
   Handles Gemini API calls & dashboard rendering
   ============================================= */

// ─────────────────────────────────────────────
// 🔑 PASTE YOUR GEMINI API KEY BELOW

const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";

// Gemini model endpoint — using gemini-1.5-flash (fast & free tier)
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;


// ─────────────────────────────────────────────
// SAMPLE DASHBOARD DATA
// In a real system this would come from IoT sensors
// ─────────────────────────────────────────────
const coachData = [
  { name: "S1", occupancy: 62 },
  { name: "S2", occupancy: 78 },
  { name: "S3", occupancy: 45 },
  { name: "S4", occupancy: 95 },
  { name: "S5", occupancy: 88 },
  { name: "B1", occupancy: 55 },
  { name: "B2", occupancy: 72 },
  { name: "A1", occupancy: 38 },
  { name: "A2", occupancy: 50 },
  { name: "SL", occupancy: 99 },
];


// ─────────────────────────────────────────────
// BUILD THE PROMPT SENT TO GEMINI
// ─────────────────────────────────────────────
function buildPrompt(complaint, coach, route) {
  return `
You are an AI assistant for the Indian Railways Crowd Management System.
A passenger has submitted the following complaint:

- Coach Number: ${coach || "Not specified"}
- Train Route: ${route || "Not specified"}
- Complaint: ${complaint}

Analyze this complaint and respond ONLY in the following JSON format (no extra text, no markdown):

{
  "problemCategory": "A short label, e.g. Overcrowding, Unauthorized Passengers, Safety Hazard",
  "crowdSeverity": "Low" or "Medium" or "High",
  "riskLevel": "A short phrase describing the risk, e.g. Moderate Safety Risk",
  "recommendedAction": "A clear 1-3 sentence action that railway authorities should take."
}

Guidelines:
- "High" severity = passengers cannot move freely, safety exits are blocked, or there is physical risk.
- "Medium" severity = significantly more passengers than seats, discomfort but no immediate safety risk.
- "Low" severity = minor overcrowding or manageable situation.
`;
}


// ─────────────────────────────────────────────
// MAIN: ANALYZE COMPLAINT (called on button click)
// ─────────────────────────────────────────────
async function analyzeComplaint() {
  // 1. Read inputs
  const complaint = document.getElementById("complaint").value.trim();
  const coach     = document.getElementById("coach").value.trim();
  const route     = document.getElementById("route").value.trim();

  // 2. Basic validation
  if (!complaint) {
    showError("Please describe the situation before submitting.");
    return;
  }

  if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    showError("⚠️ No API key found. Open script.js and paste your Gemini API key where indicated at the top of the file.");
    return;
  }

  // 3. Show loading, hide old results
  setUIState("loading");

  // 4. Call Gemini API
  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: buildPrompt(complaint, coach, route) }]
          }
        ],
        generationConfig: {
          temperature: 0.3,      // Low temperature = more consistent structured output
          maxOutputTokens: 512,
        }
      })
    });

    // 5. Handle HTTP errors
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const message = errData?.error?.message || `HTTP ${response.status}`;
      throw new Error(message);
    }

    const data = await response.json();

    // 6. Extract text from Gemini response
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Empty response from Gemini.");

    // 7. Parse the JSON the AI returned
    const parsed = parseGeminiJSON(rawText);

    // 8. Display the result
    displayResult(parsed);

  } catch (err) {
    console.error("Gemini API Error:", err);
    showError(`Could not get AI analysis: ${err.message}`);
  }
}


// ─────────────────────────────────────────────
// PARSE GEMINI'S JSON RESPONSE SAFELY
// ─────────────────────────────────────────────
function parseGeminiJSON(raw) {
  // Strip any markdown code fences Gemini might add
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Fallback: try to extract JSON from within the text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("AI returned unexpected format. Try again.");
  }
}


// ─────────────────────────────────────────────
// DISPLAY AI RESULT IN THE CARD
// ─────────────────────────────────────────────
function displayResult(result) {
  // Fill in the values
  document.getElementById("resProblem").textContent  = result.problemCategory  || "—";
  document.getElementById("resSeverity").textContent = result.crowdSeverity    || "—";
  document.getElementById("resRisk").textContent     = result.riskLevel        || "—";
  document.getElementById("resAction").textContent   = result.recommendedAction || "—";

  // Color the severity badge
  const badge     = document.getElementById("severityBadge");
  const severity  = (result.crowdSeverity || "").toLowerCase();
  badge.textContent = result.crowdSeverity || "—";
  badge.className = "result-badge";
  if (severity === "high")   badge.classList.add("high");
  if (severity === "medium") badge.classList.add("medium");
  if (severity === "low")    badge.classList.add("low");

  setUIState("result");
}


// ─────────────────────────────────────────────
// UI STATE MANAGER
// Controls which elements are visible
// ─────────────────────────────────────────────
function setUIState(state) {
  const resultCard    = document.getElementById("resultCard");
  const loadingEl     = document.getElementById("loadingIndicator");
  const errorCard     = document.getElementById("errorCard");
  const analyzeBtn    = document.getElementById("analyzeBtn");

  // Hide everything first
  resultCard.style.display  = "none";
  loadingEl.style.display   = "none";
  errorCard.style.display   = "none";

  if (state === "loading") {
    loadingEl.style.display  = "block";
    analyzeBtn.disabled      = true;
    analyzeBtn.textContent   = "Analyzing…";
  } else if (state === "result") {
    resultCard.style.display = "block";
    analyzeBtn.disabled      = false;
    analyzeBtn.innerHTML     = '<span class="btn-icon">🔍</span> Analyze Complaint';
  } else if (state === "error") {
    errorCard.style.display  = "block";
    analyzeBtn.disabled      = false;
    analyzeBtn.innerHTML     = '<span class="btn-icon">🔍</span> Analyze Complaint';
  }
}


// ─────────────────────────────────────────────
// SHOW ERROR MESSAGE
// ─────────────────────────────────────────────
function showError(message) {
  document.getElementById("errorMsg").textContent = message;
  setUIState("error");
}


// ─────────────────────────────────────────────
// RENDER COACH DASHBOARD CARDS
// ─────────────────────────────────────────────
function renderDashboard() {
  const grid = document.getElementById("dashboardGrid");
  grid.innerHTML = "";

  coachData.forEach(coach => {
    const { statusClass, fillClass, label } = getOccupancyStatus(coach.occupancy);

    const card = document.createElement("div");
    card.className = "coach-card";
    card.innerHTML = `
      <div class="coach-card-top">
        <span class="coach-name">${coach.name}</span>
        <span class="status-badge ${statusClass}">${label}</span>
      </div>
      <div class="occ-bar-bg">
        <div
          class="occ-bar-fill ${fillClass}"
          style="width: 0%;"
          data-target="${coach.occupancy}"
        ></div>
      </div>
      <div class="occ-label">
        Occupancy: <span>${coach.occupancy}%</span>
      </div>
    `;
    grid.appendChild(card);
  });

  // Animate bars after a short delay (so CSS transition fires)
  requestAnimationFrame(() => {
    document.querySelectorAll(".occ-bar-fill").forEach(bar => {
      bar.style.width = bar.dataset.target + "%";
    });
  });
}


// Determine colour tier based on occupancy %
function getOccupancyStatus(pct) {
  if (pct >= 90) return { statusClass: "status-critical", fillClass: "fill-critical", label: "Critical" };
  if (pct >= 70) return { statusClass: "status-moderate", fillClass: "fill-moderate", label: "Moderate" };
  return           { statusClass: "status-ok",       fillClass: "fill-ok",       label: "Normal"   };
}


// ─────────────────────────────────────────────
// ALLOW PRESSING Enter in single-line inputs
// to trigger submission for convenience
// ─────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.tagName === "INPUT") {
    analyzeComplaint();
  }
});


// ─────────────────────────────────────────────
// INIT — run when page loads
// ─────────────────────────────────────────────
renderDashboard();
