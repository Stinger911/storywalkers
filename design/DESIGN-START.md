# Design system: pre-registration onboarding (`/start/*`)

Derived from the exported Figma frames in `design/figma/` (`s1`–`s5`, `elements`) and from
`frontend/src/routes/start/startTheme.css`. Machine-readable tokens: `design/figma/tokens.json`;
CSS custom properties: `design/figma/start.tokens.css`.

Scope: the five onboarding steps rendered by `StartLayout.tsx` (topic → goal → plan → payment) —
everything under `.start-theme`. The rest of the app keeps the token layer of `src/App.css`
(`DESIGN.md` / `DESIGN-DARK.md`); this system deliberately does not touch it, and the onboarding is
the one place in the product where the visual language is allowed to differ.

## 1. Creative direction

Hand-drawn, "sticker on paper": a white page, a black 2px outline around the main card, a halftone
dot strip glued underneath it as the shadow, dashed chips for the stepper, an orange→red gradient
reserved for commitment actions, and line-art illustration carrying the emotion. Text is either
black or the brand red — never grey-on-grey decoration. The right rail is a "field notes" card:
an orange gradient block with label/value pairs, then a white quote card with a taped-on pin.

Rules that follow from that, and that the frames show consistently:

1. **One accent pair only** — `#e95002 → #d91617`. Gradients are for primary actions, the rail card
   and inline callouts; nothing else gets colour.
2. **No soft shadows on surfaces.** Depth is either a 2px ink outline or the halftone dot strip.
   Blur shadows exist only under the primary button and the open dropdown.
3. **Dashed = unvisited, solid = current.** The stepper and the connector lines encode progress this way.
4. **Everything is round-cornered but not pill-shaped**, except actions — chips/tiles/inputs 6px,
   cards 21–24px, buttons fully round.
5. **Illustration is line art, 1–2px strokes, red accents only.** It is content, not decoration:
   each step's drawing names the step.

## 2. Colour

Values measured on the exported frames; contrast ratios are computed, not estimated.

| Token | Value | Where it appears | Contrast |
|---|---|---|---|
| `--st-ink` | `#000000` | card outline, headings, primary text | 21.0:1 on white |
| `--st-ink-soft` | `#606060` | lead paragraphs | 6.29:1 on white |
| `--st-muted` | `#8a8a8a` | placeholders, summary labels | 3.45:1 — placeholders only, never body text |
| `--st-red` | `#d91617` | headings, gradient end, errors | 5.15:1 on white |
| `--st-orange` | `#e95002` | gradient start | 3.74:1 with white — see §9 |
| `--st-red-stroke` | `#de3234` | 1px stroke of selected chips and tiles | 3.84:1 on `--st-red-soft` |
| `--st-red-soft` | `#fbe7e7` | selected fill, "Итого" row, secondary answer tile | — |
| `--st-line` | `#dbdbdb` | inputs, tiles, dropdown, summary rows | — |
| `--st-surface-subtle` | `#f9f9f9` | idle chip / idle tile fill | — |
| `--st-surface-disabled` | `#ececec` | disabled controls | — |
| `--st-halftone-colour` | `#bcbcbc` | dot strip under cards | decoration |

Gradients (measured by sampling opposite edges of each element):

| Token | Value | Element |
|---|---|---|
| `--st-grad` | `linear-gradient(90deg, #e95002, #d91617)` | primary button, inline callout |
| `--st-grad-vertical` | `linear-gradient(180deg, #e95102, #dd2412)` | right-rail brand card |
| `--st-grad-hover` | `linear-gradient(90deg, #f0510a, #cf1518)` | primary hover |
| `--st-grad-disabled` | `linear-gradient(90deg, #b9b9b9, #7c7c7c)` | disabled primary |

## 3. Typography

Two families, no third: **Unbounded** for display (headings, buttons, chips — uppercase), **Inter**
for body, labels inside controls and form values. Weights: 600 for display, 400/500/700 for body.

| Role | Size | Weight | Tracking | Notes |
|---|---|---|---|---|
| Heading large | 24px | 600 | +0.01em | red, centred, line-height 1.25 (cap height measured 17px) |
| Heading medium | 20px | 600 | +0.01em | section titles inside a step ("Оплата", "Что дальше?") |
| Body | 16px | 400 | 0 | line-height 1.55, black |
| Body soft | 16px | 400 | 0 | `--st-ink-soft`, lead paragraphs |
| Label | 11px | 600 | +0.10em | uppercase — stepper, summary labels, eyebrows |
| Button | 12px | 600 | +0.06em | uppercase |
| Button small | 10.5px | 600 | 0 | sentence case, inside dense rows |

