NARU HIGURE FILE HUB — REPAIR PACKAGE

Files:
- app.js: corrected JavaScript for the current File Hub layout.
- naru-higure-feature-update.sql: run once in Supabase SQL Editor.

Install:
1. Open your GitHub repository.
2. Replace the existing app.js with this package's app.js (same filename).
3. Commit the change. Keep your existing index.html and its black/red styling.
4. Open Supabase SQL Editor and run the complete SQL file once.
5. Refresh the website. If it is cached, open it in a private tab or clear the site cache.

Security:
- The browser uses only the project's public publishable key. Never add a service-role/secret key.
- Admin controls require Supabase app_metadata.role = admin.
- This package does not deploy itself or change GitHub/Supabase automatically.

Note: The HTML already needs to load Supabase JS before app.js. Keep the existing script tags in index.html.
