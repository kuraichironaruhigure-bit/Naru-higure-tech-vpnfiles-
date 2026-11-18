NARU HIGURE FILE HUB — COMPLETE WEBSITE UPDATE

FILES
- index.html: website pages and black/red design
- app.js: Supabase sign-in, downloads, uploads, profiles, chat, stats, admin approval
- supabase-setup.sql: database tables, storage buckets, RLS policies, counters, owner admin role

GITHUB INSTALL
1. Open your repository: https://github.com/kuraichironaruhigure-bit/Naru-higure-tech-vpnfiles-
2. Replace the repository index.html with this index.html.
3. Replace the repository app.js with this app.js.
4. Keep manifest.json, service worker files, and icons already in your repository.
5. Commit the changes.

SUPABASE INSTALL
1. Open https://supabase.com/dashboard/project/vmiihzuzdiheyrhmpcor/sql/new
2. Paste the entire supabase-setup.sql and click Run.
3. If the admin account has not been created yet, sign up on the website using kuraichironaruhigure@gmail.com, then run the SQL script again so the account receives the admin role.
4. In Supabase Authentication > URL Configuration, add the GitHub Pages website URL to Site URL / Redirect URLs if email confirmation is enabled.
5. Keep the vpn-files bucket private. The SQL sets this automatically.

SECURITY / FEATURES
- Only signed-in users can download approved files; files are stored in a private bucket and downloaded with short-lived signed URLs.
- Only signed-in users can upload; submissions remain pending until administrator approval.
- Only the owner account with app_metadata.role=admin can approve/reject.
- Chat reads and writes require authentication (enforced by RLS).
- Users can edit their own profile and upload an avatar.
- Public file cards show per-file views/downloads and aggregate totals.
- Home opens with the welcome message and sign-in prompt; navigation opens individual pages.
- WhatsApp group/channel links are preserved.

IMPORTANT
The code is prepared from your latest saved source files but has not been deployed to GitHub or live-tested against your Supabase project. The Marketplace page is a placeholder because you have not specified listing/payment rules. Never put a Supabase service-role key in browser code.
