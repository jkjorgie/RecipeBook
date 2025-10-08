import { SpoonacularAPI } from "./api-middleware.mjs";

//my personal rapidapi key
const RAPIDAPI_KEY = "d36192454amsh674d94bc33467b2p1bf94ejsn9270ca3cc469";
//local storage key for recent searches entry
const LS_RECENT_KEY = "recipebook:recentSearches";

/** ========= DOM HELPERS ========= */
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

/** ========= RENDERING ========= */

function renderRecipes(container, recipes) {
    if (!container) return;
  
    if (!recipes || recipes.length === 0) {
      container.innerHTML = `<p class="subtle">No recipes found. Try different keywords or ingredients.</p>`;
      return;
    }
  
    container.innerHTML = recipes
      .map(
        (r) => `
        <article class="card">
          <img
            class="card-media"
            src="${sanitizeAttr(r.image)}"
            alt="${sanitizeHtml(r.title)}"
            referrerpolicy="no-referrer"
            loading="lazy"
            decoding="async"
          />
          <div class="card-body">
            <h3 class="card-title">${sanitizeHtml(r.title)}</h3>
          </div>
        </article>`
      )
      .join("");
  }

function ensureSuggestionsRefreshButton() {
  if (!els.suggestionsHeader) return;
  if (els.suggestionsHeader.querySelector(".btn-refresh")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-refresh";
  btn.textContent = "Refresh";
  btn.style.marginLeft = "auto"; // push to right within header
  btn.addEventListener("click", onRefreshSuggestions);
  els.suggestionsHeader.appendChild(btn);
}

/** ========= RECENT SEARCHES (LocalStorage) ========= */

function loadRecentSearches() {
  try {
    const raw = localStorage.getItem(LS_RECENT_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveRecentSearch({ q, ingredient }) {
  const now = Date.now();
  const key = canonicalKey({ q, ingredient });

  let list = loadRecentSearches();

  // De-dupe by canonical key, newest first
  list = [{ q, ingredient, t: now, key }, ...list.filter((x) => x.key !== key)];

  // Max 10
  if (list.length > 10) list.length = 10;

  localStorage.setItem(LS_RECENT_KEY, JSON.stringify(list));
}

function populateRecentDropdown() {
  if (!els.recent) return;
  const list = loadRecentSearches();

  // Preserve the first placeholder option
  els.recent.innerHTML =
    `<option value="" selected disabled>Choose a recent search…</option>` +
    list
      .map((item) => {
        const label = [item.q, item.ingredient]
          .filter(Boolean)
          .join(" + ")
          .trim();
        // Use JSON in value so we can restore both fields
        return `<option value="${sanitizeAttr(
          JSON.stringify({ q: item.q || "", ingredient: item.ingredient || "" })
        )}">${sanitizeHtml(label || "(empty)")}</option>`;
      })
      .join("");
}

function canonicalKey({ q, ingredient }) {
  const a = (q || "").trim().toLowerCase();
  const b = (ingredient || "").trim().toLowerCase();
  return `${a}|${b}`;
}

/** ========= EVENTS ========= */

async function onSearchSubmit(e) {
  e.preventDefault();
  const query = (els.q?.value || "").trim();
  const ingredient = (els.ingredient?.value || "").trim();

  if (!query && !ingredient) {
    toast("Enter a keyword or an ingredient to search.");
    return;
  }

  lockForm(true);
  try {
    const recipes = await api.searchRecipes({
      query: query || undefined,
      includeIngredients: ingredient || undefined,
      number: 5,
    });

    renderRecipes(els.resultsGrid, recipes);

    // Save to recent
    saveRecentSearch({ q: query, ingredient });
    populateRecentDropdown();
  } catch (err) {
    toast(err.message || "Search failed. Please try again.");
  } finally {
    lockForm(false);
  }
}

function onRecentChange() {
  try {
    const val = els.recent.value;
    if (!val) return;
    const { q, ingredient } = JSON.parse(val);
    if (els.q) els.q.value = q || "";
    if (els.ingredient) els.ingredient.value = ingredient || "";
    // Optional: auto-trigger search after choosing a recent
    // els.form?.dispatchEvent(new Event("submit", { cancelable: true }));
  } catch {
    // ignore parse errors
  }
}

async function onRefreshSuggestions() {
  await loadSuggestions(true);
}

/** ========= SUGGESTED / RANDOM ========= */

async function loadSuggestions(force = false) {
  // You could cache results if desired; for now always fetch unless instructed otherwise
  try {
    lockSuggestions(true);
    const recipes = await api.randomRecipes({ number: 5 });
    renderRecipes(els.suggestionsGrid, recipes);
  } catch (err) {
    toast(err.message || "Could not load suggestions.");
  } finally {
    lockSuggestions(false);
  }
}

function getMostRecentSearch() {
    const list = loadRecentSearches();
    return list[0] || null;
  }

/** ========= UI STATE / TOASTS ========= */

function lockForm(locked) {
  if (!els.form) return;
  $$("input, select, button", els.form).forEach((el) => (el.disabled = locked));
}

function lockSuggestions(locked) {
  const btn = $(".btn-refresh", els.suggestionsHeader);
  if (btn) btn.disabled = locked;
}

function toast(msg) {
  let box = $("#flash");
  if (!box) {
    box = document.createElement("div");
    box.id = "flash";
    box.style.margin = ".5rem 0";
    box.style.padding = ".6rem .8rem";
    box.style.border = "1px solid #d0a";
    box.style.borderRadius = "10px";
    box.style.background = "#fff6fa";
    box.style.fontSize = ".95rem";
    // Insert under search panel if present
    const searchPanel = $("#search .container");
    (searchPanel || document.body).prepend(box);
  }
  box.textContent = msg;
}

/** ========= SMALL UTILS ========= */

function sanitizeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function sanitizeAttr(str = "") {
  return sanitizeHtml(str).replaceAll("'", "&#39;");
}

/** ========= INIT ========= */

function bindEvents() {
  els.form?.addEventListener("submit", onSearchSubmit);
  els.recent?.addEventListener("change", onRecentChange);
}

async function init() {
    // Init API client
    api = new SpoonacularAPI({ apiKey: RAPIDAPI_KEY });
  
    // Recent dropdown
    populateRecentDropdown();
  
    // Suggestions refresh control
    ensureSuggestionsRefreshButton();
  
    // If we have a most recent search, load it immediately
    // ehh changed my mind to not exceed api calls without incurring cost
    /*const last = getMostRecentSearch();
    if (last) {
      if (els.q) els.q.value = last.q || "";
      if (els.ingredient) els.ingredient.value = last.ingredient || "";
      // Perform the search with those fields
      // (call the same logic your submit button uses)
      try {
        lockForm(true);
        const recipes = await api.searchRecipes({
          query: (last.q || "").trim() || undefined,
          includeIngredients: (last.ingredient || "").trim() || undefined,
          number: 5,
        });
        renderRecipes(els.resultsGrid, recipes);
      } catch (err) {
        toast(err.message || "Could not load your last search.");
      } finally {
        lockForm(false);
      }
    }
  
    // Load initial suggestions regardless (or you can skip if last-search ran)
    await loadSuggestions();*/
  }

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  init();
});
