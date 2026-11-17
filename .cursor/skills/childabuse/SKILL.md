---
name: childabuse
description: >-
  Publish and maintain mingleX externally available CSAE (child sexual abuse and
  exploitation) standards for Google Play and store reviews. Use when the user
  mentions CSAE, child safety standards, /childabuse, Play Console child sexual
  abuse standards URL, or asks for a public anti-CSAE policy page.
---

# CSAE standards (`/childabuse`)

## Goal

Keep a **public web URL** that states mingleX’s standards against child sexual abuse and exploitation (CSAE). Play Console and similar stores ask for this link.

## Canonical URL

`https://minglexx.netlify.app/childabuse`

## Where it lives

- Page content and route: `web/src/policyPages.tsx` (`path: "/childabuse"`)
- Routed via `web/src/main.tsx` + Netlify SPA redirect in `web/netlify.toml`
- Play copy reference: `docs/google-play-listing.md` (CSAE standards URL section)

## Required page content

When creating or updating the page, include:

1. Clear title naming CSAE / child sexual abuse and exploitation standards
2. Adults **18+** only
3. Zero tolerance for CSAM, grooming, exploitation, and sexual content involving minors (including AI-generated)
4. How users report (in-app report/block + safety email)
5. Enforcement (remove content, ban accounts, retain limited safety records)
6. Cooperation with applicable law / lawful authority requests
7. Contact email for safety reports
8. Links to `/privacy`, `/tandc`, `/delete`

## Play Console

Paste: `https://minglexx.netlify.app/childabuse`

After web changes, deploy the Netlify `web` site so the live URL updates before submitting the form.

## Do not

- Do not put this only inside the app binary; stores need an **external HTTPS** page
- Do not invent a second competing URL; keep `/childabuse` as the canonical path
