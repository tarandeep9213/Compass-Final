# Contributing to Compass Cashroom Management System

First off, thank you for contributing! This document provides the mandatory guidelines, local environment setup instructions, and Git hygiene practices required to contribute to the Compass Cashroom Management System. 

Please read this document carefully to ensure a smooth development workflow and to prevent sensitive data or junk files from entering the repository.

---

## 1. Local Development Setup

We maintain a decoupled architecture. You will need to run the backend and frontend simultaneously, or use Docker for a containerized setup.

### Backend Setup (FastAPI / Python)

1. **Create and Activate a Virtual Environment:**
   
   Open your terminal (VS Code or standard) and run:
   ```powershell
   # Navigate into the backend directory
   cd backend
   
   # Create a new isolated Python environment named '.venv' to keep project dependencies separate from your global system
   python -m venv .venv
   
   # (Windows Only) Modify execution policies to allow running the activation script below
   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
   
   # Activate the virtual environment (your terminal prompt should now show '(.venv)')
   .\.venv\Scripts\Activate.ps1  (or `.\.venv\Scripts\Activate.ps1`)
   ```

2. **Install Dependencies:**
   ```powershell
   # Read the requirements file and download all necessary third-party Python libraries into your .venv
   pip install -r requirements.txt

   To update, run: python.exe -m pip install --upgrade pip
   ```

3. **Database Setup & Migrations:**
   ```powershell
   # Read migration scripts and update the database schema to the latest version ("head")
   alembic upgrade head

   #If you change a database model in Python, this command auto-detects the change and generates a script to update the actual database tables.
   alembic revision --autogenerate -m "..."

   # Inject realistic fake data (mock operators, cash submissions) for local UI testing
   python seed_demo.py
   
   # Inject the foundational system data (admin accounts, role definitions) required for the app to function
   python seed.py
   ```

4. **Run the Server:**
   ```powershell
   # Start the FastAPI server. Look in 'app/main.py' for the 'app' instance. 
   # '--reload' automatically restarts the server when you save a file.
   python -m uvicorn app.main:app --reload (or uvicorn app.main:app --reload)
   ```
   *The API will be available at `http://127.0.0.1:8000/docs` or 'http://localhost:8000/docs'.*

### Frontend Setup (React / Vite)

1. **Install Dependencies:**
   ```powershell
   # Navigate to the frontend directory
   cd frontend
   
   # Read package.json and download all React/Vite dependencies into the node_modules folder
   npm install
   ```

2. **Run the Development Server:**
   ```powershell
   # Start the Vite dev server with hot-module replacement (instant browser updates)
   npm run dev

   # Prepares your app for production. It first runs tsc -b to strictly check your TypeScript for errors, then bundles all your code into highly optimized, minified static files in the dist/ folder.
   npm run build

   #Runs ESLint to scan your frontend code for formatting issues, bad practices, or potential bugs based on your configured rules.
   npm run lint

   //Spins up a local web server to serve the dist/ folder. This lets you test the exact compiled code that will be deployed to Vercel, ensuring no build-specific bugs snuck in.
   npm run preview

   ```


## 2. Mail Server Testing

Do not send real emails during local development. We use a local mail catcher to intercept and verify outgoing notifications.

```powershell
# Activate your backend environment first
cd backend
.\.venv\Scripts\Activate.ps1

# Ensures the async SMTP server and database migration tools are installed.
pip install aiosmtpd alembic / pip install aiosmtpd / pip install alembic

# Ensures your database is fully set up before the mail server tries to interact with any logs or user tables.
python -m alembic upgrade head

# Start the custom local SMTP interceptor script
python mailcatcher.py
```

---

## 3. Database Management Utilities

If your local database gets out of sync or corrupted, use the following utilities in the `/backend` directory:

# Connects to your database and drops (deletes) all existing tables. Great for resetting a corrupted dev environment.
* **Clear Everything:** `python clean_db.py`
# Inserts foundational data needed for the app to function (e.g., system admin accounts, role definitions, initial config settings).
* **Base Setup (Admin/Roles):** `python seed.py`
# Injects realistic "fake" data (mock operators, test cash submissions, historical audits) so you can test the UI/Charts without manually typing in data.
* **Demo Data (Charts/Submissions):** `python seed_demo.py`

---

### Docker Setup (Optional but Recommended)

