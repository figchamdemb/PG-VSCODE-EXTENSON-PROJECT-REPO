# Frontend Design Guardrails

LAST_UPDATED_UTC: 2026-03-15 18:56
UPDATED_BY: codex

## Purpose
This is the default UI design policy for app, mobile app, dashboard, help, pricing, and admin work in this repository.

- Build in the same product family as the existing web surfaces and approved secure-mobile reference families.
- Reuse the pattern language, not the exact screen art.
- Treat this as a pattern library, not a single mandatory art direction for every screen.
- If the user supplies a design guide, screenshot, prompt, or component reference, that user-provided source overrides this default guide.
- For React, React Native, and Kotlin/Compose, translate the pattern grammar natively. Do not recreate HTML/Tailwind literally in a different stack.

Note:
- `C:\Users\ebrim\Downloads\sample-screen pront design.txt` was empty during the original guardrail session, so the default baseline came from the current repo surfaces and `frontend-screen-spec.md`.
- The secure onboarding, approvals, OTP, and vault references supplied on 2026-03-15 are now normalized below as reusable pattern grammar, not as copy-paste screens.

## Primary References
- `server/public/app.html`
- `server/public/assets/site.css`
- `server/public/assets/app.css`
- `server/public/help.html`
- `server/public/assets/help.css`
- `server/public/pricing.html`
- `server/public/assets/pricing.css`
- `frontend-screen-spec.md`
- user-supplied secure mobile auth/approvals/vault references from the 2026-03-15 task

## Mandatory Rules
- Read this file before UI work when no user design guide is present.
- Read the user design guide first when one is provided, then use this file only as a fallback for repo consistency.
- Match similar patterns, not copied screens. Preserve layout rhythm, control hierarchy, spacing, edge treatment, and flow without cloning another product one-to-one.
- Keep major surfaces in one visual family. Do not ship one theme for dashboard, a second for help, and a third for admin unless the user explicitly asks.
- Prefer shared tokens, shared classes, extracted sections, or shared theme primitives over inline one-off styling.
- Keep page/screen files within the existing 500-line policy limit by splitting sections/components.
- When porting a design into React, React Native, or Kotlin/Compose, preserve the state model and action hierarchy first, then express the visuals through native components and theme tokens.
- Use the approved button pattern grammar on operational surfaces instead of inventing a new button family per screen.
- Choose the closest approved pattern family for the use case. Do not force every new customer surface to use every mobile/auth/approval/vault pattern at once.

## Pattern Selection Rule
- A new customer or product surface may pick one approved pattern family and adapt it to the product context.
- The guide tells the builder what kind of shell, button hierarchy, state treatment, and motion language to use.
- The guide does not require every screen to use the same biometric hero, bottom nav, FAB, or approval card.
- Button guidance defines role and relative visual weight first; exact border radius, icon choice, and surface styling may vary within the approved family.

## Layout Grammar
- Major app surfaces should use a clear shell:
  - sticky or anchored top bar,
  - main content container,
  - sidebar, tab rail, or bottom navigation when the page has multiple operational areas.
- Use cards/panels to group actions and data instead of long flat stacks.
- Use two-column card grids on desktop when density helps, then collapse cleanly to one column on mobile.
- Keep one primary action per panel. Secondary and ghost actions should support the main action, not compete with it.
- Billing, support, team admin, approvals, and vault controls should stay grouped into labeled sections with visible hierarchy.
- Mobile operational screens should usually read top-to-bottom as:
  - status/header,
  - hero state card or biometric focal point,
  - supporting details,
  - anchored bottom action zone or bottom navigation.

## Visual System
- Typography:
  - body copy: `Manrope`
  - headings, labels, chips, and tabs: `Space Grotesk`
- Tokens:
  - colors should extend the current token family: `--brand`, `--brand-dark`, `--accent`, `--ink`, `--muted`, `--line`, `--bg`, `--bg-strong`
  - radius rhythm should stay close to current surfaces:
    - shell: `18px`
    - card/panel: `14px`
    - control/pill: `999px`
- Backgrounds:
  - soft light surfaces,
  - restrained gradients,
  - subtle atmospheric shapes/orbs when appropriate,
  - no flat empty white screens unless the user asks.
- Shadows:
  - use soft depth, not heavy floating glass or sharp black shadows.
- State color usage:
  - protected/verified states can lean on brand green,
  - pending/expiring states can use amber or orange accent rails,
  - secure vault/protected-storage hero cards can use deep slate surfaces with restrained green glow.

## Controls
- Buttons must show a clear hierarchy:
  - primary: strong brand or gradient emphasis
  - secondary: quieter filled or outlined support action
  - ghost: utility or low-emphasis action
- Reuse the current class grammar where it fits:
  - `.btn`
  - `.btn-primary`
  - `.btn-secondary`
  - `.btn-ghost`
  - `.portal-nav-btn`
  - `.help-tab`
  - `.chip`
