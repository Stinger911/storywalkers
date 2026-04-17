# The Design System: Editorial Sophistication for StoryWalkers

## 1. Overview & Creative North Star: "The Modern Archivist"
This design system is built upon the Creative North Star of **"The Modern Archivist."** It moves away from the clinical, "boxed-in" feel of standard SaaS platforms and moves toward an editorial, high-end digital publication aesthetic. 

The goal is to facilitate storytelling through a sense of **Breathable Authority**. We achieve this by prioritizing intentional white space, breaking the traditional rigid grid with asymmetrical content clusters, and utilizing "Tonal Layering" rather than structural lines. The experience should feel like flipping through a premium architectural magazine—clean, intentional, and quiet.

---

### 2. Colors & Surface Philosophy
The palette is grounded in slate-blues and organic off-whites to provide a sophisticated backdrop for narrative content.

**The "No-Line" Rule:**
Borders are a relic of low-resolution interfaces. In this system, 1px solid borders are prohibited for sectioning. Boundaries must be defined solely through background color shifts or subtle tonal transitions. 

**Surface Hierarchy & Nesting:**
Instead of a flat grid, treat the UI as a series of physical layers.
- **Base Layer:** `surface` (#f7f9ff) / `background` (#f7f9ff).
- **Secondary Sectioning:** `surface-container-low` (#edf4ff).
- **Primary Content Containers:** `surface-container-lowest` (#ffffff).
- **Interactive Floating Elements:** Use `surface-bright` (#f7f9ff) with a backdrop blur.

**The "Glass & Gradient" Rule:**
For hero sections and primary CTAs, do not use flat hex codes. Apply a subtle linear gradient from `primary` (#2f5f8d) to `primary_container` (#4a78a7) at a 135-degree angle. This adds "visual soul" and depth that prevents the UI from feeling "templated."

---

### 3. Typography: The Editorial Scale
We use **Manrope** for its geometric clarity and modern professional tone. The hierarchy is designed to create an authoritative "Editorial" flow.

- **Display (lg/md/sm):** Used for "Hero" moments. Tighten letter-spacing by -0.02em to create a bespoke, high-end feel.
- **Headline (lg/md/sm):** Reserved for section headers. These should often be paired with a `label-md` "kicker" above them in `secondary` color for an editorial look.
- **Title (lg/md/sm):** Used for card headings and navigational elements.
- **Body (lg/md/sm):** The workhorse. `body-lg` (1rem) is our standard for readability. Use `on_surface_variant` (#42474f) for secondary body text to maintain a soft contrast ratio.
- **Labels (md/sm):** Always uppercase with +0.05em letter spacing when used for metadata or category tags.

---

### 4. Elevation & Depth: Tonal Layering
This system rejects "shadow-heavy" design. We convey hierarchy through stacking rather than lifting.

- **The Layering Principle:** Place a `surface-container-lowest` (#ffffff) card on top of a `surface-container-low` (#edf4ff) background. The delta in luminance creates a natural edge without the need for a stroke.
- **Ambient Shadows:** If an element must "float" (e.g., a modal or a primary FAB), use a custom shadow: `0px 20px 40px rgba(18, 29, 38, 0.05)`. Notice the shadow color is a tinted version of `on-surface`, not pure black.
- **The "Ghost Border" Fallback:** If accessibility requires a container edge, use a "Ghost Border": `outline_variant` (#c2c7d0) at **15% opacity**.
- **Glassmorphism:** Use for navigation bars and hovering utility panels. 
  - *Recipe:* `background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(12px);`

---

### 5. Components: Refined Primitives

**Buttons:**
- **Primary:** Gradient fill (`primary` to `primary_container`). `xl` (0.75rem) roundedness. No border.
- **Secondary:** `surface-container-high` fill with `primary` text.
- **Tertiary:** Pure text with an underline appearing only on hover.

**Cards & Lists:**
- **Forbid Divider Lines.** To separate list items, use increased vertical white space (32px or 48px) or a alternating subtle background shift using `surface-container-lowest` and `surface-container-low`.
- **Story Cards:** Use asymmetrical padding (e.g., more padding at the bottom than the top) to create a custom, "curated" look.

**Input Fields:**
- Avoid "box" inputs. Use a "Soft Tray" approach: a `surface-container-highest` background with a `md` (0.375rem) corner radius. The label should sit 8px above the tray in `label-md`.

**The "Progress Path":**
- For progress bars, use `tertiary` (#2a683a). Instead of a simple solid bar, use a segmented bar with 4px gaps between segments to represent "steps" in a journey, reflecting the "Walker" theme.

---

### 6. Do’s and Don’ts

**Do:**
- **Do** use "Inertia" in transitions. All hover states should have a 300ms ease-out duration.
- **Do** use `secondary` (#0058be) for interactive text/links to clearly distinguish them from static `primary_text`.
- **Do** leverage "Negative Space" as a design element. If a layout feels crowded, remove a container rather than shrinking the text.

**Don't:**
- **Don’t** use 100% black (#000000). Always use `on_background` (#121d26) for depth.
- **Don’t** use standard "Drop Shadows" from component libraries. They look "cheap" and break the editorial aesthetic.
- **Don’t** use dividers between cards. Let the `surface` color shifts define the content blocks.
- **Don't** use sharp corners. Stick strictly to the `lg` (0.5rem) or `xl` (0.75rem) tokens to keep the interface feeling approachable and high-end.