For a fully isolated environment that mirrors production:
```bash
# Builds the images and starts the containers. By default, this uses your local development setup (likely utilizing a lightweight SQLite database).
docker compose up --build

# The --profile prod flag tells Docker to boot up specific services tagged for production. In this case, it swaps out SQLite and spins up a full PostgreSQL database container alongside your app.
docker compose --profile prod up --build
```

---

Whenever you make code changes or want to start the system, open your terminal (PowerShell/CMD/Bash) in the root directory and run the following command to clean up old instances and build fresh containers:

**For Windows (PowerShell):**

```powershell
docker-compose down --remove-orphans ; docker-compose up -d --build
```

**For Mac/Linux/Git Bash:**

```bash
docker-compose down --remove-orphans && docker-compose up -d --build
```


## 4. Strict Git Hygiene & Security (Mandatory)

Due to the financial nature of this application, **security and repository cleanliness are critical**. 

### 🚫 NEVER COMMIT THESE FILES
Ensure your `.gitignore` is correctly configured to block:
* `campus.pem` / `campus_dev.pem` (Keep secrets in `C:\secrets` or similar)
* `.env` (Use `.env.example` instead)
* `*.db` (Local SQLite databases)
* `__pycache__/` and `*.pyc` (Python compiled files)
* `test-results/` (Playwright artifacts)

### Pre-Commit Local Cleanup (Windows)
Run these commands locally to destroy cache and test files before checking your Git status:

**Clear Python Cache:**
```cmd
:: Loop through all directories (/d /r .) looking for folders named '__pycache__'
:: If found, remove the directory (rd) including all contents (/s) quietly (/q)
for /d /r . %d in (__pycache__) do @if exist "%d" rd /s /q "%d"

:: Recursively and quietly delete all leftover compiled python files
del /s *.pyc
```

**Clear Test Artifacts:**
```cmd
:: Forcefully and quietly deletes the Playwright test artifact folder, which can get very large with screenshots and videos.
rd /s /q frontend\test-results
```

### 🚀 1. The "Fresh Repo" Workflow (Use this for new projects)
*Run this sequence when initializing a brand new repository to ensure secrets and caches are ignored from the very first commit.*

```bash
# 1. Initialize a brand new, empty Git repository in the current folder
git init

# STOP: Ensure your .gitignore is saved in the root before proceeding!
# 2. Stage all current files (Git will automatically ignore files listed in your .gitignore)
git add .

# 3. Check the status to manually verify no secrets or cache files slipped through
git status

# Unstages everything. Fix your .gitignore file to block the unwanted files.
git reset

# Final verification that the working tree is clean before pushing.
git status

# Stages and commits the clean project.
git add . -> git commit -m "Initial clean commit"

# 4. Save this initial clean state to your local Git history
git commit -m "Initial commit with proper .gitignore setup"

# 5. Connect your local repository to the remote GitHub server (replace URL with your actual repo URL)
git remote add origin https://github.com/your-username/your-repo-name.git

# Links your local code to the specific GitHub repo.
git remote add origin <URL>

# 6. Rename the default branch to 'main' (modern Git standard)
git branch -M main

# Pushes the code. The --force overrides anything currently on the remote repo with your clean local history.
git push -u origin main --force

# 7. Push your code to the remote server (-u sets 'main' as the default tracking branch)
git push -u origin main

# Final verification that the working tree is clean before pushing.
```

### 🧯 2. The "Emergency Cleanup" Workflow (If bad files were tracked)
*If you accidentally tracked unwanted files, or if you just updated your `.gitignore` on an **existing** project, you **must** run this sequence before pushing to remote:*

```bash
# 1. Clear Git's memory of all files (This does NOT delete files off your hard drive) or The magic command. It untracks every single file from Git's memory, but leaves the physical files on your computer untouched.
git rm -r --cached .

# 2. Re-stage everything. Git will now strictly obey the updated .gitignore
git add .

# 3. Verify the bad files are no longer staged
git status

# Unstages everything. Fix your .gitignore file to block the unwanted files.
git reset

# 4. Commit the newly cleaned state
git commit -m "chore: clean repo, remove secrets, cache, and unnecessary files"

# 5. Push the clean state to the remote
git push
```

# Inject the latest main code into your main branch
git merge main
```

### Step 3: Push and Open a PR
```bash
# Stage all your changed files
git add .

