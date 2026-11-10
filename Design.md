# Design.md — The Master Design Prompt for **Roshan Rozgar**

> **What this file is.** A single, copy-paste prompt for Claude (or any strong model) that produces the
> front-end design for Roshan Rozgar. It is written to be *unbeatable at a hackathon table*: opinionated,
> specific, token-driven, and built around the one thing every other team will get wrong — a worker who
> **cannot read**.
>
> **How to use it.** Copy everything inside `=== PROMPT START ===` / `=== PROMPT END ===` into Claude.
> Paste it with your stack line appended (e.g. *"Stack: Next.js 16 App Router, Tailwind v4, Framer Motion"*).
> Do not shorten it. The specificity *is* the moat.
>
> Companion file: `PROJECT.md` (architecture, AI design, data model, build timeline, demo script).

---

## 0. The design thesis (read this before you prompt)

Ninety percent of hackathon teams will build **one app with a language toggle**. That loses.

Roshan Rozgar has **two users with opposite constraints**, so it gets **two skins over one system**:

| | **Worker skin** (Kaarigar) | **Customer skin** (Ghar) |
|---|---|---|
| Core constraint | May not read or type | Wants speed and a reason to trust |
| Density | Radically sparse — 3 decisions per screen, max | Information-rich, scannable |
| Input | Voice, icon, photo, single tap | Text, filters, map, taps |
| Type scale | Huge (20px floor) | Normal (14px floor) |
| Chrome | Warm paper, amber, two big buttons | Cool slate, teal, standard nav |
| Literacy rule | **Nothing is text-only, ever** | Text is fine |

**The one-line pitch to a judge:** *"Every control in the worker app survives the squint test — cover the
words and it still works. Every control in the customer app survives the trust test — it tells you why you
should believe it."*

---

=== PROMPT START ===

You are a senior product designer and front-end engineer. You are designing **Roshan Rozgar** (روشن روزگار,
"bright livelihood") — a mobile-first web platform that connects Pakistani households with nearby skilled
trade workers: electricians, plumbers, AC technicians, carpenters, mechanics.

This is being judged at a hackathon on: technical execution (30%), problem understanding (20%), use of AI
(20%), **usability and accessibility (15%)**, presentation (15%). Your design must visibly win the usability
criterion and visibly support the other four.

## 1. Who you are designing for

**User A — the worker (Kaarigar).** 38, electrician, 15 years of experience, Rawalpindi. Reads Urdu slowly
and English barely. Has an Android phone on 3G, uses WhatsApp voice notes constantly and has never filled
in a web form. Finds work by standing at an *adda* (street-corner labour gathering point). He is not
stupid, not poor at his craft, and not helpless — **he is illiterate in text, fluent in speech**. Design for
dignity, not for pity.

**User B — the customer (Ghar).** 29, apartment in Islamabad. Her geyser is leaking *right now*. She wants a
worker who is (a) close, (b) free in the next hour, (c) actually competent at geysers, (d) safe to let into
her home. Today she asks a neighbour and prays.

## 2. Non-negotiable design laws

Write these into every screen. If a screen violates one, redesign the screen.

1. **The Squint Test (worker side).** Cover every word on the screen. The screen must still be operable
   from icon, colour, shape and position alone. No text-only buttons. No text-only states. Ever.
2. **The Thumb Law.** Primary actions live in the bottom 35% of the viewport. Minimum hit area 56x56 px on
   the worker side, 44x44 px on the customer side. No action in a top corner.
3. **Three Decisions Max.** A worker screen presents at most three possible actions. If you need four,
   you need two screens.
4. **Voice is a first-class input, not an accessory.** Every worker-side field has a microphone affordance
   *as the default*, with typing as the fallback — the inverse of normal web design.
5. **Every state is announced three ways.** Colour + icon + motion (and speech on the worker side). Never
   colour alone; 8% of men have colour-vision deficiency and this user base is overwhelmingly male.
6. **Urdu is not a translation layer.** Urdu and Roman Urdu are co-primary. The layout must be built for
   RTL from the first line of CSS (logical properties only: `margin-inline-start`, never `margin-left`).
7. **Never show a spinner without a sentence.** Loading states say what is happening ("سن رہے ہیں…" /
   "Listening to you…"), because an unexplained delay reads as *broken* to a first-time user.
8. **Offline and slow-network dignity.** 3G is the design target. Skeletons, optimistic UI, and a visible
   "saved on your phone" state. Nothing may require a round-trip to feel responsive.
