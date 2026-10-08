# Deployment: Cloud Run or Firebase

> Last verified: 2026-09-26. **Rule:** the prototype must be deployed on Cloud Run or Firebase (GCP), and the live URL is a mandatory deliverable.

## Pick one
| Option | Best for | Docs |
|---|---|---|
| **Cloud Run (service)** | Any containerized backend or full-stack app: Python, Node, Go, ADK agents | https://cloud.google.com/run/docs |
| Cloud Run functions | Small event-driven functions | https://cloud.google.com/run/docs/deploy-functions |
| Cloud Run + GPU | Self-hosting Gemma or other open models | https://cloud.google.com/run/docs/configuring/services/gpu |
| **Firebase App Hosting** | Next.js, Angular or other full-stack web frameworks, deployed from GitHub | https://firebase.google.com/docs/app-hosting |
| Firebase Hosting | Static or SPA frontends, often paired with a Cloud Run backend | https://firebase.google.com/docs/hosting |

## Cloud Run quick path
- Install the gcloud CLI: https://cloud.google.com/sdk/docs/install
- Quickstarts: https://cloud.google.com/run/docs/quickstarts
- Deploy from source, with no Dockerfile needed for common runtimes: https://cloud.google.com/run/docs/deploying-source-code

```bash
gcloud run deploy <service-name> --source . --region asia-southeast1 --allow-unauthenticated
```

- `asia-southeast1` is Singapore. It's close to the JAPAC judges and the finale venue.
- ADK agents have a dedicated guide: https://google.github.io/adk-docs/deploy/cloud-run/

## Firebase quick path
- Docs: https://firebase.google.com/docs
- App Hosting connects to the GitHub repo and deploys on push.

## Keep it alive for judging
The URL has to work from **Oct 18 through Nov 6** (judging), and until **Dec 4** if we reach the finale.
- [ ] Set **billing budget alerts**: https://cloud.google.com/billing/docs/how-to/budgets
- [ ] Check free-tier and trial credits: https://cloud.google.com/free
- [ ] Consider `--min-instances=1` during judging to avoid cold starts, and weigh it against cost.
- [ ] Watch rate limits and quotas on Gemini calls. A judge who hits a 429 is a bad demo.
- [ ] Add a graceful fallback or cached demo data in case an upstream AI call fails.
- [ ] No secrets in the repo. Use Secret Manager (https://cloud.google.com/secret-manager/docs) or service-account IAM.
- [ ] Run a smoke test against the live URL from an incognito window the day before submitting.
