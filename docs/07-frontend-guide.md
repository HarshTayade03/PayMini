# Frontend Architecture & Design Guide

This guide establishes the visual design system, interaction patterns, component hierarchy, and token specifications for PayMini.

---

## 1. Visual Design Philosophy

PayMini is designed to evoke trust, clarity, and precision. It avoids visual clutter, decorative illustrations, gradients, emojis, or skeuomorphic credit card graphics.

### Core Visual Principles
- **Neutral Foundation:** White (`#ffffff`), calm neutral grays for borders (`#e5e7eb`), quiet card backgrounds (`#f9fafb`), and dark text (`#111827`) for optimal readability.
- **Single Restrained Accent:** Calm, deep Slate Blue (`#2563eb` / `#1d4ed8`) reserved strictly for primary interactive affordances.
- **Semantic Intent Colors:** Emerald green (`#16a34a`) strictly for credits / incoming transfers / success badges; Rose red (`#dc2626`) strictly for debits / errors.
- **Tabular Numerals:** All financial figures and timestamps use `font-mono tabular-nums` to guarantee aligned decimal digits across tables and lists.
- **Predictable Spatial Layout:** 8px grid system (`p-2`, `p-4`, `p-6`, `p-8`), thin 1px borders (`border border-neutral-200`), clean 8px/12px border radiuses (`rounded-lg`, `rounded-xl`), centered single-column desktop layout (`max-w-2xl` ~ 672px).

---

## 2. Design Tokens

### Color Tokens
- `bg-background`: `#ffffff`
- `bg-surface`: `#ffffff`
- `bg-muted`: `#f9fafb` (Neutral 50)
- `border-subtle`: `#e5e7eb` (Neutral 200)
- `text-primary`: `#111827` (Neutral 900)
- `text-secondary`: `#4b5563` (Neutral 600)
- `text-muted`: `#9ca3af` (Neutral 400)
- `accent-primary`: `#2563eb` (Blue 600)
- `accent-hover`: `#1d4ed8` (Blue 700)
- `status-success`: `#16a34a` (Green 600)
- `status-error`: `#dc2626` (Red 600)

### Type Hierarchy
- **Display Amount (Hero Balance):** 36px (`text-4xl`), Semibold (`font-semibold`), Tabular numbers (`tabular-nums font-mono`).
- **Section Heading:** 20px (`text-xl`), Medium (`font-medium`), Neutral 900.
- **Card Title / Subheading:** 15px (`text-sm` or `text-base`), Medium (`font-medium`).
- **Body Text:** 14px (`text-sm`), Regular (`font-normal`), Neutral 600.
- **Microcopy / Captions:** 12px (`text-xs`), Regular (`font-normal`), Neutral 500.

---

## 3. UI Layout Sketch (ASCII)

### Desktop & Mobile Layout Architecture
```text
+-------------------------------------------------------------------+
|  [PayMini Logo]    Home   Send   Activity       [Test Mode] (user)|
+-------------------------------------------------------------------+
|                                                                   |
|                       < Main Centered Container >                 |
|                               (max-w-xl)                          |
|                                                                   |
|       +---------------------------------------------------+       |
|       | Total Available Balance                           |       |
|       |                                                   |       |
|       | ₹ 500.00                                          |       |
|       | INR Test Currency                                 |       |
|       |                                                   |       |
|       |   [ + Add Test Money ]        [ -> Send Money ]   |       |
|       +---------------------------------------------------+       |
|                                                                   |
|       Recent Activity                         View All ->         |
|       +---------------------------------------------------+       |
|       | <- Received from alice@example.com      + ₹200.00 |       |
|       |    Today at 2:15 PM                               |       |
|       |---------------------------------------------------|       |
|       | -> Sent to bob@example.com              - ₹150.00 |       |
|       |    Yesterday at 6:40 PM                           |       |
|       +---------------------------------------------------+       |
|                                                                   |
|       About Test Money  •  Security Notice  •  Demo Only          |
+-------------------------------------------------------------------+
```

---

## 4. Component Hierarchy

- **Global Shell:**
  - `Navbar`: Product brand, active navigation links (Home, Send, Activity), Test Mode badge, logout trigger.
  - `TestModeBanner`: Mandatory first-visit accessible modal explaining that all currency is simulated fake currency; saved in `localStorage` under `paymini_test_notice_acknowledged`.
  - `Footer`: Subtle copyright, learning disclaimer, and accessible re-trigger link for the test money notice.
- **Core Screen Views:**
  - `HomeView`: Large balance card with quick actions and 5 most recent activity items.
  - `SendMoneyView`: Two-step transfer workflow:
    1. Input form (recipient email, amount, optional note).
    2. Confirmation / Review dialog displaying exact recipient and amount.
    3. Idempotency key generated per transfer attempt, button disabled during flight, clear receipt screen.
  - `ActivityView`: Directional filters (`All`, `Sent`, `Received`), chronological transaction ledger items, and cursor-based "Load More" pagination.
  - `TopUpView`: Clean form displaying allowed caps (₹1,000 per request, ₹5,000 daily limit).

---

## 5. Security & Token Handling Architecture

```text
[ Browser JavaScript ]
       |
       |  (1) Normal fetch() to Next.js route: /api/proxy/wallet
       |      Cookie: paymini_session=eyJhbGci... (httpOnly, SameSite=Lax)
       v
[ Next.js Server Route Handler ] (BFF)
       |
       |  (2) Reads httpOnly cookie on server
       |  (3) Forwards request to FastAPI backend with Bearer Authorization header:
       |      Authorization: Bearer eyJhbGci...
       v
[ FastAPI Python Backend ]
```

- **Zero Client Token Exposure:** Browser client scripts cannot read the session cookie via `document.cookie`.
- **XSS Mitigation:** Even if an XSS flaw exists on the page, the attacker's script cannot steal the raw token string.
- **SameSite=Lax:** Protects against cross-site request forgery for state-changing POST requests from third-party websites.