9. **No hamburger menu anywhere in the worker app.** Hidden navigation is invisible navigation.
10. **Trust is rendered, not claimed.** Never print the word "verified" without the artefact that earns it
    (who said it, when, for what job).

## 3. Visual language

### 3.1 Concept

*Roshan* means bright, lit. The visual metaphor is **a lamp in a working neighbourhood at dusk**: warm
light on honest surfaces. Draw restrained energy from Pakistani truck art — its saturated accents and
hand-drawn borders — but apply it as **ornament, never as chrome**. The product must read as *trustworthy
civic infrastructure*, not as a festival poster. Think: a well-made public utility, lit warmly.

### 3.2 Colour tokens (define as CSS custom properties on `:root`)

```css
/* Core */
--ink:            #0B1020;   /* near-black blue; all primary text */
--ink-soft:       #3A4256;   /* secondary text */
--paper:          #F8F6F1;   /* warm paper — WORKER skin surface */
--slate:          #F3F5F8;   /* cool neutral — CUSTOMER skin surface */
--card:           #FFFFFF;

/* Brand */
--roshan:         #FF9F1C;   /* the lamp. Worker primary. Warm, high-visibility amber */
--roshan-deep:    #D97E06;   /* pressed/active state, and amber text on white (AA) */
--teal:           #0E6E6B;   /* Customer primary. Calm, clinical, trustworthy */
--teal-deep:      #0A5250;

/* Semantic */
--free:           #1D9A5F;   /* worker available */
--busy:           #C2410C;   /* worker engaged */
--off:            #6B7280;   /* worker off-duty */
--danger:         #D7263D;
--star:           #F2B01E;

/* Truck-art accents — borders, dividers and ornament ONLY, never fills */
--accent-rose:    #E8336D;
--accent-cobalt:  #2A4BD7;
--accent-leaf:    #3FA34D;
```

**Contrast rule:** body text at least 7:1 on the worker side (AAA), at least 4.5:1 on the customer side
(AA). Amber is a *surface and border* colour, never small text on white — use `--roshan-deep` for that.

**Dark mode** is required and must be a real redesign of the tokens, not an inversion: `--ink` becomes
`#070A13`, surfaces lift to `#141A28`, and `--roshan` warms to `#FFB347` so it does not vibrate.

### 3.3 Trade colour-coding system — *this is the accessibility centrepiece*

Every trade is a **quadruple**: colour + glyph + Urdu word + an audio label the app can speak. A worker
with zero reading ability selects his trade by recognising the picture, confirms by hearing the word, and
the same colour then follows him through the entire product.

| Trade | Colour | Glyph (custom, 2.5px stroke) | Urdu | Spoken |
|---|---|---|---|---|
| Electrician | `#F2B01E` | lightning bolt in a socket | بجلی والا | *bijli waala* |
| Plumber | `#2A6FD7` | water droplet on a pipe wrench | پلمبر | *plumber* |
| AC technician | `#2BB3C0` | snowflake over a split unit | اے سی والا | *AC waala* |
| Carpenter | `#A4622D` | hand saw over a plank | بڑھئی | *barhai* |
| Mechanic | `#55606E` | open-end wrench with a bolt | مستری | *mistri* |
| Painter | `#7A4FD1` | roller with a drip | پینٹر | *painter* |
| Mason | `#8A8178` | trowel and brick course | راج مستری | *raj mistri* |

Draw these as inline SVG. **Do not use a generic icon-set glyph** (no stock lucide/heroicons shapes for
trades) — a worker recognises *his tool*, not an abstraction. Each glyph must be identifiable at 32px and
at 96px.

### 3.4 Typography

```
Latin UI:     "Plus Jakarta Sans"  — 400 / 500 / 700
Urdu body:    "Noto Naskh Arabic"  — chosen for legibility at small sizes
Urdu display: "Noto Nastaliq Urdu" — headings and the wordmark only; needs line-height 2.0
Numerals:     tabular, always. Prices and distances must not reflow.
```

Justify the Urdu choice out loud in the README: *Nastaliq is the authentic Urdu script style but its
sloped baseline and tall ascenders hurt comprehension at UI sizes, so it is used for display while Naskh
carries body text.* Judges reward this kind of reasoning.

Two scales, one ramp:

```
WORKER      Display 40/1.1  ·  Title 30/1.2  ·  Body 20/1.5  ·  Label 18/1.4   (floor 18px)
CUSTOMER    Display 30/1.15 ·  Title 22/1.25 ·  Body 16/1.55 ·  Caption 14/1.4 (floor 14px)
Urdu: add +2px size and +0.25 line-height at every step.
```

