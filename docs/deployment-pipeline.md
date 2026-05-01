# Deployment Pipeline

Production URL: `https://dashboardpriv.claricont.com`

## Flow

1. Work happens on `codex/<task>` branches.
2. GitHub Actions CI runs on branches and pull requests.
3. Merge to `main` only after checks pass.
4. `Deploy Production` runs from `main`, connects to the VPS over SSH, pulls the exact commit, rebuilds Docker Compose, and verifies production health.

The VPS is not the source of truth. GitHub `main` is.

## GitHub Actions Cost

For public repositories, standard GitHub-hosted Actions runners are free. For private repositories, GitHub includes a free quota of hosted-runner minutes and storage based on the account plan; usage over the quota can be billed. Keep the Actions spending limit at `0` if you want a hard stop instead of surprise charges.

## Required Repository Secrets

Set these in GitHub: `Settings -> Secrets and variables -> Actions`.

- `VPS_HOST`: `72.56.85.224`
- `VPS_USER`: `root`
- `VPS_SSH_KEY`: private SSH key that GitHub Actions uses to log in to the VPS
- `PRODUCTION_URL`: `https://dashboardpriv.claricont.com`

The VPS also needs a read-only GitHub deploy key so it can fetch the private repository.

## Manual Deploy

From GitHub, run `Actions -> Deploy Production -> Run workflow`.

From the VPS:

```bash
cd /opt/bitrix24-reporting/app
DEPLOY_REPO=git@github.com:Vladick-Pick/bitrix24-attraction-dashboards.git \
DEPLOY_REF=origin/main \
DEPLOY_HEALTH_URL=https://dashboardpriv.claricont.com/api/health \
DEPLOY_DASHBOARD_URL=https://dashboardpriv.claricont.com/api/dashboard \
bash scripts/deploy-production.sh
```

## Rollback

Find a previous good commit:

```bash
cd /opt/bitrix24-reporting/app
git log --oneline -10
```

Rollback:

```bash
bash scripts/rollback-production.sh <commit-sha>
```

## Production Checks

Expected:

```bash
curl -i https://dashboardpriv.claricont.com/api/health
# 200

curl -i https://dashboardpriv.claricont.com/api/dashboard
# 401 before login

curl -i https://dashboardpriv.claricont.com/.env.production
# 404

curl -m 3 http://72.56.85.224:8787/api/health
# connection fails or times out
```
