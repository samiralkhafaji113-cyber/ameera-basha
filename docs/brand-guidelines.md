# Brand Guidelines v1.0 – مجمع أميرة باشا / Ameera Basha Complex

> Last updated: 2026-09-20
> Status: Derived from the OFFICIAL logo supplied by the owner (`brand-source/official-logo-original.jpg`)

## Quick Reference

| Element | Value |
|---------|-------|
| Primary Color | #050505 |
| Secondary Color | #44403C |
| Primary Font | Noto Kufi Arabic |
| Voice | Warm, Respectful, Direct |

---

## 0. Brand Analysis (from the official logo)

| Aspect | Finding (measured on the 640×640 JPG) |
|---|---|
| Structure | Vertical lockup, centred: monogram **AB** on top → «AMEERA BASHA» (Latin caps) → «اميرة باشا» (Arabic). |
| Monogram | A and B share one vertical stem; A = sharp triangle with a horizontal bar, B = two round bowls. Uniform thin stroke (~5px at 640px). |
| Proportions | Ink box 245×336 px. Mark ≈ 240 px tall (71%), Latin line 26 px, Arabic line 32 px; text lines are as wide as the mark. |
| Colour | Monochrome: ink **#050505** (measured average RGB 5,5,5) on **#FFFFFF**. No secondary/accent colour in the logo. |
| Lettering | Latin: light, humanist/geometric sans caps with wide tracking. Arabic: thin mono-line letters with kashida elongation (modern, Kufi-like). |
| Shape language | Geometric, linear, architectural: straight strokes + one generous curve. Thin, airy, precise. |
| Personality | Refined, modern, calm, premium-but-clean; gender-neutral enough for a family store. |
| Only orientation supplied | Vertical. No horizontal lockup exists – none was created. |

### Recommended UI treatment (applied on the site)
- **Buttons:** solid ink (#050505) with white text, 10px radius; secondary = 1px outline; WhatsApp = accessible green (#15803D) only for messaging actions.
- **Cards:** white surface, 1px hairline border, 16px radius, very soft shadow (Soft UI Evolution) – no heavy gradients.
- **Imagery:** real product/store photos on neutral sand (#F5EEE4) backgrounds, `object-cover`, no filters, arch-top crop only for the hero.
- **Line weight:** hairlines (1px) for dividers to echo the logo's thin strokes; gold (#A16207, from the storefront glow) only as a small accent, never as a fill for large areas.
- **Typography:** Noto Kufi Arabic (geometric mono-line, echoes the logo's Arabic) for headings; Noto Sans Arabic for body/prices.

---

## 1. Color Palette

### Primary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Logo Ink | #050505 | rgb(5,5,5) | Buttons, headings on light, footer/delivery background |
| Ink Hover | #292524 | rgb(41,37,36) | Hover of ink surfaces |

### Secondary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Warm Stone | #44403C | rgb(68,64,60) | Secondary text, secondary surfaces |
| Storefront Gold | #A16207 | rgb(161,98,7) | Small accents, search button, underline of active nav (text-safe variant #854D0E) |

### Neutral Palette

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Background | #FAFAF9 | rgb(250,250,249) | Page background |
| Surface | #FFFFFF | rgb(255,255,255) | Cards (logo paper) |
| Warm Surface | #F5EEE4 | rgb(245,238,228) | Image placeholders, chips |
| Text Primary | #0C0A09 | rgb(12,10,9) | Body text |
| Text Secondary | #57534E | rgb(87,83,78) | Captions, muted text |
| Border | #D6D3D1 | rgb(214,211,209) | Dividers, controls |

### Semantic Colors

| State | Hex | Usage |
|-------|-----|-------|
| Success | #15803D | Availability, confirmations, WhatsApp |
| Warning | #B45309 | Cautions |
| Error | #B91C1C | Validation errors |

### Accessibility

- Ink on white: 20.4:1 (AAA). Muted text on background: 7.4:1 (AAA).
- Gold text variant #854D0E on sand/white: ≥ 5.9:1 (AA). White on #15803D: 5.0:1 (AA).

---

## 2. Typography

```css
--font-heading: 'Noto Kufi Arabic', 'Segoe UI', Tahoma, sans-serif;
--font-body: 'Noto Sans Arabic', 'Segoe UI', Tahoma, system-ui, sans-serif;
```

| Element | Size (Desktop) | Size (Mobile) | Weight | Line Height |
|---------|----------------|---------------|--------|-------------|
| H1 | 48px | 28px | 700 | 1.4 |
| H2 | 36px | 24px | 700 | 1.45 |
| H3 | 18px | 18px | 700 | 1.55 |
| Body | 16px | 16px | 400 | 1.75 |

---

## 3. Logo usage

- **Official file:** `brand-source/official-logo-original.jpg` (unchanged copy in `public/brand/`). Low resolution (245px-wide artwork) – do not display the lockup wider than ~130 CSS px on standard screens; request the owner's vector/high-res file for print or large hero use.
- **Technical variants** (crop + luminance→alpha only): `logo-lockup-black.png` (light backgrounds), `logo-lockup-white.png` (dark backgrounds), `logo-mark-black/white.png` (AB monogram only, official crop), favicons and OG card built from the mark.
- **Never:** redraw, recolour, re-proportion, add effects, replace with the earlier concept, or set new lettering beside it as a "horizontal logo".
- **Clear space:** at least the height of the "A" crossbar-to-baseline gap (~PAD 16px at source scale) on every side.

---

## 4. Voice

Warm, respectful, direct – short Arabic sentences with clear verbs («احجز»، «استفسر»، «تواصل معنا»). No unverified claims (cheapest, best, #1, customer counts, reviews, awards, opening hours).