### 3.5 Space, shape, depth, motion

- **Space:** 4px base; use 8/12/16/24/32/48. Worker screens get the next step up everywhere.
- **Radius:** `--r-sm 10px`, `--r-md 16px`, `--r-lg 24px`, `--r-pill 999px`. Worker buttons are `--r-lg`;
  soft shapes read as safe and tappable.
- **Depth:** two elevations only. `0 1px 2px rgba(11,16,32,.06)` for cards;
  `0 12px 32px -8px rgba(11,16,32,.18)` for sheets and the voice overlay. No layered glassmorphism.
- **Motion:** 160ms `cubic-bezier(.2,.8,.2,1)` for state, 240ms for sheets, 400ms for celebration.
  Honour `prefers-reduced-motion` by swapping every transform for an opacity fade.
  Exactly three signature motions, no more:
  1. **Voice orb breathing** — the mic button scales 1.0 to 1.06 on a 2.4s loop while listening, with a
     live amplitude ring driven by the real audio stream. This is the product's heartbeat.
  2. **Availability pulse** — a free worker's green dot emits one soft ripple every 3s. Busy and
     off-duty are static. Motion = availability, learnable without words.
  3. **Trust ribbon fill** — on job completion, the worker's reputation bar animates its gain once,
     with a haptic tick. Reward, not decoration.

### 3.6 Ornament

One device, used sparingly: a **2px hand-drawn truck-art border** (alternating rose/cobalt/leaf dashes)
on exactly three things — the wordmark lockup, the worker's profile card header, and the job-completion
receipt. Nowhere else. Restraint is what separates designed from decorated.

## 4. Component specifications

Build these as real components with explicit states (default / hover / pressed / loading / disabled /
error / empty). Specify each.

1. **VoiceButton** — the single most important component in the product. 96px circle, `--roshan` fill,
   white mic glyph, breathing animation, live waveform ring from the Web Audio API, and a transcript
   appearing *above* it in real time so the user sees speech becoming text. States: idle → listening →
   thinking → confirming → error ("I didn't catch that" + auto-retry, never a dead end).
2. **TradeTile** — 2-column grid, 1:1, large glyph on a 12% tint of its trade colour, Urdu label below,
   speaker icon in the corner that reads the label aloud. 3px `--ink` ring when selected plus a tick —
   *two* selection signals.
3. **WorkerCard** — the customer's unit of decision. Must answer four questions in one glance:
   photo + name + trade chip; **distance** ("1.2 کلومیٹر"); **availability pill** (dot + word + motion);
   rating with job count; one AI-generated trust line; price band; and a `Call` + `Request` button pair.
4. **AvailabilityPill** — the single source of truth for status. Three variants, each with its own icon
   shape (filled circle / half circle / hollow circle) so shape alone carries meaning.
5. **BottomSheet** — all customer-side detail and all confirmations. Drag handle, 24px radius top,
   focus-trapped, `Escape` closes, backdrop at 40% `--ink`.
6. **BigChoice** — the worker's decision primitive. Full-width 88px-tall button pair, green/accept with a
   tick glyph and red/decline with a cross glyph, each with its own icon *and* its own shape. Used for
   every yes/no the worker ever faces.
7. **JobCard** — timeline-style, with a 4-state progress rail (requested → agreed → in progress → done)
   rendered as filled/hollow dots, each dot with its own glyph.
8. **TrustBlock** — star row, job count, "last job" recency, and an AI summary of reviews with the
   review count it was drawn from. Never a bare score.
9. **VoiceNoteBubble** — chat message with a waveform, duration, play/pause, and a **"دیکھیں" (see it)**
   toggle that reveals the AI transcript and translation. The worker speaks; the customer reads; both see
   the same thing.
10. **LanguageToggle** — three segments: **اردو / Roman / EN**, persisted, present on every screen,
    never buried.
11. **MapPin cluster** — worker pins coloured by trade, sized by rating, with the customer's location as
    a pulsing teal ring. Always paired with a list view; the map is never the only way through.
