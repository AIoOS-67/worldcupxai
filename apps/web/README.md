# @worldcupxai/web

Next.js 15 (App Router) source for **worldcupxai.com** — the landing page and
chat shell for World Cup X AI, our entry to the Google Cloud Rapid Agent
Hackathon (Elastic Partner Track).

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript 5 (strict)
- Tailwind CSS 3 (no external UI libraries)
- Edge runtime for the `/api/chat` stub

## Develop

```bash
pnpm install
pnpm --filter @worldcupxai/web dev
# http://localhost:3000
```

## Scripts

```bash
pnpm --filter @worldcupxai/web typecheck   # tsc --noEmit
pnpm --filter @worldcupxai/web build       # production build
pnpm --filter @worldcupxai/web lint        # next lint
```

## Deploy to Vercel

1. Create a new Vercel project from this repository.
2. Set the **Root Directory** to `apps/web`.
3. Add the environment variables from `.env.example`.
4. Add the custom domain `worldcupxai.com` in Vercel → Domains.
5. Point the domain's nameservers (or an A/ALIAS record) at Vercel per their UI.

## Status

- [x] Landing scaffold (Hero · Features · HowItWorks · CTA · Chat · Footer)
- [x] `/api/chat` stub returning a canned English reply
- [ ] Wire `/api/chat` to Google Cloud Agent Builder + Elastic MCP
- [ ] Multilingual switcher (en / es / zh)
- [ ] PWA manifest and offline shell
