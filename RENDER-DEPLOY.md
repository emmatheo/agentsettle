# Deploy the dashboard to Render

The frontend is already Render-ready — there's a `render.yaml` blueprint at the
repo root. You just push the repo to GitHub and connect it to Render.

## Prerequisite
Deploy the contracts first and have your three addresses ready
(see **REMIX-DEPLOY.md**). You *can* deploy the site before the contracts exist —
it will build fine and show a "Contracts not configured" banner — but the app
only becomes usable once the three env vars are set.

## Steps

### 1. Push the project to GitHub
Create a new repo (e.g. `agentsettle`) and push the whole project to it. From the
unzipped folder:
```bash
git init
git add .
git commit -m "AgentSettle"
git branch -M main
git remote add origin https://github.com/<you>/agentsettle.git
git push -u origin main
```
The `.gitignore` already excludes `.env`, `node_modules`, and build artifacts, so
no secrets get pushed.

### 2. Create the Render service (Blueprint)
- Go to **https://dashboard.render.com** → **New** → **Blueprint**.
- Connect your GitHub and pick the `agentsettle` repo.
- Render detects `render.yaml` and proposes an **agentsettle-web** Web Service.
- It will **prompt you for three values** (they're marked "sync: false"):
  - `NEXT_PUBLIC_AGENTSETTLE_FACTORY`
  - `NEXT_PUBLIC_AGENTSETTLE_SETTLEMENT`
  - `NEXT_PUBLIC_AGENTSETTLE_REGISTRY`
  Paste the three addresses from the Remix step.
- Click **Apply**. Render installs, builds (`npm run build`), and starts it.

### 3. Wait for the build, then open it
First build takes a few minutes. When it goes live you'll get a URL like
`https://agentsettle-web.onrender.com`. Open it, connect MetaMask, click
**Switch to Arc**, and deploy an agent wallet — the "final in ~N ms" readout is
your live demo.

## If you're not using the blueprint (manual setup)
New → **Web Service** → connect repo, then set:
- **Root Directory:** leave **blank** (use the repo root). The build/start
  commands below `cd web` themselves, so you do *not* set a Root Directory of
  `web`. Setting it can trigger `Root directory "web" does not exist` if the
  service setting ever falls out of sync with the checkout.
- **Build Command:** `cd web && npm install && npm run build`
- **Start Command:** `cd web && npm run start`
- **Environment:** add the three `NEXT_PUBLIC_AGENTSETTLE_*` vars.

> **Already hit `Root directory "web" does not exist`?** Open your service →
> **Settings** → **Build & Deploy**, clear the **Root Directory** field (leave
> it blank), and switch the Build/Start commands to the `cd web && …` forms
> above. Then **Manual Deploy → Clear build cache & deploy**. Blueprint users
> get this automatically on the next sync of `render.yaml`.

## Important: changing addresses later
`NEXT_PUBLIC_*` values are baked in at **build time**. If you redeploy the
contracts and get new addresses, update the env vars in Render **and trigger a
manual deploy** (Render → your service → "Manual Deploy" → "Clear build cache &
deploy") so the new values are compiled in. A plain restart won't pick them up.

## Free-plan note
Render's free web services spin down after ~15 minutes idle and take ~30–60s to
wake on the next request. For a live hackathon demo, open the URL a minute before
you present so it's warm. (This is the same cold-start behavior you saw with your
earlier Render deploys.)