No letter-spacing below 0 on body text; the display face is never used below 13px.

## 4. Space and rhythm

8pt grid with a 4px half-step: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.

Vertical rhythm measured inside the card on `s1.png` (1440px frame):

```
card top padding      56px
stepper → illustration 64px
illustration → heading 32px
heading → lead         12px
lead → answer tiles    26px
tiles → primary CTA    24px
CTA → card bottom      48px
```

Layout: main card 852px inner width, right rail 367px, 40px gutter, 56px frame padding. Below
`lg` the rail moves under the card and the card loses its outline (it becomes a full-bleed column).

## 5. Shape and elevation

| Token | Value | Applies to |
|---|---|---|
| `--st-radius-chip` | 6px | stepper chip, tiles, inputs, select, summary rows, course cards |
| `--st-radius-card` | 21px | main card (measured on the 1440 frame) |
| `--st-radius-rail` | 24px | right-rail cards |
| `--st-radius-pill` | 999px | primary and secondary buttons |
| `--st-radius-check` | 3px | checkbox |
| `--st-card-border` | 2px solid `--st-ink` | main card only |

Elevation is the halftone strip, not a shadow:

```css
.st-card::after {
  content: "";
  position: absolute; z-index: -1;
  inset: auto 6px -9px 6px; height: 22px;
  border-radius: 0 0 30px 30px;
  background-image: radial-gradient(var(--st-halftone-colour) 0.7px, transparent 0.8px);
  background-size: 3px 3px;
}
```

The only blur shadows: `--st-shadow-cta` under the primary button and
`--st-shadow-dropdown` under an open select list.

## 6. Components

Component inventory of `elements.png` (a single reference board: 4 buttons × 4 states, checkbox,
selection tiles × 3 states, dropdown closed/open, text field × 4 states) with the class that
implements it today.

| Component | Class | Geometry | States |
|---|---|---|---|
| Primary button | `.st-btn .st-btn-primary` | h 50px, pill, gradient 90° | hover (brighter gradient, deeper glow), pressed (`translateY(1px)`, no shadow), disabled (grey gradient, `#e6e6e6` label) |
| Secondary button | `.st-btn .st-btn-secondary` | h 50px, pill, white + 1px `#f08a5d` | hover (stroke and label go `--st-red`), pressed, disabled (`#dcdcdc` stroke) |
| Small button | `.st-btn .st-btn-small` | h 28px, 6px radius, `#f4f4f4` | `aria-pressed` → soft red |
| Stepper chip | `.st-step` | h 37px, 6px radius, 1px dashed | idle (`#f9f9f9` + dashed `--st-line`), current (solid `--st-red-stroke` on `--st-red-soft`, weight 700), done (same fill, weight 600), connector `.st-step-link` dashed → solid when reached |
| Selection tile | `.st-option` | h 50px, 6px radius | idle, hover (stroke `--st-red-stroke`), selected (`aria-pressed="true"`), disabled |
| Text field | `.st-field` | h 50px, 6px radius, white | idle, focus (stroke ink), filled, error (`aria-invalid="true"`: stroke `--st-red-stroke`, text `--st-red`), placeholder italic `--st-muted` |
| Checkbox | `.st-check` | 16px, 3px radius | unchecked (1px `#9a9a9a`), checked (`--st-orange` fill + white tick) |
| Select | `.st-select-trigger`, `.st-select-list`, `.st-select-item` | as text field | closed, open (bottom radii 0, list shares the border, max-height 168px), item highlighted (soft red) |
| Summary row | `.st-row`, `.st-summary-label`, `.st-summary-value` | 6px radius, 1px `--st-line` | empty (`-`), filled (uppercase value optional) |
| Inline callout | — (`s5` congratulation block) | 6px radius, gradient 90°, white text | static |
| Rail brand card | — | 24px radius, **vertical** gradient, 1px white hairlines between label/value pairs | static |
| Rail quote card | `.st-quote` | 24px radius, white, 2px ink outline, tape/pin decoration, 6px pagination dots | swipe or drag, dots, arrow keys; new quote slides in from the swipe side; changes by itself every 5.2s, paused on hover and drag, off with reduced motion |

