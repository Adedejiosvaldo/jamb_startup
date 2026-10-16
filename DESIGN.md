# ScoreCoach design language — "premium modern"

Rules for every surface (student app, parent pages, teacher, staff console). Agents: read this and
`.claude/skills/baseline-ui` + `.claude/skills/fixing-accessibility` before UI work. The founder explicitly asked
for gradients and a premium dark look, so single-hue emerald gradients are allowed (never purple, never multicolour,
never as the only affordance).

## Feel

Dark, calm, expensive. Big numbers, few words. One accent (emerald). Glassy cards with hairline borders. Decorative
glow only behind hero areas. Everything still works on a ₦60k Android with weak data.

## Tokens (`apps/web/src/app/globals.css` → `@theme`)

Use semantic utilities, never raw palette colours for surfaces/text:

| Token                                             | Use                                              |
| ------------------------------------------------- | ------------------------------------------------ |
| `bg-canvas`                                       | page background (#09090b)                        |
| `bg-surface` / `-2` / `-3`                        | raised surfaces, dialogs, inputs                 |
| `glass` utility + `border-line`                   | cards (translucent gradient + top highlight)     |
| `border-line` / `-strong`                         | hairlines (white 8% / 14%)                       |
| `text-fg` / `fg-2` / `muted` / `faint`            | text hierarchy (never below `muted` for content) |
| `text-accent`, `bg-accent-soft`, `text-on-accent` | the one accent                                   |
| `bg-glow`, `bg-grid`, `text-gradient`             | hero decoration only                             |

Status: emerald (good), amber (attention), red (error) at `/10` backgrounds with `-300` text. Always pair colour with
words or icons. Printing (school reports) flips the tokens to light automatically.

## Type

Geist Sans + Geist Mono (self-hosted via `next/font`, no runtime font requests). Page titles `text-3xl font-semibold`,
hero `text-5xl/6xl` with `text-gradient`. Headings `text-balance`, body `text-pretty`, all numbers `tabular-nums`.
Short copy: one sentence where there were three.

## Shape & layout

- Radius: `rounded-xl` controls, `rounded-2xl` rows/tiles, `rounded-3xl` hero cards.
- Student app: single column `max-w-2xl`, glass sticky header, floating tab bar (safe-area aware).
- Marketing: `max-w-5xl`, bento grids. Staff: sidebar + `max-w-7xl`.
- Tap targets ≥ 44px. `min-h-dvh`, never `h-screen`. Fixed z-scale: 10 bars, 20 popovers, 30 dialogs, 40 toasts.

## Components (`apps/web/src/components`)

- `Button` — `primary` (emerald gradient, one per view), `secondary` (glass outline), `ghost`, `danger`.
- `Field` / `SelectField` / `TextareaField` — labelled, `aria-describedby` hint/error, focus ring.
- `Card`, `Alert`, `Badge` (pill), `Choice` (big radio/checkbox cards), `Dialog`/`ConfirmDialog` (Base UI; bottom sheet
  on phones), `Skeleton`, `Empty` (always one next action).
- `ScoreRing` — the signature gauge: predicted score, likely range band, target tick.

## Motion

Only colour/opacity transitions ≤ 150ms on hover/press. No entrance animations. Respect reduced motion.

## CBT screen

Mirrors the JAMB layout: subject tabs, question, A–D options, navigator grid, countdown, Previous/Flag/Next. Keys:
A–D, N, P, S. State uses fill + icon, not colour alone.

## Copy

Plain, warm, short, second person, Nigerian English. Never "guaranteed score". "Not affiliated with JAMB" in the
footer.