# Commit with a conventional message
git commit -m "feat: complete new feature"

# Push your specific branch up to the remote server
git push origin feat/your-feature-name
```
*Go to GitHub and open a Pull Request. Do not merge your own PR.*

## 6. 🚦 Do's and Don'ts for Contributors

### ✅ DO:
* **DO** run `git fetch --all` frequently to keep your local machine aware of remote changes.
* **DO** run `npm run lint` and `pytest` before opening a Pull Request.

### ❌ DON'T:
* **DON'T** panic when you see a `CONFLICT`. It just means Git needs a human decision.
* **DON'T** push `.env` files. Ever. 
* **DON'T** run `git rm -r --cached .` unless you are specifically trying to fix a repository that accidentally tracked forbidden files.

---

## 5. Daily Git Workflow & Branching & Commit Standards

To keep our history clean and readable, we use specific naming conventions.

### Branch Naming
Never work directly on `main`. Create a new branch for every task using the following prefixes:
* `feat/` for new features (e.g., `feat/add-ai-chat`)
* `fix/` for bug fixes (e.g., `fix/variance-calculation-error`)
* `docs/` for documentation updates (e.g., `docs/update-readme`)
* `chore/` for maintenance or config changes (e.g., `chore/update-dependencies`)

### Commit Messages
We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. 
* ✅ **Good:** `feat: add export to excel button on operator dashboard`
* ✅ **Good:** `fix: resolve crash when submitting empty form`
* ❌ **Bad:** `fixed stuff` or `WIP`

---

**Pull Request (PR) Workflow**

When your code is ready, follow these steps:

1. **Update `main`:** Pull the latest changes from `main` into your working branch to resolve any merge conflicts locally.
2. **Run Checks:** Ensure you run `npm run lint` on the frontend and `pytest` on the backend.
3. **Push to Remote:** Push your branch to GitHub.
4. **Open a PR:** Create a Pull Request against the `main` branch. 
5. **Code Review:** Tag a team member for review. Do not merge your own PR without an approval.

---

### Step 1: Create a Branch & Pull Latest (Syncing and Merging Branches )

When working on a team, the `main` branch will update while you are still working on your feature branch. You must keep your branch synced to avoid conflicts.

### Keeping Your Feature Branch Updated
Run these commands to pull the latest changes from `main` and merge them into your active working branch:

```bash
# Switch your working tree to the main branch
git checkout main

# Download and immediately merge the latest changes from the remote server's main branch
git pull origin main

# Create (-b) and switch to a new branch for your specific feature
Use the appropriate branch type based on your work:

```bash
# For new features
git checkout feat/your-branch-name
# Example: feat/add-ai-chat

# For bug fixes
git checkout fix/your-branch-name
# Example: fix/variance-calculation-error

# For documentation updates
git checkout docs/your-branch-name
# Example: docs/update-readme

# For maintenance or config changes
git checkout chore/your-branch-name
# Example: chore/update-dependencies

# 4. Merge the updated main into your feature branch
git merge main
```
*Note: If you get a merge conflict during step 4, VS Code will highlight the conflicting files. Accept the correct changes, save the files, and run `git commit` to finalize the merge.*

### Merging a Feature Branch into Main (Local Merge)
*We heavily prefer using GitHub Pull Requests for code review.* However, if you need to manually merge a finished feature branch into `main` locally, use this sequence:

```bash
# 1. Ensure your feature branch is fully committed
git status

# 2. Switch to the main branch
git checkout main

# 3. Pull the latest main to ensure you are up to date
git pull origin main

# 4. Merge your feature branch into main
git merge feat/your-branch-name

# 5. Push the updated main branch to GitHub
git push origin main
```
---

## 5. Troubleshooting Common Git Errors

### 🔴 Error 1: `pathspec did not match any file(s)`
**The Log:** `error: pathspec 'feat/fix/operator-show-cost-center' did not match any file(s) known to git`
* **Why it happened:** You combined multiple branch prefixes. Git looks for exact text matches.
* **How to fix:** Only use the exact branch name as it appears on GitHub. 
  ```bash
  # Correct way (no extra 'feat/' prefix):
  git checkout fix/operator-show-cost-center
  ```