- Inputs, selects, dropdowns, and textareas should live inside labeled sections/cards.
- Tabs and chips should use rounded edges and explicit active state styling.
- When the stack is not web CSS based, map those roles into native equivalents:
  - React web: keep the existing class/token hierarchy.
  - React Native: use shared style tokens/components for cards, chips, bottom nav, and CTA families.
  - Kotlin/Compose: use `MaterialTheme`, `Button`, `OutlinedButton`, `TextButton`, `FloatingActionButton`, `NavigationBar`, `Card`, and `ModalBottomSheet` equivalents rather than HTML-like wrappers.

## Button Pattern Grammar
- Use these as role definitions, not exact pixel-perfect templates.
- Primary CTA:
  - dominant brand-filled button,
  - bold label,
  - optional directional or confirmation icon,
  - used once per panel or bottom action zone.
- Secondary support action:
  - white, tonal, or outlined surface,
  - still clearly tappable,
  - used for scan, refresh, register, or alternate flow actions.
- Ghost or utility action:
  - text-only or low-emphasis icon action,
  - used for recovery phrase, view all, close, or overflow affordances.
- Destructive action:
  - soft red surface, border, or tint,
  - reserved for deny, remove, unlink, delete, or cancel-confirm paths,
  - should not visually overpower the primary approval path.
- Circular icon action:
  - compact round surface for back, settings, notifications, or quick utilities.
- Floating action button:
  - single elevated circular action for scan/import/create,
  - only when the action is global enough to deserve persistent prominence.
- Bottom-nav action:
  - icon-first, short label, explicit active tint,
  - active destination must read stronger than inactive items.

## Mobile Pattern Appendix
- Secure setup screen:
  - centered biometric or camera focal point,
  - short trust-building title and description,
  - anchored bottom CTA zone,
  - optional pulse, ring, or badge around the biometric symbol.
- Approvals empty or unregistered state:
  - top status/header shell,
  - one strong empty-state card,
  - primary register CTA plus quieter scan CTA,
  - secondary OTP or coverage information below.
- Approvals protected or idle state:
  - status hero card showing the device is protected,
  - quick action pair for scan/refresh or equivalent,
  - device info card,
  - recent activity list,
  - bottom navigation.
- Approvals active request state:
  - urgent accent line or chip,
  - service identity block,
  - timer or expiry treatment,
  - request details card,
  - approve and deny pair,
  - recent activity below the active card.
- OTP reveal flow:
  - locked biometric reveal state first,
  - reveal action transitions to a large monospaced code,
  - code actions should include copy and hide,
  - expiry indicator stays visible before and after reveal.
- Vault locked state:
  - high-contrast hero card showing lock/protected status,
  - obscured content preview underneath,
  - unlock CTA over blurred/hidden content.
- Vault unlocked list state:
  - unlocked hero card,
  - filter chips,
  - clean file or token list cards,
  - optional floating import/create action,
  - visible auto-lock/security timer near the bottom.
- Modal or sheet authentication:
  - use a bottom sheet or compact modal when the action needs a second biometric confirmation,
  - keep the focus on the biometric icon, status text, and success transition,
  - avoid dumping full forms into the confirmation sheet.

## Motion And State
- Use pulse, ping, or glow effects only to reinforce biometric readiness, online status, or time-sensitive urgency.
- Use progress bars, timer rings, or accent rails when a request is expiring or a secure token is time-bound.
- Use short success transitions for approve/unlock/reveal flows instead of abrupt page swaps.
- Motion should support trust and clarity, not make secure flows feel playful or noisy.

## Dashboard Pattern
- Overview/dashboard pages should usually contain:
  - identity or status block,
  - navigation rail or grouped tabs,
  - summary cards or KPI blocks,
  - detailed operational panels below.
- Mobile approvals/vault screens should make state immediately obvious:
  - empty,
  - protected,
  - pending,
  - revealed,
  - locked,
  - unlocked.
- Admin and team views should feel operational and structured, not like marketing pages.
- Help and pricing pages can be more expressive, but they should still use the same token family and card grammar as the portal.

## Anti-Patterns
- Do not copy a reference design exactly when the request is for a similar pattern.
- Do not paste HTML/Tailwind markup into React Native or Kotlin/Compose and call that a translation.
- Do not introduce unrelated border radii, colors, and button styles for each page.
- Do not rely on large inline style blocks when shared CSS/classes or shared theme primitives would do the job.
- Do not build major pages as ungrouped walls of inputs and buttons.
- Do not give approve/deny, unlock/cancel, or primary/secondary actions equal visual weight by default.
- Do not mix promotional layout patterns into operational dashboards unless the user asks for that blend.

## Agent Workflow
- Before UI implementation, write a short pattern summary for yourself from the active reference.
- If the user asks for "like this, but better", improve clarity, spacing, responsiveness, and consistency without drifting away from the reference grammar.
- If the task intentionally breaks this guide, record that reason in `Memory-bank/project-details.md`.
