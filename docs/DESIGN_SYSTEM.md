# IshVenom Design System

## Brand Identity
IshVenom is a life-saving medical tool, not a toy. The design must feel
trustworthy, calm under pressure, and accessible to community health
workers with limited tech literacy.

**Accent rationale:** `#0EA5E9` (sky-500 cyan) is the accent color.
Cyan carries 70 years of global health org association (WHO, MSF, UNICEF)
and reads as clinical rather than tech-purple — the right signal for a
triage tool used in the field.

## Color Palette

### Dark Mode (default)
| Token | Hex | Usage |
|---|---|---|
| `bg-primary` | `#080C12` | App background |
| `bg-surface` | `#0F172A` | Cards, panels, modals |
| `bg-surface-hover` | `#1E293B` | Hover/pressed states |
| `border-default` | `#1E293B` | Card borders, dividers |
| `text-primary` | `#F0F9FF` | Headings, body text |
| `text-secondary` | `#94A3B8` | Captions, metadata |
| `text-muted` | `#64748B` | Placeholders, disabled |
| `accent-primary` | `#0EA5E9` | Primary buttons, links, active states |
| `accent-primary-hover` | `#0284C7` | Button hover |
| `accent-secondary` | `#7DD3FC` | Secondary highlights, badges |
| `danger` | `#EF4444` | Venomous badges, emergency, errors |
| `danger-surface` | `#2D1214` | Danger card backgrounds |
| `warning` | `#F59E0B` | Generating states, caution badges |
| `warning-surface` | `#2D2206` | Warning card backgrounds |
| `success` | `#10B981` | Synced, non-venomous, confirmed |
| `success-surface` | `#0D2818` | Success card backgrounds |

### Light Mode
| Token | Hex | Usage |
|---|---|---|
| `bg-primary` | `#F8FAFC` | App background |
| `bg-surface` | `#FFFFFF` | Cards, panels, modals |
| `bg-surface-hover` | `#F1F5F9` | Hover/pressed states |
| `border-default` | `#E2E8F0` | Card borders, dividers |
| `text-primary` | `#0F172A` | Headings, body text |
| `text-secondary` | `#64748B` | Captions, metadata |
| `text-muted` | `#94A3B8` | Placeholders, disabled |
| `accent-primary` | `#0EA5E9` | Same across both themes |
| `accent-primary-hover` | `#0284C7` | Same across both themes |
| `accent-secondary` | `#7DD3FC` | Same across both themes |
| `danger` | `#DC2626` | Slightly darker for light bg |
| `warning` | `#D97706` | Slightly darker for light bg |
| `success` | `#059669` | Slightly darker for light bg |

## Typography
- **Headings:** System font (San Francisco on iOS, Roboto on Android), bold 700
- **Body:** System font, regular 400, 15px line-height 22px
- **Captions:** System font, regular 400, 12px
- **Monospace:** For latency/debug info only

## Spacing Scale
4, 8, 12, 16, 20, 24, 32, 40, 48 — never use arbitrary values.

## Border Radius
- Small (badges, chips): 8px
- Medium (buttons, inputs): 12px
- Large (cards, modals): 16px
- Full (avatars, dots): 9999px

## Component Rules
- **Buttons:** Min height 48px, min touch target 44×44. Primary uses `accent-primary`. Danger uses `danger`. Never use raw red for non-emergency actions.
- **Cards:** `bg-surface` with `border-default` border, `border-radius: 16px`, padding 20px.
- **Venomous badges:** `danger` bg for deadly, `warning` bg for mild, `success` bg for non-venomous. Always uppercase, font-weight 800, font-size 11px.
- **Status pills (sync):** Outline style with colored border + dot. Never filled.
- **Icons:** No emoji anywhere — not in UI, not in comments, not in tab icons. Use MaterialCommunityIcons from @expo/vector-icons for all iconography.
- **RTL:** Arabic layout must mirror. Use `I18nManager` + `writingDirection` style prop.

## Screen Structure
Every screen follows:
1. Safe area wrapper with `bg-primary` background
2. Optional header (screen title in `text-primary`, 20px bold)
3. Content area with 20px horizontal padding
4. No bottom tab bar — stack navigation only

## Dark/Light Toggle
Respect device system preference via `useColorScheme()`. Store override in Zustand session store. Never hardcode colors — always reference the token.

