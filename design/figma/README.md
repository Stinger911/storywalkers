# Figma reference frames — pre-registration onboarding (`/start/*`)

These frames are the source of the design system for the onboarding:
`design/DESIGN-START.md` (spec), `design/figma/tokens.json` (tokens) and
`design/figma/start.tokens.css` (drop-in CSS custom properties).

Screenshots pulled from Figma on 2026-11-17 with the Figma MCP connector while the
`frontend/src/routes/start/**` onboarding was rebuilt. They are the source the values in
`frontend/src/routes/start/startTheme.css` were measured from ("Values were measured from Figma
screenshots") and the reference for the layouts in `StartLayout.tsx`, `StartTopic.tsx`,
`StartChannel.tsx`, `StartGoal.tsx`, `StartPlan.tsx`.

Figma files:

- `1LOfrhVsf10oVdmiMNQqOa` — original design
- `BNvBqw0d9jFJhFVCKgVkuS` — "Storywalkers (Copy)", read-only reference used for the screenshots

| File | Figma node | Size | What it is |
|---|---|---|---|
| `s1.png` | `308:34` | 1440×951 | step 1, first frame (`s1`) |
| `s1_2.png` | `347:2` | 1440×1107 | step 1, second frame (`s1_2`) |
| `s2.png` | `308:2604` | 1440×961 | step 2 (`s2`) |
| `s3.png` | `308:3037` | 1440×1022 | step 3 (`s3`) |
| `s3_2.png` | `351:1928` | 1440×1177 | step 3, second frame (`s3_2`) |
| `s4.png` | `347:997` | 1440×1213 | step 4 (`s4`) |
| `s4_2.png` | `351:362` | 1339×1440 | step 4 variant (`s4_2`) |
| `s4_3.png` | `351:901` | 1339×1440 | step 4 variant (`s4_3`) |
| `s4_4.png` | `365:559` | 1440×1271 | step 4 variant (`s4_4`; `365:2` = `s4_4_var` was not saved) |
| `s5.png` | `347:1403` | 1411×1440 | step 5 (`s5`) |
| `elements.png` | `379:1110` | 2072×497 | frame `юи элементы` — crop of reusable UI atoms (chips, stepper, buttons) |
| `sheet_ill1.png` | — | 1576×171 | storyboard strip of `ill1.mp4` (1 fps, 4 tiles) |
| `sheet_ill1_2.png` | — | 1182×342 | storyboard strip of `ill1_2.mp4` |

## Not from Figma

The onboarding animations used by `StartLayout.tsx` (`/start/anim/ill*.mp4`) came from a shared
Dropbox folder, not from Figma: they were downloaded, unzipped and then copied to
`frontend/public/start/anim/`. They are not duplicated here — see that directory.

Icons from the Figma frame "иконки" were never exported; `StartTopic.tsx` still renders emoji
stand-ins and expects `frontend/public/start/icons/<slug>.svg`.

## Provenance

Originals lived in an ephemeral Claude Code scratchpad
(`/private/tmp/claude-501/…/6962ab73-…/scratchpad/figma/`) and were copied here byte-for-byte on
2026-11-17 because `/private/tmp` does not survive a reboot. The storyboards were produced there with
`ffmpeg -vf "fps=1,scale=394:-1,tile=4x1"`.
