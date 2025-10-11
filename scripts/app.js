import { SpoonacularAPI } from "./api-middleware.mjs";
import { Utils } from "./utils.mjs";

//my personal rapidapi key
const RAPIDAPI_KEY = "d36192454amsh674d94bc33467b2p1bf94ejsn9270ca3cc469";

//local storage keys
const LS_RECENT_KEY = "recipebook:recentSearches";
const LS_LAST_SEARCH_STATE = "recipebook:lastSearchState";
const LS_LAST_RESULTS = "recipebook:lastSearchResults";
const LS_LAST_SUGGESTIONS = "recipebook:lastSuggestions";
const LS_RECIPE_CACHE = "recipebook:recipeById";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const els = {
  form: $(".search"),
  q: $("#q"),
  ingredient: $("#ingredient"),
  recent: $("#recent"),
  resultsGrid: $("#results .card-grid"),
  suggestionsGrid: $("#suggestions .card-grid"),
  suggestionsHeader: $("#suggestions .section-header"),
};

let api;

const util = new Utils();

// one function to render recipe cards for both results and suggested random recipes
function renderRecipes(container, recipes) {
  if (!container) return;

  if (!recipes || recipes.length === 0) {
    container.innerHTML = `<p class="subtle">No recipes found. Try different keywords or ingredients.</p>`;
    return;
  }

  // for every recipe, produce an article
  container.innerHTML = recipes
    .map(
      (r) => `
        <article class="card" onclick="navigateToRecipe(${Number(r.id)});">
          <img
            class="card-media"
            src="${util.sanitizeAttr(r.image)}"
            alt="${util.sanitizeHtml(r.title)}"
            referrerpolicy="no-referrer"
            loading="lazy"
            decoding="async"
          />
          <div class="card-body">
            <h3 class="card-title">${util.sanitizeHtml(r.title)}</h3>
          </div>
        </article>`
    )
    .join("");
}

window.navigateToRecipe = function navigateToRecipe(id) {
  window.location.href = `./recipe.html?id=${encodeURIComponent(id)}`;
};

