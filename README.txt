# NARU HIGURE VPN — website starter

A dark black/red mobile-friendly VPN configuration sharing website. Anyone can submit a file; submissions stay pending until the administrator approves them.

## Important
This is a deployable starter project, not a website already published on the internet. You must connect a Supabase project and deploy the files before people can use it.

## 1. Create the database and file storage
1. Create a project at https://supabase.com/ (use the free tier if available).
2. Open **SQL Editor** in your Supabase dashboard.
3. Copy all of `supabase-setup.sql` into a new query and run it.
4. In **Project Settings → API**, copy the Project URL and the `anon` / publishable public key.

## 2. Connect this website
1. Open `app.js`.
2. Replace `PASTE_YOUR_SUPABASE_PROJECT_URL` with your Project URL.
3. Replace `PASTE_YOUR_SUPABASE_ANON_KEY` with your public anon/publishable key.
4. Save the file.

Never put a `service_role` or secret key in website code.

## 3. Create your administrator account
1. In Supabase, open **Authentication → Users** and create a user with your own email and a strong password.
2. In SQL Editor, run this statement after replacing the email:

   `update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb where email = 'YOUR_ADMIN_EMAIL';`

3. Sign out and back in through the website's Admin button. Only this account receives the admin role.

## 4. Publish it
Upload `index.html`, `style.css`, and `app.js` to a static host such as GitHub Pages, Cloudflare Pages, or Netlify. Keep `supabase-setup.sql` private or remove it from the public website folder after setup. The hosting service publishes the website; Supabase handles uploads, review status, and private file storage.

## How the site works
- Visitors can upload `.json`, `.ovpn`, `.conf`, `.npv`, `.npvt`, and `.txt` files up to 20 MB.
- New submissions are pending and are not listed publicly.
- Admin signs in and approves or rejects submissions.
- Only approved files appear in the public library and can receive a short-lived download link.

## Safety and maintenance
- Only upload configuration files you own or have permission to share.
- Do not upload passwords, private keys, account credentials, or other people's private configurations.
- A file extension check is not a malware scan or a guarantee that a VPN configuration is safe or works. Review files before approval.
- Public anonymous uploads can attract spam. For a larger public service, add CAPTCHA/rate limiting and a moderation/abuse-report process.
- This starter does not test whether VPN servers work; it only stores and shares files.
