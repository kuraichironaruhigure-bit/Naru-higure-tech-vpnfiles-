NARU HIGURE FILE HUB — UPDATE FILES

FILES
- index.html: replace the existing index.html in your CURRENT GitHub repository.
- app.js: upload beside index.html in the same repository folder.
- supabase-setup.sql: run in Supabase Dashboard > SQL Editor > New query.

SUPABASE
The browser-safe publishable key and project URL are already configured in app.js.
Do not add a service_role/secret key to website files.
Run the SQL script. Then in Supabase Dashboard > Authentication > Users, select your own account and set app_metadata.role to admin. Do not set this in user-editable user_metadata.

FEATURES
- Approved VPN file library
- Public view counter and signed-in download counter
- Sign-in required before downloads and submissions
- Profile display name, about and avatar
- Community chat
- Admin-only approve/reject workflow
- Existing WhatsApp group and channel links retained

IMPORTANT NOTES
- Download count records a download request/start, not a confirmed installation on someone's phone.
- Admin approval depends on app_metadata.role = admin being set securely on your own Supabase user.
- This package uses the Supabase project already configured in the recovered website.
- If you have an older app.js, replace it with this matching app.js.
