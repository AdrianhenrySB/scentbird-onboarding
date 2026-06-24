# Scentbird IT Onboarding Portal — Deployment Guide

## Overview

This portal is a single-page HTML app deployed on Vercel. IT fills out the intake form, which generates a unique manager link. The manager completes software/hardware/permissions selections, and when they submit, the existing Jira ticket is automatically updated with a formatted comment.

---

## Step 1 — Install Vercel CLI

```bash
npm install -g vercel
```

---

## Step 2 — Deploy to Vercel

From the `portal-app/` folder:

```bash
cd portal-app
vercel
```

Follow the prompts:
- **Set up and deploy?** → Yes
- **Which scope?** → Your personal account or the Scentbird team
- **Link to existing project?** → No (first time)
- **Project name?** → `scentbird-onboarding` (or whatever you like)
- **Root directory?** → `.` (current folder)
- **Override settings?** → No

Vercel will give you a URL like `https://scentbird-onboarding-xxxx.vercel.app`. Note this down.

---

## Step 3 — Copy the images

The portal needs app logos in `portal-app/public/images/`. Copy all files from your `Pictures/Claue Images/` folder into `portal-app/public/images/`, renaming any files with spaces to use underscores:

Key renames:
- `unnamed (1).png` → `unnamed_(1).png`
- `images (3).png` → `images_(3).png`
- `image (11).png` → `image_(11).png`

Then redeploy: `vercel --prod`

---

## Step 4 — Create a Jira Service Account (CRITICAL)

> **Why?** Your Atlassian account uses SSO/SAML login, which means API tokens from `id.atlassian.com` will not work for your personal account. You must create a dedicated service account that logs in with a regular email/password.

### 4a. Create the account

1. Go to [admin.atlassian.com](https://admin.atlassian.com)
2. Click **Users** → **Invite users**
3. Enter an email like `it-automation@scentbird.com` (or a Gmail you control for testing)
4. Give it the role: **Product access** → Jira → at minimum **Service Desk Agent** or **Member**
5. Accept the invite from that email inbox and set a password (no SSO — use the "Continue with email" option)

### 4b. Add the account to your Jira project

1. In Jira, go to **Project Settings** → **Access**
2. Add `it-automation@scentbird.com` with at minimum **Service Desk Agent** role (needs "Add comments" permission)

### 4c. Generate the API token

1. Log in to [id.atlassian.com](https://id.atlassian.com) **as the service account** (use incognito mode so you don't log out of your main account)
2. Go to **Security** → **API tokens** → **Create API token**
3. Label it `onboarding-portal`
4. Copy the token immediately — you won't see it again

---

## Step 5 — Set Environment Variables in Vercel

Go to your project in [vercel.com/dashboard](https://vercel.com/dashboard):

**Settings → Environment Variables** → Add each:

| Variable | Value | Example |
|---|---|---|
| `JIRA_DOMAIN` | Your Atlassian domain | `scentbird.atlassian.net` |
| `JIRA_EMAIL` | Service account email | `it-automation@scentbird.com` |
| `JIRA_API_TOKEN` | Token from Step 4c | `ATATT3xFfGF0...` |
| `SLACK_WEBHOOK_URL` | (Optional) Slack webhook | `https://hooks.slack.com/...` |
| `BASE_URL` | Your Vercel URL | `https://scentbird-onboarding.vercel.app` |

Set all to **All Environments** (Production, Preview, Development).

---

## Step 6 — (Optional) Slack Webhook

To get a Slack notification in `#it-onboarding` when a manager submits:

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. Name: `IT Onboarding Bot`, Workspace: Scentbird
4. **Incoming Webhooks** → Enable → **Add New Webhook to Workspace**
5. Select the `#it-onboarding` channel
6. Copy the webhook URL → paste as `SLACK_WEBHOOK_URL` in Vercel

---

## Step 7 — Redeploy with env vars

After setting all variables:

```bash
vercel --prod
```

---

## Step 8 — Test the full flow

1. Open your Vercel URL
2. In the admin bar, click **IT / HR Intake**
3. Enter a real Jira ticket number in the **ITN-** field (e.g. `ITN-1234`)
4. Fill in employee details and click **Preview & Send to Manager**
5. Click **→ Send to Manager** — you should see a real manager URL generated
6. Open the manager URL in a new tab (or incognito)
7. Complete all manager steps and click **✅ Submit to IT**
8. Check `ITN-1234` in Jira — you should see a new comment with all the provisioning details

---

## Troubleshooting

### "Failed to update Jira ticket" (502 error)
- Double-check `JIRA_DOMAIN`, `JIRA_EMAIL`, `JIRA_API_TOKEN` in Vercel env vars
- Make sure the service account has **comment** permission on the project
- Verify the token was generated from the service account (not your personal SSO account)
- Test the token directly: open Terminal and run:
  ```bash
  curl -u "it-automation@scentbird.com:YOUR_TOKEN" \
    "https://scentbird.atlassian.net/rest/api/2/myself"
  ```
  If it returns your account info, the token is valid.

### "Invalid or expired token" on manager URL
- The token is base64url-encoded IT form data — it doesn't expire
- Make sure the URL wasn't broken (some email clients wrap long links)

### Images not showing on Vercel
- Confirm all image files are in `portal-app/public/images/`
- Filenames with spaces must use underscores (see Step 3)
- Redeploy after adding images: `vercel --prod`

### Local testing
```bash
vercel dev
```
This runs the app locally at `http://localhost:3000` with the API functions active. Create a `.env.local` file (copy `.env.example` and fill in your values) for local testing.
