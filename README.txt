NARU HIGURE FILE HUB — COUNTRY FILTER + ADMIN DELETE + 24-HOUR CHAT UPDATE

This is a minimal update to the existing NARU HIGURE FILE HUB. It keeps the current page design, navigation, login, profiles, uploads, download flow, community, and WhatsApp links.

FILES IN THIS ZIP
- index.html — adds country selectors to VPN Files and file submission.
- app.js — filters approved files by country, saves the selected country, and lets the administrator delete files.
- supabase-setup.sql — adds the country column, administrator-only storage deletion permission, and automatic 24-hour chat cleanup.

INSTALL ON THE EXISTING GITHUB REPOSITORY
1. Download and extract this ZIP.
2. Open the existing repository: https://github.com/kuraichironaruhigure-bit/Naru-higure-tech-vpnfiles-
3. Replace only index.html and app.js in the repository root with the files from this ZIP.
4. Keep your existing manifest.json, service worker, icons, and all other repository files unchanged.
5. Commit the changes.

DATABASE UPDATE
1. Open the existing Supabase SQL Editor: https://supabase.com/dashboard/project/vmiihzuzdiheyrhmpcor/sql/new
2. Run the complete supabase-setup.sql file in one query. It is designed to be re-run and preserves existing file records.
3. The migration sets existing files to country “Other”. The administrator can assign a country to each existing approved file using the country selector shown on its file card. New submissions must choose a country.
4. The SQL enables pg_cron and schedules expired chat cleanup every minute. Messages older than 24 hours are excluded from chat immediately and permanently deleted by the scheduled database job, normally within about one minute after reaching 24 hours. If the Supabase project does not permit pg_cron, enable it in Supabase Database > Extensions and run the SQL again.

ADMINISTRATOR
- The existing administrator remains kuraichironaruhigure@gmail.com and must have app_metadata.role=admin.
- Only the administrator can see and use Delete buttons for approved and pending files.
- File deletion removes the object from the private vpn-files storage bucket and then deletes its database record.

LIVE WEBSITE
https://kuraichironaruhigure-bit.github.io/Naru-higure-tech-vpnfiles-/

This ZIP has been syntax-checked and its archive contents verified, but it has not been deployed or tested against the live Supabase project. No changes have been made to GitHub or Supabase from this package build.
