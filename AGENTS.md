# Project Memory & User Instructions (AGENTS.md)

## 📌 Project Overview
- **Project Name:** Ops Showcase Dashboard
- **Root Path:** `C:\Users\USER\.gemini\antigravity\scratch\ops-showcase-dashboard`
- **Frontend Stack:** React / Vite (`frontend/`)
- **Backend Stack:** Node.js / Express / SQLite (`backend/`)
- **Infrastructure:** Docker Compose, Nginx Proxy

## 📝 Key Notes & Context from Previous Chat Session
1. **IDE Context Switching:** The user transitioned to Antigravity IDE to work directly on this workspace.
2. **Project Files Structure:**
   - Frontend source: `frontend/src`
   - Backend source: `backend/src`
   - SQLite DB: `backend/database.sqlite`
   - Project docs: `DOCUMENTATION.md`, `README.md`
   - Offline & Docker scripts: `docker-compose.yml`, `start.bat`, `export-for-server.bat`
3. **Execution Rules & Fully Autonomous Mode:**
   - **Zero Interactive Prompting:** Never call `ask_question` tool or ask for manual approvals/acceptances from the user.
   - **Direct Execution:** Execute all code edits, file creations, commands, bug fixes, and verifications directly without stopping for user approval or requiring manual accepts.
   - Maintain clean modular structure between frontend and backend.
   - Support seamless transitions between CLI, Desktop Agent, and Antigravity IDE.
   - Strictly respect `.gitignore` rules (do not push or expose local config files).


