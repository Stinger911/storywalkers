---
name: Narrative Path Dark
colors:
  surface: '#09141d'
  surface-dim: '#09141d'
  surface-bright: '#2f3a44'
  surface-container-lowest: '#050f18'
  surface-container-low: '#121d26'
  surface-container: '#16212a'
  surface-container-high: '#202b35'
  surface-container-highest: '#2b3640'
  on-surface: '#d8e4f0'
  on-surface-variant: '#c2c7d0'
  inverse-surface: '#d8e4f0'
  inverse-on-surface: '#27323b'
  outline: '#8c919a'
  outline-variant: '#42474f'
  surface-tint: '#9dcaff'
  primary: '#9dcaff'
  on-primary: '#003257'
  primary-container: '#6394c9'
  on-primary-container: '#002b4c'
  inverse-primary: '#2d6193'
  secondary: '#95d69d'
  on-secondary: '#003916'
  secondary-container: '#105226'
  on-secondary-container: '#84c48d'
  tertiary: '#f4bd65'
  on-tertiary: '#432c00'
  tertiary-container: '#b88835'
  on-tertiary-container: '#3b2600'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d1e4ff'
  primary-fixed-dim: '#9dcaff'
  on-primary-fixed: '#001d35'
  on-primary-fixed-variant: '#084979'
  secondary-fixed: '#b0f2b7'
  secondary-fixed-dim: '#95d69d'
  on-secondary-fixed: '#00210a'
  on-secondary-fixed-variant: '#105226'
  tertiary-fixed: '#ffdeae'
  tertiary-fixed-dim: '#f4bd65'
  on-tertiary-fixed: '#281800'
  on-tertiary-fixed-variant: '#604100'
  background: '#09141d'
  on-background: '#d8e4f0'
  surface-variant: '#2b3640'
typography:
  h1:
    fontFamily: Manrope
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h2:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  h3:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: '0'
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  label-sm:
    fontFamily: Manrope
    fontSize: 13px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin: 32px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 48px
---

## Brand & Style

This design system is built for intellectual rigor and deep focus, catering to a scholarly and professional audience. The personality is authoritative yet modern, evoking the quiet intensity of a high-end research environment or a premium digital archive. 

The aesthetic follows a **Modern Corporate** style with leanings toward **Minimalism**. By utilizing a dark, low-fatigue palette, the UI recedes into the background, allowing content—narratives, data, and scholarly insights—to take center stage. The atmosphere is calm and balanced, prioritizing clarity and structural integrity over decorative flair.

## Colors

The palette is optimized for long-form reading and data synthesis in low-light environments. The primary background is a deep, obsidian slate that provides a high-contrast base for off-white typography.

The signature blue has been desaturated and slightly lightened to `#5A8BBF` to ensure AA-level contrast against dark surfaces while maintaining its scholarly essence. The progress green is tuned for high vibrancy to act as a clear functional signal against the muted backdrop. Surfaces use subtle shifts in slate values to communicate hierarchy without the need for heavy borders.

## Typography

The design system exclusively utilizes **Manrope** to bridge the gap between geometric modernism and functional readability. 

Headlines use tighter tracking and heavier weights to command attention and establish a clear information hierarchy. Body text is set with generous line height (1.6x) to facilitate "deep reading" and reduce eye strain. Labels and small metadata utilize increased letter spacing and a semi-bold weight to ensure legibility at diminished scales against the dark background.

## Layout & Spacing

This design system employs a **Fixed Grid** philosophy for desktop environments to maintain a "manuscript" feel, centering content for maximum focus. A 12-column grid is used with a maximum container width of 1280px.

The spacing rhythm is strictly based on an 8px base unit. Generous vertical "Stack" spacing is used to separate distinct narrative sections, preventing the interface from feeling cluttered. Gutters are kept wide to provide breathing room between interactive components and textual content.

## Elevation & Depth

In this dark mode environment, depth is conveyed through **Tonal Layers** rather than heavy shadows. The background is the lowest point of the UI.
- **Level 0 (Background):** Deepest slate (#0B1218).
- **Level 1 (Cards/Surfaces):** Slightly lighter slate (#121D26).
- **Level 2 (Modals/Overlays):** Elevated slate (#1E293B) with a very subtle, 10% opacity blue-tinted ambient shadow.

This system avoids harsh white outlines, preferring soft, 1px borders in a low-contrast "Stroke" color (#2D3748) to define boundaries between surfaces.

## Shapes

The shape language is **Soft** and restrained. A 0.25rem (4px) base radius is applied to standard components like input fields and small buttons, maintaining a crisp, professional edge. Larger containers and cards utilize a 0.5rem (8px) radius to subtly signal their role as distinct content grouping elements. This balance ensures the UI feels approachable but retains its scholarly "grid-based" DNA.

## Components

### Buttons
Primary buttons use the signature blue (#5A8BBF) with off-white text. Hover states transition to the brighter blue (#3B82F6) with a subtle glow effect. Ghost buttons use the secondary text color for borders and labels, shifting to full opacity on hover.

### Cards
Cards are the primary container for information. They feature a #121D26 fill and a 1px #2D3748 border. On hover, the border color should subtly shift toward the primary blue to indicate interactivity.

### Inputs
Fields are dark-filled with a subtle bottom border or a full-perimeter low-contrast stroke. The focus state must be clearly indicated by the primary blue color and a 2px stroke.

### Progress & Indicators
Linear progress bars use a dark track with a vibrant green (#6BAA75) fill. This green should also be used for "Success" states and completion badges to provide a refreshing visual "reward" against the dark UI.

### Chips & Tags
Tags are used for categorization. They should feature a desaturated background (10% opacity of the primary blue) and a high-contrast label to remain legible without distracting from the main narrative flow.