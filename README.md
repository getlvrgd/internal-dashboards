# Internal dashboards

The LVRGD internal tools, behind one owner backend.

This used to be one folder per dashboard, each its own Vercel project. It is now a
single Next.js app: the owner hub lists every internal dashboard, and each dashboard
lives at a route inside it, sharing one database, one login and one deploy. Adding the
next dashboard is a button, not a new codebase.

```
/               decides where you belong and sends you there
/login          one sign-in for everyone
/setup          first run only — creates the owner and the first dashboard
/hub            OWNER + ADMIN — every dashboard, and the state of each
/hub/people     OWNER + ADMIN — one roster of every account
/d/<slug>       one dashboard's weekly board
/d/<slug>/clients        client roster; a client's logins live on their page
/d/<slug>/sops           the SOP library
/d/<slug>/team           who can open this dashboard
/d/<slug>/settings       name, status, colour, template, delete
/switch         the picker, when someone has more than one dashboard
```

The app still lives in [`cmo-dashboard/`](cmo-dashboard) — the folder name is now a
misnomer and is worth renaming, but doing so means updating the Vercel project's Root
Directory at the same time.

## Who can see what

| | `/hub` | A dashboard they're on | A dashboard they're not on |
| --- | --- | --- | --- |
| Owner | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ |
| Member | ❌ | ✅ | ❌ (404, so the app never confirms it exists) |
| Viewer | ❌ | read-only | ❌ |

A **platform role** (on the account) decides whether you reach the owner hub and every
dashboard. A **membership** decides what you may do inside one dashboard you have been
given — the same person can manage one and only read another. Both are enforced in
`src/lib/access.ts`, which every page and every server action calls first, so a crafted
URL or a replayed form post lands on the same check as a click.

Deleting a dashboard is the owner's alone.

## Logins

A login belongs to the client whose account it is, and lives on that client's page.
There is no company-wide vault and no `/logins` route — logins differ per client, so a
shared folder was the wrong shape.

Passwords are sealed with AES-256-GCM before they are written (`src/lib/secrets.ts`) and
are never decrypted to render a list. Revealing one is a separate request per row,
available only to a manager of that dashboard, and it hides itself again after thirty
seconds.

## Deploying

One Vercel project, **Root Directory `cmo-dashboard`**. `npm run build` runs
`prisma migrate deploy` first, so the schema applies itself on deploy.

Environment variables:

```
DATABASE_URL      supplied by the Neon integration
AUTH_SECRET       32+ chars — signs session cookies
CREDENTIAL_KEY    32+ chars — encrypts the logins. Set it once and keep it:
                  changing it makes every stored password unreadable.
```

## Running it locally

Needs a Postgres.

```bash
cd cmo-dashboard
npm install
cp .env.example .env      # fill in the three values above
npx prisma migrate deploy
npm run dev
```

An empty database sends you to `/setup`, which creates the one owner account and the
first dashboard. That route closes permanently once an owner exists, so there is never a
public page that mints access.

## Secrets

No credentials, connection strings or account values belong in this repository. Every
value is read from the environment, and `.env.example` lists the names with blank
values. `.env` and `.env.local` are ignored.
