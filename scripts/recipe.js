//import { SpoonacularAPI } from "./api-middleware.mjs";
import { Utils } from "./utils.mjs";

// local storage keys
const LS_RECENT_KEY = "recipebook:recentSearches";
const LS_LAST_SEARCH_STATE = "recipebook:lastSearchState";
const LS_LAST_RESULTS = "recipebook:lastSearchResults";
const LS_LAST_SUGGESTIONS = "recipebook:lastSuggestions";
const LS_RECIPE_CACHE = "recipebook:recipeById";

// element selector helpers
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

//elements object for ease of reference
const els = {
  title: $("#recipe-title"),
  heroImg: $("#recipe-hero-img"),
  meta: $("#recipe-meta-p"),
  credit: $("#recipe-credit-p"),
  sourceLink: $("#recipe-credit-a"),
  summary: $("#recipe-summary"),
  instructions: $("#recipe-instructions-ol"),
  ingredients: $("#recipe-ingredients-ul"),
  equipment: $("#recipe-equipment-ul"),

  similarGrid: $("#similar .card-grid"),
  headerNav: $("header"),
};

const util = new Utils();

// read json from local storage
function readJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

// get recipe from local storage and then render it on the page
function renderDetails(r) {
  if (!r) {
    util.surfaceInlineError("We couldn't find that recipe in cache.");
    return;
  }
  if (els.title) els.title.textContent = r.title || "Recipe";

  els.heroImg.src = r.image || "";
  els.heroImg.alt = r.title || "Recipe image";
  els.heroImg.setAttribute("referrerpolicy", "no-referrer");
  els.heroImg.onerror = () => {
    els.heroImg.onerror = null;
    els.heroImg.src = "/assets/images/recipe-fallback.jpg";
  };
  els.heroImg.loading = "lazy";
  els.heroImg.decoding = "async";

  const mins = r.ready_in_minutes != null ? `${r.ready_in_minutes} min` : null;
  const serves = r.servings != null ? `${r.servings} servings` : null;
  els.meta.textContent = [mins, serves].filter(Boolean).join(" • ");

  const credit = r.credits_text != null ? `${r.credits_text}` : null;
  els.credit.textContent = credit;

  if (r.url) {
    els.sourceLink.href = r.url;
    els.sourceLink.textContent = "View full recipe";
    els.sourceLink.target = "_blank";
    els.sourceLink.rel = "noopener";
  } else {
    els.sourceLink.style.display = "none";
  }

  const text = r.summary ? stripTags(r.summary) : "";
  els.summary.textContent = text;

  if (r.instructions && r.instructions[0] && r.instructions[0].steps) {
    const { instructions, ingredients, equipment } = parseInstrData(
      r.instructions[0].steps
    );

    for (const step of instructions) {
      const li = document.createElement("li");
      li.textContent = step;
      els.instructions.appendChild(li);
    }

    for (const ing of ingredients) {
      const li = document.createElement("li");
      li.textContent = ing.name;
      els.ingredients.appendChild(li);
    }

    for (const equip of equipment) {
      const li = document.createElement("li");
      li.textContent = equip.name;
      els.equipment.appendChild(li);
    }
  }

}

function stripTags(html = "") {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

function retitleHomeToReturn() {
    const el = document.querySelector(".home-link");
    if (el) {
      el.textContent = "Return to Search";
      return;
    }
}

function findRecipeInCache(id) {
  if (!id) return null;

  const idx = readJSON(LS_RECIPE_CACHE, {});
  if (idx && idx[id]) return idx[id];

  const last = readJSON(LS_LAST_RESULTS, []);
  const fromLast = last.find((r) => String(r.id) === String(id));
  if (fromLast) return fromLast;

  const sugg = readJSON(LS_LAST_SUGGESTIONS, []);
  const fromSugg = sugg.find((r) => String(r.id) === String(id));
  if (fromSugg) return fromSugg;

  return null;
}

function parseInstrData(steps = []) {
  const instructions = [];
  const ingredientsByKey = new Map();
  const equipmentByKey = new Map();

  for (const s of steps || []) {
    // instruction text
    if (s?.step && typeof s.step === "string") {
      instructions.push(s.step.trim());
    }

    // ingredients
    if (Array.isArray(s?.ingredients)) {
      for (const ing of s.ingredients) {
        const key = ing?.id ?? ing?.name?.toLowerCase().trim();
        if (!key) continue;
        if (!ingredientsByKey.has(key)) {
          ingredientsByKey.set(key, {
            id: ing?.id ?? null,
            name: ing?.name ?? "",
            image: ing?.image ?? "",
            localizedName: ing?.localizedName ?? ing?.name ?? "",
          });
        }
      }
    }

    // equipment
    if (Array.isArray(s?.equipment)) {
      for (const eq of s.equipment) {
        const key = eq?.id ?? eq?.name?.toLowerCase().trim();
        if (!key) continue;
        if (!equipmentByKey.has(key)) {
          equipmentByKey.set(key, {
            id: eq?.id ?? null,
            name: eq?.name ?? "",
            image: eq?.image ?? "",
            localizedName: eq?.localizedName ?? eq?.name ?? "",
          });
        }
      }
    }
  }

  return {
    instructions,
    ingredients: [...ingredientsByKey.values()],
    equipment: [...equipmentByKey.values()],
  };
}

async function init() {
  retitleHomeToReturn();

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    util.surfaceInlineError("No recipe selected.");
    return;
  }

  const recipe = findRecipeInCache(id);
  renderDetails(recipe);
}

document.addEventListener("DOMContentLoaded", init);
