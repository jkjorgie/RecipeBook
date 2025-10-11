const DEFAULT_TIMEOUT_MS = 12000;
const RAPIDAPI_HOST = "spoonacular-recipe-food-nutrition-v1.p.rapidapi.com";
export class SpoonacularAPI {
  /**
   * @param {object} opts
   * @param {string} opts.apiKey
   * @param {number} [opts.timeoutMs]
   */
  constructor({ apiKey, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    if (!apiKey) throw new Error("SpoonacularAPI requires a RapidAPI key.");
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.base = `https://${RAPIDAPI_HOST}`;
    this.headers = {
      "X-RapidAPI-Key": this.apiKey,
      "X-RapidAPI-Host": RAPIDAPI_HOST,
    };
  }

  // re-usable method to handle API call
  async _get(path, query = {}) {
    const url = new URL(this.base + path);

    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        url.searchParams.set(k, v);
      }
    });

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);

    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: this.headers,
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const msg = text || res.statusText || "Request failed";
        throw new Error(`HTTP ${res.status}: ${msg}`);
      }

      return await res.json();
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error("The request timed out. Please try again.");
      }
      throw new Error(err.message || "Network error contacting API.");
    } finally {
      clearTimeout(t);
    }
  }

  // stages request for search api based on keyword and ingredient search
  async searchRecipes({ query, includeIngredients, number = 5 }) {
    const data = await this._get("/recipes/complexSearch", {
      query,
      includeIngredients,
      number,
      addRecipeInformation: true,
      instructionsRequired: true,
      sort: "popularity",
    });

    return (data?.results || []).map(this.normalizeRecipe);
  }

  // stages request for 5 random recipes to suggest to user
  async randomRecipes({ number = 5 }) {
    const data = await this._get("/recipes/random", { number });
    return (data?.recipes || []).map(this.normalizeRecipe);
  }

  /* NOT IMPLEMENTED
  async similarRecipes({ id, number = 5 }) {
    if (!id) throw new Error("similarRecipes requires an id");
    const data = await this._get(`/recipes/${id}/similar`, { number });

    return (data || []).map((r) => ({
      id: r.id,
      title: r.title,
      image: `https://spoonacular.com/recipeImages/${r.id}-556x370.jpg`,
      url: r.sourceUrl || "",
    }));
  }*/

  // stage information in returned recipe as an object with easier to consume property names, regardless of the api that returned the recipe
  normalizeRecipe(r) {
    return {
      id: r.id,
      title: r.title,
      image: r.image,
      url: r.sourceUrl,
      aggregate_likes: r.aggregateLikes,
      instructions: r.analyzedInstructions,
      cheap: r.cheap,
      cooking_minutes: r.cooking_minutes,
      ready_in_minutes: r.readyInMinutes,
      credits_text: r.creditsText,
      diets: r.diets,
      servings: r.servings,
      summary: r.summary,
      price_per_serving: r.pricePerServing,
      cuisines: r.cuisines,
      dishTypes: r.dishTypes,
    };
  }
}
