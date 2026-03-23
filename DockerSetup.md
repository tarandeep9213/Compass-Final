# CashRoom Compliance System - Docker Setup Guide

This document outlines the complete steps to run the CashRoom Compliance System (Frontend, Backend, and Mailcatcher) entirely within Docker.

## Prerequisites
Ensure Docker and Docker Compose (or Docker Desktop) are installed and running on your system.


## Step 4: The `docker-compose.yml` Configuration

Start Docker Application and then Run All Services from `docker-compose.yml` in the root directory.

**Key adjustments made:**

1.  Frontend is mapped to port `3000` (`3000:80`).
2.  Backend `SMTP_HOST` points to `mailcatcher`.
3.  Mailcatcher service is added with a custom `entrypoint` to override the default backend startup script.

## Step 5: Build and Run

Whenever you make code changes or want to start the system, open your terminal (PowerShell/CMD/Bash) in the root directory and run the following command to clean up old instances and build fresh containers:

**For Windows (PowerShell):**

```powershell
docker-compose down --remove-orphans ; docker-compose up -d --build
```

**For Mac/Linux/Git Bash:**

```bash
docker-compose down --remove-orphans && docker-compose up -d --build
```

## Step 6: Access the Application

Once the containers are running and healthy, you can access the system at the following URLs:

  * 🖥️ **Frontend App:** [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000)
  * ⚙️ **Backend API (Swagger):** [http://localhost:8000/docs](https://www.google.com/search?q=http://localhost:8000/docs)
  * 📧 **Mailcatcher (JSON feed):** [http://localhost:1080/emails](https://www.google.com/search?q=http://localhost:1080/emails)

### Viewing Emails in the Terminal

For a much cleaner, formatted view of intercepted emails, open a new terminal window and tail the logs of the mailcatcher container:

```bash
docker logs -f cashroom-mailcatcher
```
```