// add refresh button to DOM in the Suggested for you section
function renderRefreshButton() {
  if (!els.suggestionsHeader) return;
  if (els.suggestionsHeader.querySelector(".btn-refresh")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-refresh";
  btn.textContent = "Refresh";
  btn.style.marginLeft = "auto";
  btn.addEventListener("click", onRefreshSuggestions);
  els.suggestionsHeader.appendChild(btn);
}

function loadRecentSearches() {
  try {
    const raw = localStorage.getItem(LS_RECENT_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// every time a search is run, save the search in recents, up to the last 10
function saveRecentSearch({ q, ingredient }) {
  const now = Date.now();
  const key = canonicalKey({ q, ingredient });

  let list = loadRecentSearches();

  list = [{ q, ingredient, t: now, key }, ...list.filter((x) => x.key !== key)];

  // only store the last 10 searches
  if (list.length > 10) list.length = 10;

  localStorage.setItem(LS_RECENT_KEY, JSON.stringify(list));
}

// populate recent searches dropdown with up to the last 10 searches run by the user
function populateRecentDropdown() {
  if (!els.recent) return;
  const list = loadRecentSearches();

  els.recent.innerHTML =
    `<option value="" selected disabled>Choose a recent search…</option>` +
    list
      .map((item) => {
        const label = [item.q, item.ingredient]
          .filter(Boolean)
          .join(" + ")
          .trim();
        return `<option value="${util.sanitizeAttr(
          JSON.stringify({ q: item.q || "", ingredient: item.ingredient || "" })
        )}">${util.sanitizeHtml(label || "(empty)")}</option>`;
      })
      .join("");
}

// helper function to produce local storage key for a search, i.e. "stew + beef"
function canonicalKey({ q, ingredient }) {
  const a = (q || "").trim().toLowerCase();
  const b = (ingredient || "").trim().toLowerCase();
  return `${a}|${b}`;
}

// search button logic
async function onSearchSubmit(e) {
  e.preventDefault();
  const query = (els.q?.value || "").trim();
  const ingredient = (els.ingredient?.value || "").trim();

  // if user didn't enter search params, surface in-line error nicely
  if (!query && !ingredient) {
    surfaceInlineError("Enter a keyword or an ingredient to search.");
    return;
  }

  // lock form in case api takes a long time
  lockForm(true);
  try {
    const recipes = await api.searchRecipes({
      query: query || undefined,
      includeIngredients: ingredient || undefined,
      number: 5,
    });

    // cache stuff
    cacheLastSearch({ q: query, ingredient });
    cacheLastResults(recipes);
    cacheRecipesById(recipes);
    renderRecipes(els.resultsGrid, recipes);

    // Save to recent
    saveRecentSearch({ q: query, ingredient });
    populateRecentDropdown();
  } catch (err) {
    surfaceInlineError(err.message || "Search failed. Please try again.");
  } finally {
    // unlock form after everything finishes
    lockForm(false);
  }
}

// add keyword/ingredient search params when user chooses a recent search
function onRecentChange() {
  try {
    const val = els.recent.value;
    if (!val) return;
    const { q, ingredient } = JSON.parse(val);
    if (els.q) els.q.value = q || "";
    if (els.ingredient) els.ingredient.value = ingredient || "";
  } catch {
    // ignore parse errors
  }
}

// load fresh suggestions when user clicks Refresh
async function onRefreshSuggestions() {
  await loadSuggestions(true);
}

// api call to get new random suggestions
async function loadSuggestions(force = false) {
  try {
    lockSuggestions(true);
    const recipes = await api.randomRecipes({ number: 5 });

    cacheLastSuggestions(recipes);
    cacheRecipesById(recipes);
    renderRecipes(els.suggestionsGrid, recipes);
  } catch (err) {
    surfaceInlineError(err.message || "Could not load suggestions.");
  } finally {
    lockSuggestions(false);
  }
}

function getMostRecentSearch() {
  const list = loadRecentSearches();
  return list[0] || null;
}

// lock keyword/ingredient fields when running a search to prevent multiple concurrent api calls
function lockForm(locked) {
    if (!els.form) return;
    $$("input, select, button", els.form).forEach((el) => (el.disabled = locked));
  }

// lock refresh button to prevent multiple concurrent refresh api calls
function lockSuggestions(locked) {
  const btn = $(".btn-refresh", els.suggestionsHeader);
  if (btn) btn.disabled = locked;
}

// store last search keyword & ingredient
function cacheLastSearch({ q, ingredient }) {
  localStorage.setItem(LS_LAST_SEARCH_STATE, JSON.stringify({ q, ingredient }));
}

// store results from last search
function cacheLastResults(recipes) {
  localStorage.setItem(LS_LAST_RESULTS, JSON.stringify(recipes || []));
}

// store results from last random 5 suggestions
function cacheLastSuggestions(recipes) {
  localStorage.setItem(LS_LAST_SUGGESTIONS, JSON.stringify(recipes || []));
}

// stash recipes here too for reference on recipe details page
function cacheRecipesById(recipes) {
  const map = loadRecipeCache();
  for (const r of recipes || []) {
    if (r?.id) map[r.id] = r;
  }
  localStorage.setItem(LS_RECIPE_CACHE, JSON.stringify(map));
}

// get cache from loacl storage
function loadRecipeCache() {
  try {
    const raw = localStorage.getItem(LS_RECIPE_CACHE);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

// add events to the search and recent search DOM elements
function bindEvents() {
  els.form?.addEventListener("submit", onSearchSubmit);
  els.recent?.addEventListener("change", onRecentChange);
}

// initialize page with all of the things
async function init() {
  api = new SpoonacularAPI({ apiKey: RAPIDAPI_KEY });

  populateRecentDropdown();
  renderRefreshButton();

  try {
    const st = JSON.parse(localStorage.getItem(LS_LAST_SEARCH_STATE) || "null");
    if (st) {
      if (els.q) els.q.value = st.q || "";
      if (els.ingredient) els.ingredient.value = st.ingredient || "";
    }
  } catch {}

  // if we have cached recipes, render those
  try {
    const cachedSug = JSON.parse(
      localStorage.getItem(LS_LAST_SUGGESTIONS) || "null"
    );
    if (cachedSug && Array.isArray(cachedSug) && cachedSug.length) {
      renderRecipes(els.suggestionsGrid, cachedSug);
    } else {
      //turned off api to not accrue so much cost
      //await loadSuggestions(true);
    }
  } catch {
    //await loadSuggestions(true);
  }

  // If we have a most recent search, load it immediately
  try {
    const cachedResults = JSON.parse(
      localStorage.getItem(LS_LAST_RESULTS) || "null"
    );
    if (cachedResults && Array.isArray(cachedResults) && cachedResults.length) {
      renderRecipes(els.resultsGrid, cachedResults);
    } else {
      // no cached results. don't do anything until search is run
    }
  } catch {}
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  init();
});