Missing from the implementation, present in the frames: the inline callout, the rail quote card,
the pressed state of the primary button (implemented, undocumented), and the dropdown's
"open" corner merge (implemented via `[aria-expanded="true"]`).

## 7. Motion

| Token | Value |
|---|---|
| `--st-motion-fast` | 150ms `ease` — hover, colour and stroke changes |
| `--st-motion-enter` | 350ms `ease-out`, from `translateY(8px)` + opacity 0 — step content |
| value update | 300ms `ease-out`, from `translateX(-6px)` — summary values filling in |
| press | `translateY(1px)` on buttons, `scale(0.99)` on tiles |

`prefers-reduced-motion: reduce` turns every transition and the enter animation off. No parallax,
no bounce, no spring.

## 8. Accessibility findings (computed)

| Pair | Ratio | Verdict |
|---|---|---|
| ink `#000000` on white | 21.0:1 | fine |
| lead `#606060` on white | 6.29:1 | fine |
| red heading `#d91617` on white | 5.15:1 | fine for large and body text |
| white on gradient orange `#e95002` | 3.74:1 | **passes only for large/bold text** — button labels are 12px 600, so keep the gradient flowing left→right with the label centred and rely on the red half, or darken the start to `#dd4a06` if it must be AA at small size |
| muted `#8a8a8a` on white | 3.45:1 | placeholders only, never body text |
| selected stroke `#de3234` on `#fbe7e7` | 3.84:1 | fine as a non-text indicator (≥3:1) |
| disabled label on disabled fill | 1.57–1.84:1 | intentional; disabled controls are exempt |

Focus: 2px `--st-red-stroke` outline with 2px offset on every interactive control (already in
`startTheme.css`). The onboarding must be usable with keyboard only — tab order follows the visual
order, tiles behave as `aria-pressed` buttons, the select is Kobalte's listbox.

## 9. Divergences between the frames and the current implementation

Fix these when touching the file; the tokens above are the target values.

| Item | Frames | `startTheme.css` today |
|---|---|---|
| Brand orange | `#e95002` | `#ea580c` |
| Gradient direction | 90° for buttons, **180°** for the rail card | 95° everywhere, one token |
| Card radius | 21px | 32px |
| Card outline | 2px `#000000` | 1.5px `var(--st-ink)` = `#111111` |
| Page/surface | `#ffffff` | `#ffffff` page, `#fafafa` surface token |
| Ink | `#000000` | `#111111` |
| Stepper idle fill | `#f9f9f9` | `#f4f4f4` |
| Heading size | 24px | 1.35rem (21.6px) |
| Button label | 12px | 0.75rem (12px) ✔ |
| Control height | 50px | 50px ✔ |

## 10. Adopting the tokens

1. Replace the literal block at the top of `frontend/src/routes/start/startTheme.css` with an
   `@import "./start.tokens.css"` (or paste `design/figma/start.tokens.css` in place of the current
   `.start-theme { --st-* }` block).
2. Sweep the remaining literals in that file (`#f4f4f4`, `#e3e3e3`, `#b0b0b0`, `#f08a5d`, `#9a9a9a`,
   `#b9b9b9`, `#7c7c7c`, `#fff8f8`, `#f3c58c`, `#fff6e8`) onto the matching `--st-*` token; two of
   them (`.st-notice`) are not in the frames and should either be added to the system or removed.
3. Keep `.st-halftone` (in `start.tokens.css`) as the single implementation of the dot strip and
   delete the duplicated `::after` rules that grow in page components.

## 11. What this system does not cover

- The signed-in app (`/app/*`) and the vault-side marketing pages: those follow `DESIGN.md` /
  `DESIGN-DARK.md` and the `src/App.css` token set.
- Motion assets: the ten `.mp4` illustrations in `frontend/public/start/anim/` are referenced by
  filename only — they are not design tokens.
- Icons: the Figma frame «иконки» was never exported; `StartTopic.tsx` renders emoji stand-ins and
  expects `frontend/public/start/icons/<slug>.svg`.
- Mobile: the frames are desktop only. The breakpoint behaviour (`lg` split, rail moving under the
  card) is implementation-defined and needs a designed mobile frame before it can be specified.