### 🔴 Error 2: `not something we can merge`
**The Log:** `merge: fix/import-cc-as-cost-center - not something we can merge`
* **Why it happened:** The branch exists on GitHub, but your local computer hasn't downloaded the updated list of branches yet.
* **How to fix:** ```bash
  # Download the absolute latest branch metadata from the remote server
  git fetch --all
  
  # Tell Git specifically to merge the branch located on the remote server ('origin/')
  git merge origin/fix/import-cc-as-cost-center
  ```

### 🔴 Error 3: `Merge conflict in...`
**The Log:** `CONFLICT (content): Merge conflict in frontend/src/App.tsx`
* **Why it happened:** Git paused the merge because both your branch and the incoming branch modified the exact same lines of code.
* **How to fix:**
  1. Open the file in VS Code.
  2. Find the conflict markers (`<<<<<<< HEAD`).
  3. Click **"Accept Current Change"**, **"Accept Incoming Change"**, or **"Accept Both"**.
  4. Save the file and tell Git the conflict is resolved:
  ```bash
  # Stage the manually fixed file
  git add frontend/src/App.tsx
  
  # Complete the paused merge process
  git commit -m "Merge branch and resolve App.tsx conflict"
  ```

### 🔴 Error 4: `Merging is not possible because you have unmerged files`
**The Log:** `error: Merging is not possible because you have unmerged files.`
* **Why it happened:** You tried to run a new Git command while a previous merge conflict (like Error 3) was still paused and waiting for you to fix it.
* **How to fix:** Either resolve the conflict, or cancel the broken merge entirely to start over:
  ```bash
  # Cancels the paused merge and returns your files to how they were before you tried to merge
  git merge --abort
  ```

---

## 8. Production & Deployment Standards 🚀

When preparing the application for a production environment, different rules apply to ensure performance and security.

### Frontend Production Build
Do not use `npm run dev` in production. You must compile the React code into static files.
```bash
cd frontend

# Run strict TypeScript checks and build the optimized production bundle into the /dist folder
npm run build

# Preview the exact compiled production build locally to ensure no build-time bugs occurred
npm run preview
```
* **Environment Variables:** Production variables must be set in your hosting platform (e.g., Vercel) and must be prefixed with `VITE_` to be readable by the frontend.

### Backend Production Server
Do not use `--reload` in production. Use a production-grade ASGI server like Uvicorn running with Gunicorn to handle multiple concurrent workers.
```bash
# Run the application with 4 worker processes to handle high traffic
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

### Production Database Safety
* **Never use SQLite in Production:** Ensure your production `.env` points to a secure PostgreSQL instance.
* **Migration Safety:** Always back up the production database before running `alembic upgrade head`. Test migrations on a staging database first.

### Docker Production Profile
Our Docker compose file is built to separate development and production concerns.
```bash
# Run the full production stack detached (-d) in the background
docker compose --profile prod up -d --build
```

---

## 9. 🚦 Do's, Don'ts, and Developer Standards

### ✅ DO:
* **DO** run `git fetch --all` frequently to keep your local machine aware of remote changes.
* **DO** run `npm run lint` and `pytest` before opening a Pull Request.
* **DO** add new environment variables to `.env.example` with dummy values so teammates stay synced.
* **DO** note Git colors in PRs: 🟩 Green (Added), 🟥 Red (Deleted), 🟦 Blue (Context), 🟨 Yellow (Active).

### ❌ DON'T:
* **DON'T** panic when you see a `CONFLICT`. It just means Git needs a human decision.
* **DON'T** push `.env` files. Ever. 
* **DON'T** merge code locally if you can avoid it; rely on GitHub Pull Requests for code review.
***

## 8. Development Standards

* **Git Color Indicators (Reading Code Diffs):**
When reviewing code changes (in VS Code, GitHub PRs, or terminal diffs), these colors help you understand what happened to the code:
🟩 Green (Added code): These are entirely new lines of code that did not exist in the previous version.
🟥 Red (Deleted code): These lines have been removed. (If you modify a line, Git usually shows it as one red line deleted and one green line added).
🟦 Blue (Context): This is unchanged code surrounding your edits. It helps you see where in the file the change occurred without showing the whole file.
🟨 Yellow (Current line): In editors like VS Code, this simply highlights where your cursor is currently resting or the line you have selected.
* **Code Formatting:** Run `npm run lint` on the frontend before submitting any code.
* **Environment Variables:** If your feature requires a new environment variable, add it to `.env.example` with a dummy value so other developers know to update their local setups. 

---
