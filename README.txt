NARU HIGURE HUB X — WEBSITE UPDATE

Files in this package:
- index.html: redesigned mobile-friendly home page and slide-in navigation
- app.js: Supabase file uploads, approved file listing/downloads, account sign-in/sign-up, and admin review

HOW TO UPDATE YOUR GITHUB PAGES WEBSITE ON ANDROID
1. Download and extract this ZIP.
2. Open your repository:
   https://github.com/kuraichironaruhigure-bit/Naru-higure-tech-vpnfiles-
3. Replace the existing index.html with the new index.html.
4. Replace the existing app.js with the new app.js.
5. Commit the changes to the main branch.
6. Wait for GitHub Pages to publish, then open:
   https://kuraichironaruhigure-bit.github.io/Naru-higure-tech-vpnfiles-/

IMPORTANT
- Keep your existing manifest.json, sw.js, and icons folder in the repository.
- This app.js uses the existing Supabase project and the vpn_submissions table and vpn-files bucket.
- Supabase Auth must allow email/password sign-in and sign-up.
- The administrator must have app_metadata.role set to "admin" in Supabase Auth. Do not put a service-role key in website files.
- Upload size remains 10 MB, matching the existing Supabase bucket configuration.
- The four dashboard counts are display values from the design brief, not live database totals yet.
- Marketplace is currently a placeholder section; it is not a working shopping system yet.
