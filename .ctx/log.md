# ctx log — Roshan Rozgar (CUI Tech Fest / AI Web Forge)

## 2026-11-10T10:30:00Z

Cloned https://github.com/Riftwalker23/HACK and extracted
`Roshan_Rozgar_Problem_Statement.pdf` with pdftotext. Brief: build a web platform
connecting Pakistani households to nearby skilled trade workers, usable by
low-literacy workers. Five required outcomes (onboarding, discovery,
communication, booking, trust), judged 30/20/20/15/15 on technical execution,
problem understanding, use of AI, usability, presentation. AI must be
load-bearing — judges explicitly ask what breaks if it is removed.

Wrote and pushed `Design.md` (commit 51ca79d): a copy-paste master design prompt.
Core design decision — **two skins over one system** rather than one app with a
language toggle, because the worker (cannot read or type) and the customer
(wants speed and trust) have opposite constraints. Added the "squint test" as the
worker-side acceptance bar, a trade colour-coding quadruple (colour + glyph +
Urdu word + spoken label) as the accessibility centrepiece, Naskh-for-body /
Nastaliq-for-display type decision, 12 component specs, 16 screens, and a
bilingual copy deck.

Wrote `PROJECT.md`: outcomes-to-features mapping, the "what breaks without the
AI" table, stack (single Next.js app + Postgres, chosen for reliability over
novelty), data model with a partial unique index enforcing one active job per
worker at the DB level, API surface with an explicit ranking formula, seed plan
with three scripted demo accounts, hour-by-hour one-day timeline with an 18:30
feature freeze, a rehearsed 5-minute demo script, and a risk register.

Remaining: none for the docs. Next step for the team is to initialise the
application repo *after* the official start time (originality rule) and build in
demo-script order.
