# PaperMart site — how we work

Static HTML/CSS/JS site built from Figma, page by page. No build step, no framework.

## Project structure

```
index.html  contact.html  faq.html  delivery.html  specifications.html  product.html  cart.html  returns.html  terms.html  privacy.html
css/normalize.css   css/style.css   css/media.css   css/vendor/{swiper-bundle.min,aos,lenis}.css
js/main.js          js/vendor/{swiper-bundle.min,aos,lenis.min}.js   (AOS 2.3.4, Lenis 1.1.13)
assets/fonts  assets/icons  assets/images
```

Hard rules:
- Only these CSS files: desktop styles → `style.css`, all responsive overrides → `media.css`. No per-page CSS files.
- Only `js/main.js` (vanilla JS). Every feature is an `initX()` that returns early if its elements are missing, so one file serves all pages.
- Header, footer and info bar markup is identical on every page. Change one, change all ten.
- Reuse existing components and assets before adding new ones. Check for duplicate images by md5 before saving Figma exports.

## Figma

- File: "papermart (Copy)". Current key `Ql7RO1DlilHl6YOw5mvkAm` (earlier copies: `6sI4FMLAjCb7OhIRCSYvOs`, `GNb1iylnYd2gCTwB6W5fQC`, `XuqttTNAjk45UtpPCWpoqZ`; node ids are the same across copies).
- Figma MCP is the source of truth. Workflow per frame: `get_metadata` on the frame → `get_design_context` per section (screenshot on) → build → measure in the browser → compare to Figma positions.
- Download MCP assets with curl **including the file extension** in the URL. Strip `preserveAspectRatio="none" overflow="visible" style="display: block;"` from SVGs before saving.
- Figma sometimes clips text with fixed-height frames, or stretches images. Don't copy those bugs: show the full text, keep images undistorted, and tell the user about the deviation.

## Breakpoints (`css/media.css`)

| Range | Approach |
|---|---|
| ≥1920px | Desktop, exact Figma values (`style.css`) |
| 1280–1919px | Every px value × 0.75, container 1200px (`@media (min-width: 1280px) and (max-width: 1919px)`) |
| ≤1279px | **Tablet** (Figma "… — tablet 1024" frames): desktop sizes 1:1, fluid container with 32px gutters, stacked layouts |
| ≤960px | Narrow-tablet tweaks (e.g. stack 2-column card rows) |
| ≤768px | **Mobile** (Figma "… — mobile 360" frames): 16px gutters, single column |

- No `transform: scale()`, `zoom` or vw-based layout sizing.
- Blocks after the ≤768 "Interim" block are page-specific mobile blocks (FAQ, Delivery, Specifications, Product, Home). They sit after it so they take precedence.
- A `<br>` that gets hidden on smaller screens must have a space before it in the HTML (`text <br>more`), or the words run together.

## Status (Oct 2026)

| Page | Desktop/laptop | Tablet 1024 | Mobile 360 |
|---|---|---|---|
| Contact | done | done | done |
| FAQ | done | done | done |
| Delivery | done | done | done |
| Specifications | done | done | done |
| Home (index) | done | done | done |
| Product | done | done | done |
| Cart (basket) | done (Figma file `rptCUhFqDMHtSUMnjQAFHz`, node 314:1878) | done (314:2119) | done (314:2341) |
| Returns policy | done (`rptCUhFqDMHtSUMnjQAFHz`, node 309:1404) | done (309:1556) | done (309:1692) |
| Terms & conditions | done (text from 309:1825; Returns template) | done (template) | done (template) |
| Privacy policy | done (text from 309:2261; Returns template) | done (template) | done (template) |

All pages now have tablet + mobile layouts. Pages marked "todo" (none left) would rely on the **Interim** rules in `media.css` (≤960 and ≤768 blocks labelled "Interim fixes"). These only stop horizontal overflow. When a page gets its real tablet or mobile design, remove that page's interim lines.

## Shared components worth knowing