## What NOT to do
- No gradients
- No shadows (they don't work well on low-end Android)
- No custom fonts (adds bundle size, slows load on target hardware)
- No animations except loading spinners and the sync pulse dot
- No opacity for disabled states — use `text-muted` color instead
- No inline hex values in components — always use the theme tokens

## Navigation

### Bottom Tab Bar
- 5 tabs: Home, Identify, Learn, History, Settings
- Height: 64px + safe area bottom inset
- Background: `bg-surface` with `border-default` top border (1px)
- Active tab: `accent-primary` icon + label
- Inactive tab: `text-muted` icon + label
- Label font: 10px, medium 500
- Icon size: 24px
- No floating action button — the Identify tab IS the primary action

### Tab Icons (Unicode/Emoji for zero bundle cost)
- Home: house outline
- Identify: camera outline
- Learn: book outline
- History: clock outline
- Settings: gear outline
Use react-native vector icons or simple SVG paths. No icon library over 100KB.

## Learn Screen
- Chat-style interface with user bubbles (right, `accent-primary` bg) and
  assistant bubbles (left, `bg-surface` bg)
- Suggested topic chips at the top: "Snake prevention", "First aid basics",
  "Snakes in my area", "What to do if bitten"
- Text input bar at bottom with send button
- All inference runs on-device via Gemma 4 E2B — never hits the cloud
- Responses must include a disclaimer footer: "AI-generated. Not medical advice."

## Onboarding Flow

### When it shows
- First launch only (tracked via `hasOnboarded` in Zustand session store, persisted to AsyncStorage)
- After "Forget this device" in Settings, onboarding resets

### Screens (3 steps, swipeable or next-button)

**Step 1: Welcome**
- App name + one-line tagline (no emoji)
- "Get Started" button

**Step 2: Select Language**
- Grid of 6 language cards (2 columns, 3 rows)
- Each card shows: native name (large), English name (small), flag/region label
- Tapping a card selects it — highlighted with accent-primary border
- The entire UI immediately switches to the selected language as preview
- Default pre-selected: English

**Step 3: Your Info**
- Name input (optional — for personalized greeting on Home, never synced)
- Country dropdown (Ghana, Nigeria, Senegal, Burkina Faso, Cote d'Ivoire, Sudan, Kenya, Tanzania, Uganda, Chad, Mauritania, Egypt, Other)
- "Start using IshVenom" button

### Language Selection in Settings
- Same grid layout as onboarding Step 2
- Changing language immediately switches the entire app UI
- No app restart required (i18next.changeLanguage handles this)
- For Arabic: triggers RTL layout flip via I18nManager (requires reload — show a brief toast explaining why)

### Data Flow
- Language choice: i18next.changeLanguage(lang) + session store + AsyncStorage persist
- Country choice: session store + used as default for encounter GPS country field
- Name: session store only, never leaves device, never synced

---

## Emergency Response Flow

### Trigger
Activates automatically when triage completes with `wasBite: true`.
Not a separate screen — it is an expanded section on the Result screen.

### Components (top to bottom on Result screen when bite detected)

1. **Captured Photo**
   - Full width, `border-radius: 16px`, shown at very top of result scroll
   - Sourced from permanent local file (saved by imageStore.ts at triage time)

2. **Urgency Banner**
   - Full-width, danger/warning/success background depending on species venomousness
   - `deadly` → `danger-surface` bg, `danger` text: "SEEK MEDICAL HELP IMMEDIATELY"
   - `mildly_venomous` → `warning-surface` bg, `warning` text: "MONITOR — seek help if symptoms develop"
   - `non_venomous` → `success-surface` bg, `success` text: "LOW RISK — monitor the patient"
   - Below the label: live bite timer counting up — "TIME SINCE BITE: 00:04:32"
   - Timer font: 12px, `text-muted`, monospace size

3. **Nearest Clinic Card**
   - `bg-surface` card, `border-default` border, `border-radius: 16px`, `padding: 16px`
   - Left accent border 4px in `danger`
   - Shows: clinic name (15px bold), formatted distance (e.g. "47 km"), phone number
   - If no GPS: show first clinic for user's country; if none: "No antivenom center found nearby — seek any medical facility"

4. **Action Buttons (two side-by-side)**
   - "Call clinic" — `accent-primary` bg; disabled + `text-muted` if no phone number
   - "Get directions" — `bg-surface` bg, `border-default` border
   - Both use MaterialCommunityIcons: `phone` and `map-marker` (size 20)

5. **Emergency SMS Button**
   - Full-width, `danger` bg: "Send emergency SMS"
   - Pre-fills SMS: "SNAKEBITE EMERGENCY. Species: [name]. Location: [GPS]. Time bitten: [HH:MM]. Please send help."
   - Recipient: clinic phone if available, blank otherwise
   - Hidden if `SMS.isAvailableAsync()` returns false (Wi-Fi-only tablets)
   - Icon: `message-text` (MaterialCommunityIcons, size 20)

### What does NOT happen automatically
- No automatic SMS — user must tap to confirm
- No automatic phone call — user taps to initiate
- No data sent to cloud during emergency — local-first always
- Photos never transmitted — only anonymised encounter metadata syncs later

### Privacy contract
| Data | On device | Syncs to backend |
|---|---|---|
| Original photo | Yes, always | NEVER |
| Thumbnail | Yes | NEVER |
| Photo hash (SHA-256) | Yes | Yes — dedup only, not reversible |
| GPS coordinates | Yes (full) | Yes, truncated to ~1.1 km (district level) |
| Species guess | Yes | Yes |
| Bite flag | Yes | Yes |
| User name | Yes | NEVER |
