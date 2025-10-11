export class Utils {
  constructor() {}

  // fix common bad html things to beautify api responses
  sanitizeHtml(str = "") {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  // fix commond bad html things to beautify api responses
  sanitizeAttr(str = "") {
    return this.sanitizeHtml(str).replaceAll("'", "&#39;");
  }

  // fix commond bad html things to beautify api responses
  /*escapeAttr(str = "") {
    return this.escapeHtml(str).replaceAll("'", "&#39;");
  }*/

  // show nice in-line error message if there's some kind of problem
  surfaceInlineError(msg) {
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
}
