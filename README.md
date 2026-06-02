# WebMCP Grocery List

A demo grocery list app that exposes tools via the [WebMCP](https://developer.chrome.com/docs/ai/webmcp) declarative and imperative APIs. An AI agent can query stores/items, add/delete/move items, toggle purchased status, and manage store columns — all without screen-scraping.

> **Note:** WebMCP is an early-stage specification. This app loads [`@mcp-b/global`](https://www.npmjs.com/package/@mcp-b/global) so tools register with the **WebMCP-B Chrome extension** (MCP bridge transport). For native Chrome 146+ declarative form tools, also enable `chrome://flags/#enable-webmcp-testing`.

![Screenshot](screenshot.png)

## Setup

```bash
pnpm install
pnpm dev
```

`@mcp-b/global` auto-initializes in `src/main.tsx` before React mounts. After starting the dev server, open the page and connect with the [WebMCP-B extension](https://docs.mcp-b.ai/). Refresh the tab if tools do not appear immediately.

**Debugging:** `navigator.modelContextTesting?.listTools()` in the console only proves tools are registered on the page — the extension needs `@mcp-b/global` (not `@mcp-b/webmcp-polyfill` alone) to discover them via the bridge.

## WebMCP Tools

**Imperative** (JS API — read-only queries):

- `get_stores` — list all stores with IDs and item counts
- `get_all_items` — every item across all stores
- `get_items_by_store` — items for a specific store

**Declarative** (HTML form API — mutations):

- `add_item` — add a grocery item to a store
- `delete_item` — remove an item by ID
- `toggle_purchased` — mark/unmark purchased
- `move_item` — move an item between stores
- `add_store` — create a new store column
- `delete_store` — remove a store and its items

**Generative UI** (imperative — customize the live page):

- `get_page_dom` — structured DOM snapshot with store selectors and brand colors
- `query_dom` — inspect elements by CSS selector
- `update_dom` — small imperative DOM edits (style, class, attribute, HTML)
- `apply_generative_ui` — apply AI-generated `html`, `css`, and/or `js` bundles
- `clear_generative_ui` — remove injected generative styles/HTML

Example agent flow: call `get_page_dom`, then `apply_generative_ui` with CSS like `.store-column[data-store-name="Costco"] .item-list { background: #E31837; }` (brand colors are included in the snapshot).
