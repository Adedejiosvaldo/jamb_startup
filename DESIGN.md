# ScoreCoach design language

Product UI rules for every surface (student app, parent pages, admin). Agents: read this file and
`.claude/skills/baseline-ui` + `.claude/skills/fixing-accessibility` before UI work.

## Who we design for

- Students 16–21 on ₦60k Android phones (360×740, 2–3 GB RAM), slow or metered data, often outdoors.
- Parents who are not tech-savvy and arrive from a WhatsApp link.
- School-lab PCs with mouse and keyboard (CBT practice must feel like the real exam).

## Principles

1. **Calm and honest.** An exam is stressful. No confetti, no hype, no fake urgency. Bad news (a low
   predicted score) is stated plainly, followed by the next action.
2. **One next action per screen.** Every view has one primary button. Empty states say what to do.
3. **Light by default.** System fonts, no remote fonts, no images on core flows, icons as inline SVG
   (lucide). First load < 500 KB, app shell < 300 KB gzipped.
4. **Readable at arm's length in sunlight.** Body 16 px minimum, strong contrast, no light-grey text
   for anything important.

## Tokens (Tailwind defaults only)

| Role                  | Value                                                              |
| --------------------- | ------------------------------------------------------------------ |
| Accent (one per view) | `teal-700` (hover `teal-800`, tint `teal-50`)                      |
| Text                  | `slate-900`; secondary `slate-600`; never lighter than `slate-500` |
| Surfaces              | `white`; muted `slate-50`; borders `slate-200`                     |
| Danger                | `red-700` on `red-50`                                              |
| Warning               | `amber-800` on `amber-50`                                          |
| Success               | `green-700` on `green-50`                                          |
| Radius                | `rounded-lg` controls, `rounded-xl` cards                          |
| Shadow                | none on cards (borders instead); `shadow-lg` only on overlays      |
| Z-index scale         | `z-10` sticky bars, `z-20` popovers, `z-30` dialogs, `z-40` toasts |

Mastery and score status always pair colour with a text label ("Weak", "Getting there", "Strong") so
meaning never relies on colour alone.

## Typography

- System UI stack. Sizes: `text-sm` meta, `text-base` body, `text-lg` lead, `text-2xl` page title,
  `text-4xl` hero numbers (predicted score).
- Headings `text-balance`; paragraphs `text-pretty`; all numbers, timers and scores `tabular-nums`.
- Do not change letter-spacing.

## Layout

- Mobile first, single column, `max-w-2xl` content width (`max-w-6xl` admin).
- Page gutter `px-4`. Vertical rhythm in steps of 4 (`gap-4`, `space-y-6`, `py-8`).
- Use `min-h-dvh`, never `h-screen`. Fixed bars respect `env(safe-area-inset-bottom)`.
- Tap targets ≥ 44 px (`min-h-11`).

## Components

Shared primitives live in `apps/web/src/components/ui`. Use them before writing new markup.

- `Button` — variants `primary` (accent, one per view), `secondary` (bordered), `ghost`, `danger`.
- `Field` — label, input, hint and error wired with `aria-describedby` / `aria-invalid`.
- `Card` — bordered white surface, `rounded-xl p-4`.
- `Alert` — inline message next to the action that caused it (`role="alert"` for errors).
- `Dialog` / `AlertDialog` — Base UI (`@base-ui/react`). AlertDialog for anything destructive.
- `Skeleton` — structural loading placeholders, not spinners, for page loads.

## Motion

None by default. Interaction feedback ≤ 200 ms, `transform`/`opacity` only, and disabled under
`prefers-reduced-motion`. No gradients, glows, or blur surfaces.

## CBT screen

Mirrors the real JAMB layout: subject tabs on top, question + options in the centre, numbered
navigator grid, countdown timer always visible (`tabular-nums`), Previous / Next / Submit. Keyboard:
A–D choose, N next, P previous, S submit (confirm dialog). Answered, unanswered and flagged states in
the grid use shape/label as well as colour.

## Copy

Plain, warm, short. Second person. Nigerian English. Never "guaranteed score". Always "not affiliated
with JAMB" in the footer.
