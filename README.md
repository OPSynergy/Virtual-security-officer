# Virtual Security Officer — AI-Powered Security Advisor

> Enterprise-grade cybersecurity for small businesses, powered by AI

Small and medium-sized businesses are prime targets for cyber attacks, but most available tools are either too expensive, too technical, or built for large security teams. Virtual Security Officer closes that gap with automated security scanning, plain-language risk guidance, and actionable remediation workflows designed for founders and lean operations teams.

## Key Features

- 5-module automated security scanner (SSL, DNS, Email, Headers, Ports)
- AI-powered explanations in plain business language
- Real-time security score with grade (A-F)
- Crisis detection and automated email alerts
- Demo mode — no signup required

## Tech Stack

| Backend | Frontend | AI | Database | Queue |
|---|---|---|---|---|
| FastAPI, SQLAlchemy 2.0, Alembic, Celery | React 18, Vite, Tailwind CSS, shadcn/ui, Recharts | Google Gemini | PostgreSQL | Redis + Celery Beat/Worker |

## Local Setup

1. `git clone <repo>`
2. `cp .env.example .env`
3. Fill in `GEMINI_API_KEY`, Supabase keys, and `RESEND_API_KEY` (optional: `GEMINI_MODEL`, default `gemini-2.0-flash`)
4. `cd backend && pip install -r requirements.txt`
5. `cd frontend && npm install`
6. Make sure PostgreSQL is running locally on port `5432`
7. Make sure Redis is running locally on port `6379`
8. **Install [Nmap](https://nmap.org/)** on the host that runs the Celery worker (the Ports module shells out to `nmap`). Example: `sudo apt install nmap` (Debian/Ubuntu), `brew install nmap` (macOS). `./run.sh` checks this before starting.
9. `cd backend && alembic upgrade head`
10. `bash run.sh`
11. Open [http://localhost:3000](http://localhost:3000)

`GET /health` includes `nmap_available: true|false` so you can confirm the API process sees `nmap` on `PATH`.

## Demo Mode

Demo mode can be toggled from the app when available (sample data without a live scan pipeline).

## Architecture

```text
Frontend (React/Vite :3000)
     ↓ REST + SSE
Backend (FastAPI :8000)
     ↓               ↓
PostgreSQL       Redis + Celery
                     ↓
               5 Scanner Modules
                     ↓
              Google Gemini (chat & remediation)
```
