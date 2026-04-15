# Compass Cashroom Management System

A production-grade financial compliance and cash management platform designed to streamline daily cashroom operations, verification workflows, and audit trails.

The **Compass Cashroom Management System** solves the complexity of manual cash handling and multi-role verification in high-volume environments (e.g., airport concessions). It eliminates paper-based trails, reduces variance through automated validation, and ensures 100% compliance with corporate financial standards.

---

## 🏗 Architecture Overview

The system follows a modern decoupled architecture, utilizing a React-based Single Page Application (SPA) that communicates with a RESTful backend API.

### System Architecture Diagram (ASCII)


```text
      ┌──────────────────────────────────────────────────────────┐
      │                   CLIENT LAYER (React)                   │
      │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
      │  │ Operator │  │ Manager  │  │Controller│  │ Regional │  │
      │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
      └───────┬──────────────────────────────────────────▲───────┘
              │                                          │
      ┌───────▼──────────────────────────────────────────┴───────┐
      │                   API GATEWAY / ROUTING                  │
      └───────┬──────────────────────────────────────────▲───────┘
              │                                          │
      ┌───────▼──────────────────────────────────────────┴───────┐
      │                  BUSINESS LOGIC LAYER                    │
      │  ┌────────────┐  ┌────────────┐  ┌────────────┐          │
      │  │ Auth Logic │  │ Cash Count │  │ Audit Logs │          │
      │  └────────────┘  └────────────┘  └────────────┘          │
      └───────┬──────────────────────────────────────────▲───────┘
              │                                          │
      ┌───────▼────────┐                        ┌────────┴───────┐
      │    DATABASE    │                        │ EXTERNAL APIS  │
      │ (PostgreSQL)   │                        │ (Email/SLA)    │
      └────────────────┘                        └────────────────┘

```

---

## 📂 Project Structure

```text
src/
├── api/              # API abstraction layer using Axios
│   ├── admin.ts      # Administrative configuration endpoints
│   ├── auth.ts       # Authentication and session management
│   └── submissions.ts# Cash count submission endpoints
├── assets/           # Static assets (images, SVGs)
├── components/       # Atomic UI components
├── mock/             # Mock data for offline development and testing
├── pages/            # Role-based dashboard implementations
│   ├── admin/        # System-wide configuration and user management
│   ├── controller/   # Verification logging and visit scheduling
│   ├── manager/      # Approval workflows and history
│   └── operator/     # Cash count entry (Form/Excel/Chat)
├── utils/            # Shared business logic and access control
├── App.tsx           # Main application router and state entry
└── main.tsx          # Application bootstrap

```

---

## ✨ Key Features

* **Multi-Method Cash Entry:** Operators can submit daily counts via dynamic forms, Excel bulk uploads, or an AI-assisted chat interface.
* **Verification Workflow:** Scheduled and ad-hoc verification visits (Controller/DGM) with automated variance alerts.
* **Approval Pipeline:** Multi-stage approval process with 48-hour SLA tracking and automated notifications.
* **Real-time KPI Monitoring:** Dashboards providing instant visibility into variance percentages, overdue visits, and coverage.
* **Audit Trail:** Comprehensive, immutable log tracking every config change, user creation, and submission.

---

## 🛠 Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | React 18 (TypeScript), Vite, CSS Modules |
| **State Management** | React Hooks (useState, useMemo, useEffect) |
| **Charts** | Recharts (Trend Analysis) |
| **API Client** | Axios (RESTful API interaction) |
| **Testing** | Playwright (E2E), Vitest (Unit) |
| **Linting** | ESLint (Strict TypeScript rules) |

---

## 🔐 Role-Based Access Control (RBAC)

The application implements strict location-scoping and permission models.

| Role | Permissions | Primary Responsibility |
| --- | --- | --- |
| **Operator** | Read/Write Submissions | Daily cashroom count entry |
| **Manager** | Approve/Reject Submissions | Reviewing operator counts for assigned units |
| **Controller** | Log Verifications | Scheduling and performing unit audits |
| **DGM** | Log Monthly Visits | Compliance and coverage checks |
| **Admin** | System Config | User management and audit log review |

---

## 🧪 Testing Infrastructure

The project utilizes a comprehensive testing strategy to ensure financial accuracy.

* **Unit Testing:** Validates mathematical utility functions for variance and currency formatting.
* **Integration Testing:** Tests data flow between the API client and frontend components.
* **End-to-End (E2E):** Full-path testing using Playwright, covering login to final approval.

---

## 🚀 Development Setup

### Getting Started

1. **Clone the Repository:**
```bash
git clone https://github.com/your-org/compass-frontend.git
cd compass-frontend

```


2. **Install Dependencies:**
```bash
npm install

```


3. **Configure Environment:**
Create a `.env` file in the root directory:
```env
VITE_API_BASE_URL=https://api.compass-cashroom.com
VITE_ENV=development

```


4. **Run Development Server:**
```bash
npm run dev

```



### Other Commands

* **Build Project:** `npm run build`
* **Lint Code:** `npm run lint`
* **Run E2E Tests:** `npx playwright test`

---

## 🛡 Security Practices

* **Token-Based Auth:** Secure session management with HTTP-only cookies/Bearer tokens.
* **Location Scoping:** Data isolation ensures users only see data belonging to their assigned locations.
* **Input Sanitization:** Strict validation for all financial entries and currency inputs.
* **Audit Logging:** All sensitive actions are logged with actor, timestamp, and entity ID.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.