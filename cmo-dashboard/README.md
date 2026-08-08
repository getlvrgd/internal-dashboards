# CMO Dashboard

The weekly board, the client roster, the SOP library and the login vault, in one
place. Same stack and same design tokens as `sales-team-hub` and `hub`, so the three
read as one system.

Next.js 16 · Prisma 7 · Postgres · Tailwind 4 · deployed on Vercel.

## What is in it

**The board** (`/`) — one week at a time, Monday to Sunday, with a to-do list
underneath for anything not yet tied to a day. The week lives in the URL, so a
particular week is a link you can send someone.

- Tick a task off in one tap; the other three states (not started, in progress,
  blocked) are on the row's status menu.
- Mark a task **Weekly** and it is copied into every following week automatically,
  starting fresh each time. That is the standing routine.
- Anything unfinished from last week can be swept into this one with a single
  button, which tells you how many rows it will move before you press it. Nothing
  moves on its own — a past week's board should keep saying what actually happened
  in it.
- Filter the whole board to one client or one person. Add a task while filtered and
  it inherits that client and person, so filing five tasks against a client is five
  sentences.
- The progress bar and the blocked count sit at the top of the week.

**KPI tiles** — four numbers across the top, kept by hand. Deliberately not synced
from ad platforms: a dashboard that half-syncs is worse than one that does not,
because a stale figure looks exactly like a fresh one. Each tile shows when it was
last touched, so an old number admits it.

**Clients** (`/clients`) — a record per client rather than a fixed set of tabs.
Each carries its own quick links (Drive, Trello, ad accounts), offer owner, status,
notes, open work and logins. Adding a client is a form, not a code change.

**SOPs** (`/sops`) — every area on one page with a count beside each heading, rather
than tabs that hide eight areas out of nine. An empty count is a gap in the playbook,
and you can see it without clicking.

**Logins** (`/logins`) — owner and admins only. See below.

**Team** (`/team`) — who can sign in and what they can reach.

## Roles

| Role | Board & clients | SOPs | Login vault | Team |
| --- | --- | --- | --- | --- |
| Owner | edit | edit | yes | yes |
| Admin | edit | edit | yes | yes |
| CMO | edit | edit | **no** | no |
| Viewer | read | read | no | no |

There is one owner, created by first-run setup and by nothing else. The role cannot
be granted or taken from the Team page, so there is always exactly one account that
cannot be locked out.

Access is revoked by deactivating an account rather than deleting it, so past tasks
keep the person who owned them.

## The login vault

Passwords are encrypted at rest with AES-256-GCM (`src/lib/secrets.ts`) under
`CREDENTIAL_KEY`. Nothing decrypts them to render the page — the list is built from
rows where the ciphertext was never even selected — and revealing one is a deliberate
click that fetches that single password and hides it again after thirty seconds.

**What that buys you:** a database dump, a stray backup or an over-broad read replica
is not a leak of your credentials. This is the main thing the Notion table it replaces
got wrong, where every password sat in plain text for anything with read access.

**What it does not:** the key lives in the environment beside the code, so anyone who
can run the app can read the vault. That is what the role check is for. For accounts
that should outlive a team change, keep a password manager as the source of truth and
treat this as the working copy.

Changing `CREDENTIAL_KEY` makes every stored password unreadable. Set it once.

## Running it

```bash
npm install
cp .env.example .env      # then fill in the three values
npx prisma migrate deploy
npm run dev
```

Then open `/setup` once to create the owner account. That route closes itself
afterwards, so there is never a public page that mints an account.

### Environment

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | Postgres. On Vercel, the pooled URL from the Neon integration. |
| `AUTH_SECRET` | Signs session cookies. 32+ characters. |
| `CREDENTIAL_KEY` | Encrypts the login vault. 32+ characters, set once. |

Generate the two secrets with:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

Migrations run against `DATABASE_URL_UNPOOLED` when Neon publishes it — schema
changes take advisory locks a transaction-mode pooler cannot carry. See
`prisma.config.ts`.

### Deploying

Push to a Vercel project with the Neon integration attached, then add `AUTH_SECRET`
and `CREDENTIAL_KEY` as environment variables. `vercel.json` runs
`prisma migrate deploy` as part of the build, so the schema is applied on deploy.

## What first-run setup creates

The nine SOP areas from the board this replaces (Ads, YouTube, Instagram, VSL Funnel,
Calls, Claude, Webinar, Waitlist, Messaging), the four Ads funnels, four starter KPI
tiles, and **blank** login rows for the services that need an account — Kit, Gmail,
Calendly, Instagram, YouTube, Trakyo, GoDaddy.

Blank on purpose. No password, email or account value is carried over in code:
credentials in a repository would live there forever and defeat the encryption
entirely. Fill them in through `/logins`, where they are encrypted on the way to the
database.
