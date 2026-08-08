# Internal dashboards

The LVRGD internal tools. One repo, one project per folder — they share a design
system (tokens, the LVRGD mark, the SF type stack, the light/dark toggle) but deploy
independently.

| Folder | What it is |
| --- | --- |
| [`cmo-dashboard/`](cmo-dashboard) | Weekly board, client roster, SOP library, encrypted login vault. |

Each folder is a self-contained Next.js app with its own `package.json`, Prisma schema
and environment. Install and run from inside one:

```bash
cd cmo-dashboard
npm install
cp .env.example .env
npm run dev
```

## Deploying

One Vercel project per folder, with **Root Directory** set to that folder in the
project's settings. Each carries its own `vercel.json`, which runs
`prisma migrate deploy` as part of the build.

## Secrets

No credentials, connection strings or account values belong in this repository. Every
project reads them from the environment and ships a `.env.example` listing the names
with blank values. `.env` is ignored everywhere.
