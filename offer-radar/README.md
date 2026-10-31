# Offer Radar 2027

Jobs, hiring process, DSA by company and DSA practice for the 2027 batch.
Static front end (`public/`) + Vercel serverless API (`api/`) + daily cron.

## How "dynamic" works
- `/api/refresh` runs daily (Vercel Cron). It asks Claude (with web search) for open 2027-batch roles in one group per day: service -> product -> startup. Results are merged into Redis.
- `/api/jobs` serves the stored offers; the page merges them with the built-in list on load.
- "Search web now" and "Refresh this process" call `/api/search` live. Process results are cached 7 days.
- Your API key stays on the server. `/api/search` allows 10 live searches per IP per hour per instance.

## Deploy (about 10 minutes)
1. Push this folder to a GitHub repo.
2. vercel.com -> Add New -> Project -> import the repo. No build settings needed.
3. Project -> Storage -> add **Upstash Redis** (Marketplace). It adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
4. Project -> Settings -> Environment Variables: `ANTHROPIC_API_KEY`, `CRON_SECRET` (any long random string).
5. Redeploy. Test: open `https://YOUR-APP.vercel.app/api/refresh` with header `Authorization: Bearer <CRON_SECRET>` (or use curl), then reload the site.

## Local
`npm i -g vercel && cp .env.example .env.local && vercel dev`

## Add your own data
- Built-in roles: the `D` array in `public/index.html`.
- Process pages: `PF["Company"] = P5(eligibility, apply, assessment, technical, hr)`.
- Company groups the cron searches: `GROUPS` in `api/_lib.js`.

## Notes
- Without Redis the site still works; live search works but results are not stored.
- Hobby plan crons run once a day, which is why the cron rotates through groups.
- Always confirm eligibility and deadlines on the company's official page.
