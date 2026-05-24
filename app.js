// ---- Domain classes -------------------------------------------------

class EnergyFeature {
  constructor(raw) {
    this.id = raw.id;
    this.name = raw.name;
    this.type = raw.type;
    this.mathForm = raw.mathForm; // { variables, expression, parameters }
    this.metadata = raw.metadata || {};
  }

  // Returns a human-readable summary of the math form
  toDisplayString() {
    const vars = this.mathForm.variables.join(", ");
    const expr = this.mathForm.expression;
    return `f(${vars}) = ${expr}`;
  }

  // Example: evaluate with a simple parameter substitution (symbolic only)
  // In a real system, you'd plug into a math parser (math.js, etc.)
  getExpressionWithParams() {
    let expr = this.mathForm.expression;
    for (const [key, value] of Object.entries(this.mathForm.parameters || {})) {
      const re = new RegExp(`\\b${key}\\b`, "g");
      expr = expr.replace(re, String(value));
    }
    return expr;
  }
}

class EnergyPattern {
  constructor(raw) {
    this.id = raw.id;
    this.name = raw.name;
    this.description = raw.description;
    this.domain = raw.domain;
    this.globalRepresentation = raw.globalRepresentation; // { variables, expression, parameters }
    this.features = (raw.features || []).map(f => new EnergyFeature(f));
  }

  getGlobalDisplayString() {
    const vars = this.globalRepresentation.variables.join(", ");
    const expr = this.globalRepresentation.expression;
    return `g(${vars}) = ${expr}`;
  }

  getGlobalExpressionWithParams() {
    let expr = this.globalRepresentation.expression;
    for (const [key, value] of Object.entries(this.globalRepresentation.parameters || {})) {
      const re = new RegExp(`\\b${key}\\b`, "g");
      expr = expr.replace(re, String(value));
    }
    return expr;
  }
}

// ---- State -----------------------------------------------------------

const state = {
  patterns: [],
  selectedPattern: null,
  selectedFeature: null
};

// ---- DOM helpers -----------------------------------------------------

function $(selector) {
  return document.querySelector(selector);
}

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

// ---- Rendering -------------------------------------------------------

function renderPatternList() {
  const container = $("#pattern-list");
  container.innerHTML = "";

  state.patterns.forEach(pattern => {
    const item = createEl("div", "pattern-item");
    item.dataset.id = pattern.id;

    const nameEl = createEl("div", "pattern-name", pattern.name);
    const domainEl = createEl("div", "pattern-domain", `Domain: ${pattern.domain}`);

    item.appendChild(nameEl);
    item.appendChild(domainEl);

    if (state.selectedPattern && state.selectedPattern.id === pattern.id) {
      item.classList.add("active");
    }

    item.addEventListener("click", () => {
      state.selectedPattern = pattern;
      state.selectedFeature = null;
      renderPatternList();
      renderPatternDetail();
      renderFeatureDetail();
    });

    container.appendChild(item);
  });
}

function renderPatternDetail() {
  const container = $("#pattern-detail");
  container.innerHTML = "";

  if (!state.selectedPattern) {
    container.innerHTML = "<p>Select a pattern to view details.</p>";
    return;
  }

  const p = state.selectedPattern;

  // Description
  const descBlock = createEl("div", "detail-block");
  const descLabel = createEl("div", "detail-label", "Description");
  const descText = createEl("div", null, p.description || "No description.");
  descBlock.appendChild(descLabel);
  descBlock.appendChild(descText);

  // Global representation
  const globalBlock = createEl("div", "detail-block");
  const globalLabel = createEl("div", "detail-label", "Global mathematical representation");
  const globalCode = createEl("pre", "code-block");
  globalCode.textContent =
    p.getGlobalDisplayString() +
    "\n\nWith parameters:\n" +
    JSON.stringify(p.globalRepresentation.parameters, null, 2) +
    "\n\nSubstituted expression:\n" +
    p.getGlobalExpressionWithParams();
  globalBlock.appendChild(globalLabel);
  globalBlock.appendChild(globalCode);

  // Features list
  const featuresBlock = createEl("div", "detail-block");
  const featuresLabel = createEl("div", "detail-label", "Features");
  const featuresList = createEl("div", "feature-list");

  if (!p.features.length) {
    featuresList.textContent = "No features defined.";
  } else {
    p.features.forEach(feature => {
      const item = createEl("div", "feature-item");
      item.dataset.id = feature.id;

      const nameEl = createEl("div", "feature-name", feature.name);
      const typeEl = createEl("div", "feature-type", `Type: ${feature.type}`);

      item.appendChild(nameEl);
      item.appendChild(typeEl);

      if (state.selectedFeature && state.selectedFeature.id === feature.id) {
        item.classList.add("active");
      }

      item.addEventListener("click", () => {
        state.selectedFeature = feature;
        renderPatternDetail();
        renderFeatureDetail();
      });

      featuresList.appendChild(item);
    });
  }

  featuresBlock.appendChild(featuresLabel);
  featuresBlock.appendChild(featuresList);

  container.appendChild(descBlock);
  container.appendChild(globalBlock);
  container.appendChild(featuresBlock);
}

function renderFeatureDetail() {
  const container = $("#feature-detail");
  container.innerHTML = "";

  if (!state.selectedFeature) {
    container.innerHTML = "<p>Select a feature to view its mathematical form.</p>";
    return;
  }

  const f = state.selectedFeature;

  const nameBlock = createEl("div", "detail-block");
  const nameLabel = createEl("div", "detail-label", "Feature");
  const nameText = createEl("div", null, `${f.name} (${f.type})`);
  nameBlock.appendChild(nameLabel);
  nameBlock.appendChild(nameText);

  const mathBlock = createEl("div", "detail-block");
  const mathLabel = createEl("div", "detail-label", "Mathematical form");
  const mathCode = createEl("pre", "code-block");
  mathCode.textContent =
    f.toDisplayString() +
    "\n\nParameters:\n" +
    JSON.stringify(f.mathForm.parameters, null, 2) +
    "\n\nSubstituted expression:\n" +
    f.getExpressionWithParams();
  mathBlock.appendChild(mathLabel);
  mathBlock.appendChild(mathCode);

  const metaBlock = createEl("div", "detail-block");
  const metaLabel = createEl("div", "detail-label", "Metadata");
  const metaCode = createEl("pre", "code-block");
  metaCode.textContent = JSON.stringify(f.metadata || {}, null, 2);
  metaBlock.appendChild(metaLabel);
  metaBlock.appendChild(metaCode);

  container.appendChild(nameBlock);
  container.appendChild(mathBlock);
  container.appendChild(metaBlock);
}

// ---- Initialization --------------------------------------------------

async function loadPatterns() {
  try {
    const res = await fetch("patterns.json");
    const data = await res.json();
    state.patterns = data.map(raw => new EnergyPattern(raw));
    if (state.patterns.length > 0) {
      state.selectedPattern = state.patterns[0];
    }
    renderPatternList();
    renderPatternDetail();
    renderFeatureDetail();
  } catch (err) {
    console.error("Failed to load patterns.json", err);
    $("#pattern-list").textContent = "Error loading patterns.";
  }
}

document.addEventListener("DOMContentLoaded", loadPatterns);
