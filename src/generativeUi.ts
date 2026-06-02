import type { ModelContext } from "@mcp-b/webmcp-types";

/* ------------------------------------------------------------------ */
/*  Generative UI — WebMCP tools for DOM read/update + UI bundles     */
/* ------------------------------------------------------------------ */

const GEN_STYLE_ID = "webmcp-gen-ui-styles";
const GEN_ROOT_ID = "webmcp-gen-ui-root";

/** Approximate brand colors so agents can theme columns without guessing */
export const STORE_BRAND_COLORS: Record<string, string> = {
  Costco: "#E31837",
  "Whole Foods": "#00674F",
  Walmart: "#0071CE",
  Target: "#CC0000",
  "Trader Joe's": "#C8102E",
  Kroger: "#0066B3",
  Aldi: "#00529B",
  default: "#333333",
};

function ensureGenUiElements() {
  let styleEl = document.getElementById(GEN_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = GEN_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  let rootEl = document.getElementById(GEN_ROOT_ID);
  if (!rootEl) {
    rootEl = document.createElement("div");
    rootEl.id = GEN_ROOT_ID;
    rootEl.setAttribute("data-gen-ui-root", "true");
    document.body.appendChild(rootEl);
  }

  return { styleEl, rootEl };
}

function truncate(text: string, max = 200) {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function serializeElement(el: Element, index: number) {
  const htmlEl = el as HTMLElement;
  const rect = htmlEl.getBoundingClientRect();
  const computed = window.getComputedStyle(htmlEl);

  return {
    index,
    tag: el.tagName.toLowerCase(),
    id: el.id || undefined,
    classes: [...el.classList],
    attributes: Object.fromEntries(
      [...el.attributes]
        .filter((a) => !a.name.startsWith("data-react"))
        .map((a) => [a.name, a.value])
    ),
    text: truncate((el.textContent ?? "").replace(/\s+/g, " ").trim()),
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    styles: {
      backgroundColor: computed.backgroundColor,
      color: computed.color,
      borderColor: computed.borderColor,
      display: computed.display,
    },
  };
}

export function getPageDomSnapshot() {
  const columns = [...document.querySelectorAll(".store-column")].map((col, i) => {
    const name =
      col.getAttribute("data-store-name") ??
      col.querySelector(".store-header h2")?.textContent?.trim() ??
      `column-${i}`;
    const storeId = col.getAttribute("data-store-id");
    const items = [...col.querySelectorAll(".item")].map((item) => ({
      id: item.getAttribute("data-item-id"),
      name: item.querySelector(".item-name")?.textContent?.trim(),
      purchased: item.classList.contains("purchased"),
    }));

    return {
      selector: storeId
        ? `.store-column[data-store-id="${storeId}"]`
        : `.store-column:nth-child(${i + 1})`,
      storeId,
      storeName: name,
      brandColor: STORE_BRAND_COLORS[name] ?? STORE_BRAND_COLORS.default,
      itemCount: items.length,
      items,
      itemListSelector: storeId
        ? `.store-column[data-store-id="${storeId}"] .item-list`
        : `.store-column:nth-child(${i + 1}) .item-list`,
    };
  });

  const { styleEl, rootEl } = ensureGenUiElements();

  return {
    title: document.querySelector(".app-header h1")?.textContent?.trim() ?? "Grocery List",
    subtitle: document.querySelector(".subtitle")?.textContent?.trim(),
    storeColumns: columns,
    storeBrandColors: STORE_BRAND_COLORS,
    usefulSelectors: {
      board: ".board",
      storeColumn: ".store-column",
      storeHeader: ".store-header",
      itemList: ".item-list",
      item: ".item",
      purchasedItem: ".item.purchased",
      genUiRoot: `#${GEN_ROOT_ID}`,
      genUiStyles: `#${GEN_STYLE_ID}`,
    },
    generativeUi: {
      hasCustomCss: Boolean(styleEl.textContent?.trim()),
      hasInjectedHtml: Boolean(rootEl.innerHTML.trim()),
    },
  };
}

export function queryDom(selector: string, limit = 10) {
  const nodes = [...document.querySelectorAll(selector)].slice(0, limit);
  if (nodes.length === 0) {
    return { error: `No elements matched "${selector}"`, matches: [] };
  }
  return {
    selector,
    matchCount: nodes.length,
    matches: nodes.map((el, i) => serializeElement(el, i)),
  };
}

export function updateDom(args: Record<string, unknown>) {
  const selector = String(args.selector ?? "");
  const action = String(args.action ?? "");
  const property = args.property != null ? String(args.property) : undefined;
  const value = args.value != null ? String(args.value) : "";

  if (!selector || !action) {
    return { error: "selector and action are required" };
  }

  const elements = [...document.querySelectorAll(selector)];
  if (elements.length === 0) {
    return { error: `No elements matched "${selector}"` };
  }

  const updated: string[] = [];

  for (const el of elements) {
    const htmlEl = el as HTMLElement;
    switch (action) {
      case "setStyle": {
        if (!property) return { error: "property is required for setStyle" };
        htmlEl.style.setProperty(property, value);
        updated.push(`${selector} style.${property}=${value}`);
        break;
      }
      case "setAttribute": {
        if (!property) return { error: "property is required for setAttribute" };
        el.setAttribute(property, value);
        updated.push(`${selector} [${property}]=${value}`);
        break;
      }
      case "addClass":
        el.classList.add(value);
        updated.push(`${selector} +class ${value}`);
        break;
      case "removeClass":
        el.classList.remove(value);
        updated.push(`${selector} -class ${value}`);
        break;
      case "setInnerHTML":
        htmlEl.innerHTML = value;
        updated.push(`${selector} innerHTML replaced`);
        break;
      case "appendHTML":
        htmlEl.insertAdjacentHTML("beforeend", value);
        updated.push(`${selector} HTML appended`);
        break;
      default:
        return {
          error: `Unknown action "${action}". Use setStyle, setAttribute, addClass, removeClass, setInnerHTML, or appendHTML.`,
        };
    }
  }

  return { ok: true, updatedCount: elements.length, changes: updated };
}

export function applyGenerativeUi(args: Record<string, unknown>) {
  const instruction = String(args.instruction ?? "").trim();
  const html = String(args.html ?? "");
  const css = String(args.css ?? "");
  const js = String(args.js ?? "");

  if (!instruction && !html && !css && !js) {
    return {
      error:
        "Provide at least instruction (for logging) plus html, css, and/or js to apply.",
    };
  }

  const { styleEl, rootEl } = ensureGenUiElements();
  const applied: string[] = [];

  if (css) {
    styleEl.textContent = css;
    applied.push(`css (${css.length} chars)`);
  }

  if (html) {
    rootEl.innerHTML = html;
    applied.push(`html (${html.length} chars)`);
  }

  if (js) {
    try {
      const run = new Function(
        "document",
        "window",
        "console",
        "STORE_BRAND_COLORS",
        `"use strict";\n${js}`
      );
      run(document, window, console, STORE_BRAND_COLORS);
      applied.push(`js (${js.length} chars)`);
    } catch (err) {
      return {
        error: `JavaScript failed: ${err instanceof Error ? err.message : String(err)}`,
        appliedBeforeError: applied,
      };
    }
  }

  return {
    ok: true,
    instruction: instruction || "(no instruction provided)",
    applied,
    hint: "Use get_page_dom or query_dom to verify changes. Use clear_generative_ui to reset injected UI.",
  };
}

export function clearGenerativeUi() {
  document.getElementById(GEN_STYLE_ID)?.remove();
  const root = document.getElementById(GEN_ROOT_ID);
  if (root) {
    root.innerHTML = "";
  }
  return { ok: true, message: "Cleared generative UI styles and injected HTML." };
}

export function registerGenerativeUiTools(
  mc: ModelContext,
  options?: { signal?: AbortSignal }
) {
  const opts = options ?? {};

  mc.registerTool(
    {
      name: "get_page_dom",
      description:
        "Read a structured snapshot of the grocery app DOM: store columns, item lists, selectors, brand colors, and whether generative UI is active. Call this before apply_generative_ui or update_dom so you know what to target.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => JSON.stringify(getPageDomSnapshot(), null, 2),
    },
    opts
  );

  mc.registerTool(
    {
      name: "query_dom",
      description:
        "Query the live DOM with a CSS selector. Returns tag, classes, attributes, text, bounding rect, and computed colors for each match. Use for inspecting specific elements before styling them.",
      inputSchema: {
        type: "object",
        properties: {
          selector: {
            type: "string",
            description: "CSS selector, e.g. '.item-list', '.store-column[data-store-name=\"Costco\"]'",
          },
          limit: {
            type: "number",
            description: "Max elements to return (default 10)",
          },
        },
        required: ["selector"],
      },
      annotations: { readOnlyHint: true },
      execute: (args: Record<string, unknown>) => {
        const limit =
          typeof args.limit === "number" ? args.limit : Number(args.limit) || 10;
        return JSON.stringify(queryDom(String(args.selector), limit), null, 2);
      },
    },
    opts
  );

  mc.registerTool(
    {
      name: "update_dom",
      description:
        "Imperatively update the DOM without a full generative bundle. Actions: setStyle (property + value), setAttribute, addClass, removeClass, setInnerHTML, appendHTML. All matching elements are updated.",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector for target element(s)" },
          action: {
            type: "string",
            description:
              "setStyle | setAttribute | addClass | removeClass | setInnerHTML | appendHTML",
          },
          property: {
            type: "string",
            description: "CSS property name (setStyle) or attribute name (setAttribute)",
          },
          value: { type: "string", description: "Value to apply" },
        },
        required: ["selector", "action", "value"],
      },
      execute: (args: Record<string, unknown>) =>
        JSON.stringify(updateDom(args), null, 2),
    },
    opts
  );

  mc.registerTool(
    {
      name: "apply_generative_ui",
      description:
        "Apply AI-generated UI customizations to the page. Pass HTML (injected into #webmcp-gen-ui-root), CSS (injected as a global style block — use this to restyle .item-list, .store-column, etc.), and/or JS (runs with document, window, and STORE_BRAND_COLORS in scope). Typical flow: get_page_dom → generate css/js → apply_generative_ui. Example instruction: 'Set each store column item list background to that store brand color'.",
      inputSchema: {
        type: "object",
        properties: {
          instruction: {
            type: "string",
            description:
              "Human-readable description of what this UI change does (for logging and confirmation)",
          },
          html: {
            type: "string",
            description: "Optional HTML fragment injected into the generative UI root",
          },
          css: {
            type: "string",
            description:
              "CSS rules applied globally (target existing classes like .item-list, .store-column[data-store-name='Costco'])",
          },
          js: {
            type: "string",
            description:
              "JavaScript executed after CSS/HTML. Has access to document, window, console, STORE_BRAND_COLORS.",
          },
        },
        required: ["instruction"],
      },
      execute: (args: Record<string, unknown>) =>
        JSON.stringify(applyGenerativeUi(args), null, 2),
    },
    opts
  );

  mc.registerTool(
    {
      name: "clear_generative_ui",
      description:
        "Remove injected generative UI CSS and HTML. Does not revert update_dom changes.",
      inputSchema: { type: "object", properties: {} },
      execute: () => JSON.stringify(clearGenerativeUi(), null, 2),
    },
    opts
  );
}
