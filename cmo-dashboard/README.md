# Internal dashboards — the app

One Next.js app hosting every internal dashboard, behind an owner hub. The CMO
dashboard is the first row in `Dashboard`, not the product.

> The folder is still called `cmo-dashboard` for historical reasons. Renaming it means
> changing the Vercel project's **Root Directory** to match, so the two have to move
> together. See the [repo README](../README.md) for routes, roles and deployment.

## Shape

```
src/lib/access.ts     every guard. Pages and actions call it first.
src/lib/options.ts    the fixed vocabularies: roles, statuses, tints.
src/lib/sops.ts       the SOP block model — types, parsing, the starter library.
src/lib/secrets.ts    AES-256-GCM for the logins.
src/lib/seed.ts       what a new dashboard is created with.
src/lib/week.ts       week arithmetic; the one place a new week's rows come from.

src/app/hub/          the owner backend
src/app/d/[slug]/     one dashboard
src/app/actions/      every write, one file per area
```

## The two role systems

A **platform role** on the account (`OWNER` / `ADMIN` / `MEMBER` / `VIEWER`) decides
whether you reach the owner hub and every dashboard. A **membership**
(`MANAGER` / `MEMBER` / `VIEWER`) decides what you may do inside one dashboard you have
been given.

They are separate on purpose: handing someone the CMO dashboard should not hand them
the next one you build. Membership is read from the database on every request rather
than baked into the session cookie, so revoking access takes effect immediately instead
of whenever a thirty-day token expires.

## SOPs

The library is one JSON document per dashboard — sections hold pages, pages hold blocks,
and a block is a link, an embedded video, a written note or a checklist. This is the
same model the sales rep hub uses, so the two products are edited the same way.

It is a document rather than tables because a library is always read and written whole;
nothing queries "every SOP across dashboards by category", and modelling it as rows
bought joins no page ever needed.

## Logins

A login belongs to a client and lives on that client's page. There is no company-wide
vault. Passwords are sealed before they are stored and never decrypted to render a list
— revealing one is a separate request per row, for a manager of that dashboard only.

## Running it

```bash
npm install
cp .env.example .env      # DATABASE_URL, AUTH_SECRET, CREDENTIAL_KEY
npx prisma migrate deploy
npm run dev
```

An empty database sends you to `/setup`, which creates the one owner account and the
first dashboard, then closes permanently.
