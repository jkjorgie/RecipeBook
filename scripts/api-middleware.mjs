const DEFAULT_TIMEOUT_MS = 12000;
const RAPIDAPI_HOST = "spoonacular-recipe-food-nutrition-v1.p.rapidapi.com";
export class SpoonacularAPI {
  /**
   * @param {object} opts
   * @param {string} opts.apiKey - Your RapidAPI key
   * @param {number} [opts.timeoutMs] - Per-request timeout
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

  async _get(path, query = {}) {
    const url = new URL(this.base + path);

    //console.log(`url:${url}`);
    //console.log(`headers:${this.headers["X-RapidAPI-Host"]}/${this.headers["X-RapidAPI-Key"]}`);

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
      // Friendly error surface
      if (err.name === "AbortError") {
        throw new Error("The request timed out. Please try again.");
      }
      // Spoonacular on RapidAPI sometimes returns HTML in errors—normalize it
      throw new Error(err.message || "Network error contacting API.");
    } finally {
      clearTimeout(t);
    }
  }

  async searchRecipes({ query, includeIngredients, number = 5 }) {
    const data = await this._get("/recipes/complexSearch", {
      query,
      includeIngredients,
      number,
      addRecipeInformation: true, // adds image, sourceUrl, etc
      instructionsRequired: true,
      sort: "popularity",
    });

    //console.log(data.results);

    return (data?.results || []).map(this.normalizeRecipe);
  }

  async randomRecipes({ number = 5 }) {
    const data = await this._get("/recipes/random", { number });
    return (data?.recipes || []).map(this.normalizeRecipe);
  }

  async similarRecipes({ id, number = 5 }) {
    if (!id) throw new Error("similarRecipes requires an id");
    const data = await this._get(`/recipes/${id}/similar`, { number });

    return (data || []).map((r) => ({
      id: r.id,
      title: r.title,
      image: `https://spoonacular.com/recipeImages/${r.id}-556x370.jpg`,
      url: r.sourceUrl || "", // not always present here
    }));
  }

  normalizeRecipe(r) {
    // Normalize fields for the UI renderer
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