12. **PriceAgreement** — the moment money is discussed. Shows the worker's spoken quote, the AI's
    structured extraction of it (amount, unit, what's included), and an explicit two-tap confirm on
    both sides. This component is where trust is won or lost.

## 5. Screens to design (both skins, mobile-first at 390x844)

**Worker (Kaarigar) — the flagship flow. Make this beautiful.**

1. **Splash / role choice** — two giant cards: *I do work* (tools glyph, amber) vs *I need work done*
   (house glyph, teal). Both speak their label on load. Zero reading required to get in.
2. **Voice onboarding, step 1 of 4** — a full-screen voice interview. One spoken question at a time
   ("آپ کیا کام کرتے ہیں؟"), a huge VoiceButton, a live transcript, and a 4-dot progress rail.
   **No form. No keyboard. The profile is built from speech.**
3. **Voice onboarding, step 2** — trade confirmation as TradeTiles, pre-selected from what the AI heard,
   with the AI's guess visibly highlighted so the worker only has to confirm.
4. **Voice onboarding, step 3** — skills and experience: AI-proposed skill chips extracted from his own
   words, each with an icon, each tappable to remove. He edits by tapping, not typing.
5. **Voice onboarding, step 4** — proof: camera-first capture of past work; AI auto-tags each photo
   ("wiring panel", "AC install") and the tags become searchable skills. Then a one-tap profile preview
   that is *read aloud to him* before he publishes.
6. **Worker home** — the entire screen is one giant availability switch (FREE / BUSY / OFF) plus today's
   earnings and a job list. This is the screen he lives on; it must be glanceable from arm's length.
7. **Incoming job request** — full-screen takeover, auto-spoken, with the job photo, distance, customer
   rating and a BigChoice pair. A 60s countdown ring, no small print.
8. **Job chat** — voice-note first. The text keyboard is behind a secondary control; the mic is the
   default.
9. **Job complete** — receipt with the truck-art border, the trust-ribbon fill animation, and earnings.

**Customer (Ghar)**

10. **Describe the problem** — one input, three ways: **type**, **speak**, or **photograph the broken
    thing**. The AI classifies trade + urgency + likely fix from any of the three. Show the
    classification as an editable chip row so the user stays in control.
11. **Results** — map + list split, filter chips (available now / distance / rating / price band),
    WorkerCards ranked with a visible one-line reason for the ranking ("closest electrician who has done
    12 geyser jobs").
12. **Worker profile** — gallery of AI-tagged work photos, TrustBlock, skills, the AI review summary,
    and a sticky bottom Request bar.
13. **Booking confirm** — BottomSheet: time, address pin, the agreed price from PriceAgreement, and a
    single confirm.
14. **Live job status** — the 4-dot rail, the worker's live status, call button.
15. **Review** — stars plus **voice review** (speak it, AI transcribes, translates and summarises) plus
    tappable tag chips ("on time", "clean work", "fair price"). A review a non-reader can also leave.
16. **Empty, error and zero-result states** for every list — each with an illustration, a plain sentence,
    and one action. Never a blank screen.

## 6. Where AI must be *visible* in the design

A judge will ask: *"what stops working if we delete the AI?"* The design must make the answer obvious
on screen. Render each of these as a visible, labelled UI surface:

- **Voice to profile.** The transcript appearing live above the mic, then the extracted fields filling
  themselves in. Show the extraction happening. Delete the AI and there is no way for this worker to
  onboard at all.
- **Photo to diagnosis.** The customer's photo with AI bounding-box chips naming the parts and the
  probable trade. Delete it and she has to know what's wrong before she can ask for help.
- **Voice note to live translation.** Worker speaks Urdu, customer reads English; same bubble, one
  toggle. Delete it and the two users cannot negotiate.
- **Spoken quote to structured price.** The PriceAgreement extraction. Delete it and there is no record
  of what was agreed.
- **Reviews to trust summary.** A paragraph synthesised from many short reviews, with its source count
  shown. Delete it and the next customer is back to guessing.

Add a small, tasteful **"AI" chip** (12px, `--accent-cobalt` outline) on each of these surfaces so the
demo narrates itself. Never fake one: if a surface is seeded or mocked, label it as such.

## 7. Accessibility requirements (this is 15% of the score — do not improvise)

- WCAG 2.2 AA minimum; AAA contrast for all worker-side text.
- Full keyboard operability, visible 3px `--accent-cobalt` focus rings, logical tab order.
- Semantic HTML first: real `<button>`, real `<form>`, real headings in order. ARIA only where HTML
  cannot express it. `aria-live="polite"` on the transcript and on every status change.
- Screen-reader labels on all 60+ icons; `aria-pressed` on the availability switch.
- A **Read this page aloud** control on every worker screen, using the Web Speech API, in the user's
  chosen language.
- Targets: 56px worker / 44px customer, with at least 8px between adjacent targets.
- Works at 200% browser zoom and at 320px width without horizontal scroll.
- RTL mirroring verified: logical CSS properties throughout, icons that imply direction get flipped,
  numerals and the Latin wordmark do not.

## 8. Deliverables from you (the model)

1. A **design rationale** — 200 words, leading with the two-skin thesis and *why* it follows from the
   users' constraints.
2. The **complete token layer** as CSS custom properties, light and dark, both skins.
3. **Production-quality component code** for all 12 components in Section 4, with every state, fully
   typed, fully accessible, RTL-safe, and documented with one comment per non-obvious decision.
4. All **16 screens** from Section 5, responsive 320 to 1280, mobile-first, with real seeded content in
   Urdu and English — never Lorem Ipsum, never `{placeholder}`.
5. All **trade glyphs** as inline SVG, hand-drawn in character, not borrowed from an icon set.
6. A **README design section** stating: the two-skin decision, the font decision, the trade-quadruple
   accessibility system, the contrast targets met, and every known limitation.

## 9. Anti-patterns — automatic failure

- Generic AI-SaaS look: purple-blue gradient hero, glassmorphic cards, "Powered by AI" sparkle badge.
- A language dropdown as the only accommodation for low literacy.
- Text-only buttons, text-only states, or colour as the sole carrier of meaning, anywhere.
- Hamburger navigation in the worker app.
- Lorem Ipsum, `#` links, dead buttons, or any control that does nothing in the demo.
- Desktop-first layout squeezed down to mobile.
- Pity aesthetics — nothing that frames the worker as a charity case. He is a professional with 15 years
  of experience. Design for his dignity.
- Decorative AI: a chatbot bubble in the corner that no flow depends on.

## 10. Your success condition

A judge hands a phone to a person who cannot read, says nothing, and that person completes the worker
flow unassisted. Then the judge covers every word on the screen and the app still works.

Design to that bar. Begin with the design rationale, then the tokens, then the components, then the
screens.

=== PROMPT END ===

---

## Appendix A — Copy deck (use these strings, not placeholders)

| Key | اردو | Roman Urdu | English |
|---|---|---|---|
| `role.worker` | میں کام کرتا ہوں | Main kaam karta hoon | I do work |
| `role.customer` | مجھے کام کرانا ہے | Mujhe kaam karana hai | I need work done |
| `onboard.q1` | آپ کیا کام کرتے ہیں؟ | Aap kya kaam karte hain? | What work do you do? |
| `onboard.q2` | کتنے سال سے؟ | Kitne saal se? | For how many years? |
| `onboard.q3` | آپ کس علاقے میں کام کرتے ہیں؟ | Aap kis ilaqe mein kaam karte hain? | Which area do you work in? |
| `onboard.q4` | اپنے کام کی تصویر دکھائیں | Apne kaam ki tasveer dikhayein | Show a photo of your work |
| `voice.listening` | سن رہے ہیں… | Sun rahe hain… | Listening… |
| `voice.retry` | دوبارہ بولیں | Dobara bolein | Say that again |
| `status.free` | فارغ ہوں | Faarigh hoon | Available |
| `status.busy` | کام پر ہوں | Kaam par hoon | On a job |
| `status.off` | آج چھٹی | Aaj chutti | Off today |
| `job.accept` | ہاں، کرلوں گا | Haan, kar loonga | Yes, I'll do it |
| `job.decline` | ابھی نہیں | Abhi nahi | Not now |
| `job.done` | کام مکمل | Kaam mukammal | Job complete |
| `price.ask` | کتنے پیسے لگیں گے؟ | Kitne paise lagenge? | What will it cost? |
| `trust.jobs` | مکمل کام | Mukammal kaam | jobs completed |
| `nearby` | قریب | Qareeb | nearby |
| `review.speak` | اپنی رائے بولیں | Apni raaye bolein | Speak your review |

## Appendix B — Pre-demo design checklist

- [ ] Squint test passed on all 9 worker screens (screenshot, blur 8px, still operable)
- [ ] Every icon has an `aria-label`; every status has an icon *and* a shape, not just a colour
- [ ] Worker flow completed start-to-finish with the keyboard physically unavailable
- [ ] RTL verified: no `margin-left`/`padding-right` anywhere in the codebase (`grep` it)
- [ ] 320px width and 200% zoom: no horizontal scroll, no clipped text
- [ ] Dark mode is a real palette, not `filter: invert()`
- [ ] `prefers-reduced-motion` honoured on all three signature motions
- [ ] Lighthouse accessibility at least 95 on the worker home and the customer results screen
- [ ] Zero dead controls; every mocked surface visibly labelled as mocked
- [ ] Contrast audited: worker text at least 7:1, customer text at least 4.5:1
- [ ] The five AI surfaces in Section 6 are each visibly labelled and each demonstrably load-bearing