- `.page-hero` (+ `.contact-hero`, `.faq-hero`, `.delivery-hero`, `.specifications-hero`): inner-page banner. The overlay is set per page via `--hero-overlay`. On mobile the photo becomes a 180px strip at the bottom.
- `.section-title` / `.section-title--md`, `.check-list` / `.check-list--lg`, `.icon-circle` (gradient circle, `--circle` sets size), `.btn` + `--primary/--outline/--white/--ghost/--md/--lg/--xl`, `.field__input` / `--lg`, `.order-tracking` / `--lg`, `.sort` / `--sm`, `.stars` (sized star rating).
- Icons are SVG masks: `<span class="icon icon--name">`, coloured with `currentColor`, sized with `--icon-size`.
- `.dropdown` (`[data-dropdown]`, `initDropdowns`): custom listbox, toggle reuses `.sort`. Value lives in the root's `data-value`; it fires `change` on the root. Used for the Home catalog "Sort by" and the product review sort (Figma "Dropdown" 293:3914, mobile 293:4248).
- Blueprint grid background: every page wraps everything between the banner (or the header, on Product and Cart) and the footer in `<div class="page-grid">`. The grid (`grid-pattern.svg`, 48px cells) lives only on `.page-grid`, shifted down half a cell (`0 24px`, laptop `0 18px`) so it opens with vertical lines. Sections inside must stay transparent (no `background: var(--c-bg)`); blue trust strips keep their own background. Spacing under a banner goes on `.X-hero + .page-grid` (padding-top), not on the hero, so the grid always starts at the banner edge.
- Header menu button (`[data-menu-toggle]`) collapses the nav at ≤1279px. The open menu (Figma "Menu (open) — tablet 1024", 265:1500) shows 58px link rows with chevrons plus `.nav__extra` (Login + cart row, "Need help?" contacts); `.nav__extra` is hidden on desktop.
- Home catalog ≤1279px: the sidebar `aside` is `display: contents`; the filters form becomes a slide-in drawer (`initFiltersDrawer`, `[data-filters-open]` / `[data-filters-close]` / `[data-filters-backdrop]`), and the help + delivery cards move below the product grid (CSS `order`).
- The info bar's closed state is stored in sessionStorage `pm-info-bar-closed` (hidden for the current browser session only; the bar returns on the next visit). The old permanent localStorage flag is cleared on load.
- Home catalog shows 8 products before "View more" (4 at ≤768px, `INITIAL_LIMIT_MOBILE`).
- Animations: AOS attributes are set in `main.js` (`ANIMATIONS` list: selector → effect, optional stagger), not in the HTML. Call `refreshAnimations()` after content is shown/hidden/reordered. Nothing inside tabs or sliders is animated. Respects prefers-reduced-motion.
- Smooth scroll: Lenis (`initSmoothScroll`, instance on `window.PaperMartScroll`). In-page `#` links scroll below the sticky header; inner scroll areas get `data-lenis-prevent`; Lenis stops while the filters drawer is open.
- Policy pages (`returns.html`, `terms.html`, `privacy.html`): `.policy-hero` gradient banner + `.policy__card` with `.policy__section` / `.policy__list` / `.policy__note`.
- Basket page (`initBasketPage`): line items carry `data-price`; +/- and typed quantities recalculate line totals, subtotal, total and the header cart; minus at quantity 1 (or typing 0) removes the item; "Clear basket" shows the empty state and disables checkout; discount codes have no backend yet (message only). On mobile each item is a grid (thumb + info, then quantity + line total). Item options are separate spans: "·" separators on desktop, one per line on tablet.
- Cart: `window.PaperMartCart.add(item)` / `.update()`. Frontend only.
- Related-products Swiper (`initRelatedProductsSwiper`): 1 slide below 769px, 2 at 769–1279, 4 from 1280.
- Product pricing: `PRODUCT_PRICES` in `main.js`. Only the default variant (610mm · 90gsm White · 10m) has real prices.

## Content flagged to the client

- FAQ: 17 of 18 answers are draft copy (Figma had only one).
- Product reviews: 4 of 7 are placeholders.
- Product variant prices are missing apart from the default.

## How to verify (every change)

1. `python3 -m http.server 8765` in this folder (stop it afterwards: `pkill -f "http.server 8765"`).
2. In the browser (chrome-devtools MCP), measure section positions with `getBoundingClientRect` and compare them to Figma.
3. Check for horizontal overflow at 1920, 1440, 1280, 1279, 1024, 960, 769, 768, 600, 360 and 320px. Use iframes of the given width to sweep quickly, and reload with `ignoreCache` (stale CSS has caused false alarms).
4. Regression: the other pages keep the same page height at 1920/1440 and at the widths already designed, and the console has no errors (the `favicon.ico` 404 is known and harmless).
5. Report deviations from Figma honestly. Nothing is committed unless the user asks.
