# Design System Strategy: The Curated Workspace

## 1. Overview & Creative North Star
The "Creative North Star" for this design system is **The Curated Workspace**. 

In the realm of HRIS, data is often cold and overwhelming. This system rejects the "industrial" look of traditional enterprise software. Instead, it adopts an editorial, high-end aesthetic that treats employee data with dignity and clarity. By utilizing intentional asymmetry, varying typographic scales, and deep tonal layering, we move away from "dashboard templates" toward a bespoke digital environment that feels like a premium workspace.

The goal is to create a UI that breathes. We prioritize white space over lines, and depth over borders, ensuring that complex HR tasks feel intuitive and human-centric.

---

## 2. Colors & Tonal Architecture
The palette is built on a foundation of sophisticated purples and balanced neutrals, designed to guide the eye without causing visual fatigue.

### Core Palette
- **Primary (`#5341cd`):** Use for high-impact actions and brand presence.
- **Primary Container (`#6c5ce7`):** Use for subtle backgrounds of primary elements or hover states.
- **Secondary (`#5952af`):** Use for auxiliary branding and structural highlights.
- **Surface & Background (`#f8f9fd`):** The canvas. A soft, cool neutral that reduces glare.

### The "No-Line" Rule
Standard UI relies on 1px borders to separate content. **In this design system, 1px solid borders for sectioning are prohibited.** 
Boundaries must be defined through:
1. **Background Color Shifts:** Use `surface_container_low` (`#f2f3f7`) for the main canvas and `surface_container_lowest` (`#ffffff`) for cards.
2. **Tonal Transitions:** A section change is signaled by a shift from `surface` to `surface_container`.

### The "Glass & Gradient" Rule
To elevate the experience, use **Glassmorphism** for floating elements like modals or dropdowns. 
- **Effect:** Apply `surface` color at 80% opacity with a `20px` backdrop blur.
- **Signature Texture:** For primary CTAs, apply a subtle linear gradient from `primary` (`#5341cd`) to `primary_container` (`#6c5ce7`) at a 135-degree angle. This adds a "soul" to the buttons that flat colors lack.

---

## 3. Typography
We utilize a pairing of **Manrope** for display and **Inter** for utility.

| Level | Token | Font | Size | Character |
| :--- | :--- | :--- | :--- | :--- |
| **Display** | `display-lg` | Manrope | 3.5rem | Bold, Editorial impact |
| **Headline** | `headline-md` | Manrope | 1.75rem | Authoritative, section headers |
| **Title** | `title-lg` | Inter | 1.375rem | Strong card titles |
| **Body** | `body-md` | Inter | 0.875rem | Data and descriptions |
| **Label** | `label-sm` | Inter | 0.6875rem | Metadata and tiny captions |

**Editorial Intent:** Use `display-lg` sparingly to highlight key metrics (e.g., "Total Headcount"). The contrast between the large, expressive Manrope and the functional Inter creates an "Executive Summary" feel.

---

## 4. Elevation & Depth
Hierarchy is achieved through **Tonal Layering** rather than structural lines.

- **The Layering Principle:** 
  - Level 0: `background` (`#f8f9fd`)
  - Level 1: `surface_container_low` (`#f2f3f7`) for large layout blocks.
  - Level 2: `surface_container_lowest` (`#ffffff`) for individual cards.
- **Ambient Shadows:** When an element must "float" (like a sidebar or a modal), use a shadow tinted with the `on-surface` color: `rgba(25, 28, 31, 0.06)` with a `32px` blur and `8px` Y-offset.
- **The "Ghost Border":** If accessibility requires a container boundary, use `outline_variant` (`#c8c4d7`) at **15% opacity**. Never use 100% opaque borders.

---

## 5. Desktop-Specific Components

### Side Navigation
- **Style:** A vertical bar using the Glassmorphism rule or `surface_container_low`.
- **Interaction:** Active states should use a pill-shaped background (`primary_fixed`) with `on_primary_fixed` text. Do not use vertical indicator lines.

### Data Tables
- **Execution:** Forbid the use of vertical and horizontal divider lines. 
- **Structure:** Use `body-md` for row text. Every second row should have a subtle background shift to `surface_container_lowest` to maintain readability.
- **Header:** Use `label-md` in `on_surface_variant` with increased letter spacing for an architectural feel.

### Statistical Widgets
- **Layout:** Use asymmetric layouts within cards. Place the primary metric (`display-sm`) in the top left and the trend indicator (`label-md` with status colors) in the bottom right.
- **Depth:** Nested stats should sit on a `surface_container_high` background to create a "recessed" look.

### Buttons & Inputs
- **Buttons:** All buttons use a `DEFAULT` (0.5rem) or `full` (pill) roundedness. Primary buttons use the signature gradient.
- **Input Fields:** Use `surface_container_highest` for the field background with a "Ghost Border" that becomes `primary` only on focus.

---

## 6. Do's and Don'ts

### Do
- **Do** use generous white space. If a section feels crowded, increase padding using the `xl` (1.5rem) spacing scale.
- **Do** use color to indicate status. Use `error` (`#ba1a1a`) for high-priority alerts, but wrap it in `error_container` (`#ffdad6`) to soften the impact.
- **Do** treat "Empty States" as editorial moments. Use large typography and soft icons to guide the user.

### Don't
- **Don't** use pure black (`#000000`) for text. Always use `on_surface` (`#191c1f`) for a softer, premium contrast.
- **Don't** use standard 1px borders. If you feel the need for a line, try a background color change first.
- **Don't** use high-saturation shadows. If the shadow is visible as a "grey smudge," it is too heavy. It should feel like a soft glow.