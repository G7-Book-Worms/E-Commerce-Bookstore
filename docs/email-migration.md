# Moving bookwrms.store email from Namecheap Private Email to Migadu

Why: Migadu gives every staff member a real `name@bookwrms.store` mailbox. The staff portal creates and deletes those mailboxes on its own (`server/src/modules/staff/staff-mailbox.ts`). The support inbox in the portal keeps working the same way, over IMAP. Plan: **Mini, $90/year**. It allows 100 outgoing emails a day; the $19 Micro plan allows only 20, which order emails plus sign-in codes would use up.

Do this **after** a demo, not the week of one. Mail can bounce or go missing for a few hours while DNS changes spread.

## 1. Set up Migadu (nothing changes for the live site yet)
1. Sign up for Mini and add the domain `bookwrms.store` in the admin panel at admin.migadu.com.
2. Add the **verification TXT** record it shows at Namecheap (Advanced DNS). Leave the MX records alone for now.
3. Create the two shared mailboxes with passwords you choose:
   - `support@`: the portal reads it and staff replies are sent from it
   - `no-reply@`: order, account and sign-in emails are sent from it
4. Create an **API key**: My Account → API Keys.

## 2. Switch the DNS at Namecheap (Advanced DNS)
Copy the exact values from Migadu's DNS overview for the domain. The records below are the usual ones; Migadu's panel is the source of truth.
- **MX**:
  - Remove the two `privateemail.com` records.
  - Add `aspmx1.migadu.com` (priority 10) and `aspmx2.migadu.com` (priority 20).
- **SPF**: replace the TXT on `@` with `v=spf1 include:spf.migadu.com -all`.
- **DKIM**:
  - Add the three CNAMEs Migadu lists (`key1._domainkey`, `key2._domainkey`, `key3._domainkey`).
  - Remove the old `privateemail._domainkey` record.
- **DMARC** (still missing today): TXT on `_dmarc`: `v=DMARC1; p=none; rua=mailto:support@bookwrms.store`.
- Don't touch the Vercel records (`@` A record, `www` CNAME).

Check with Migadu's **DNS diagnostics** button until everything is green.

## 3. Point the site at Migadu (Vercel → Settings → Environment Variables, and the Mac `.env`)
Check the server names in Migadu's "Email clients" help page before saving.

| Variable | New value |
|---|---|
| `SMTP_HOST` | `smtp.migadu.com` |
| `SMTP_PORT` | `465` |
| `IMAP_HOST` | `imap.migadu.com` (the code defaults to Private Email, so set it) |
| `IMAP_PORT` | `993` |
| `NOREPLY_EMAIL` / `NOREPLY_EMAIL_PASSWORD` | the Migadu `no-reply@` mailbox |
| `SUPPORT_EMAIL` / `SUPPORT_EMAIL_PASSWORD` | the Migadu `support@` mailbox |
| `MIGADU_API_USER` | the Migadu account email that owns the API key |
| `MIGADU_API_KEY` | the API key from step 1 |
| `MAIL_DOMAIN` | `bookwrms.store` (optional, this is the default) |

Redeploy. Then test:
- a password-reset email arrives
- a contact-form message shows up in the portal inbox
- a staff reply arrives
- a sign-in code arrives

## 4. Bring the old mail across, then cancel
- Copy the old support@ mail over with Migadu's mailbox import (it reads the old mailbox over IMAP from `mail.privateemail.com`).
- Keep Private Email for a week in case anything was missed, then cancel it.

## Staff mailboxes after the switch
- **Staff → Create account:** shows "Give them a @bookwrms.store mailbox". The mailbox address becomes their staff sign-in email, and Migadu emails the invitation to their personal address, where they choose the mailbox password. The site never sees that password.
- **Deleting a staff account:** deletes the mailbox and everything in it. If Migadu can't be reached, the page and the activity log name the mailbox to remove by hand.
- **Reserved names:** `support`, `no-reply`, `admin`, `postmaster` and the other shared names can't be taken.
