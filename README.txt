NARU HIGURE VPN — WEBSITE STARTER

Included files:
- index.html: website page
- style.css: black/red mobile-friendly design
- app.js: upload of any file type (10 MB limit), approved-file list, admin sign-in and review interface
- supabase-setup.sql: database/storage setup
- README.txt: these instructions

IMPORTANT
This is a starter project, not a hosted website. GitHub Pages hosts the page, but Supabase must be configured for submissions and moderation to work.

1) CREATE SUPABASE PROJECT
Create a project at https://supabase.com/ and open its SQL Editor.
Copy all of supabase-setup.sql into a new query and run it.

2) CONNECT THE WEBSITE
In Supabase open Project Settings → API. Copy the Project URL and anon/publishable public key.
Open app.js in GitHub and replace:
PASTE_YOUR_SUPABASE_PROJECT_URL
PASTE_YOUR_SUPABASE_ANON_KEY
Commit the change.
Never use a service_role or secret key in this public website.

3) CREATE AN ADMIN
Create an admin user in Supabase Authentication → Users.
Then run this SQL, replacing the email with the admin email:
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'YOUR_ADMIN_EMAIL';
Sign in on the website using that account.

4) PUBLISH WITH GITHUB PAGES
In the repository open Settings → Pages.
Choose Deploy from a branch, select main and /(root), then Save.
Wait for GitHub Pages to publish and use the Visit site link.

SECURITY / RESPONSIBLE SHARING
The upload form accepts any file type up to 10 MB, including HA Tunnel, HTTP Custom, V2Box, NPVS, NPV, NPVT, OVPN, JSON and other formats. Acceptance does not guarantee every VPN app can open every file; formats are app-specific. Files remain pending until admin approval. Only share files you own or have permission to share. Never upload passwords, private keys, tokens or personal data. Review downloads carefully because arbitrary files can be unsafe. Public upload forms can attract spam; add rate limiting and stronger server-side moderation before opening to a large audience.
