NARU HIGURE HUB X — CHECKED WEBSITE PACKAGE

FILES
- index.html: website page. It loads ./app.js.
- app.js: Supabase account, approved-file listing, upload and administrator review logic.

UPLOAD TO GITHUB PAGES
1. Open your repository:
   https://github.com/kuraichironaruhigure-bit/Naru-higure-tech-vpnfiles-
2. In the repository root, replace the existing index.html with this index.html.
3. In the repository root, replace the existing app.js with this app.js.
4. Keep your existing manifest.json, service worker, icons and other site assets.
5. Commit the changes to the main branch and wait for GitHub Pages to publish.
6. Open:
   https://kuraichironaruhigure-bit.github.io/Naru-higure-tech-vpnfiles-/

IMPORTANT SUPABASE SETUP — REQUIRED FOR REAL DOWNLOAD PROTECTION
The page checks for a signed-in Supabase session before it creates a short-lived download link. The bucket must also be PRIVATE; otherwise users may bypass the page and access public object URLs directly.

A. In Supabase Dashboard → Storage → Buckets → vpn-files → Edit bucket, turn OFF Public bucket.

B. In Supabase SQL Editor, create a read policy that allows authenticated users to read only objects whose matching submission has been approved:

CREATE POLICY "Authenticated users read approved VPN files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'vpn-files'
  AND EXISTS (
    SELECT 1
    FROM public.vpn_submissions AS s
    WHERE s.file_path = storage.objects.name
      AND s.status = 'approved'
  )
);

C. IMPORTANT: Storage policies are combined permissively. Remove/disable any existing SELECT policy on storage.objects that grants public/anon access to the vpn-files bucket, or that lets every authenticated user read every object. Otherwise pending/rejected files may still be accessible. Do not delete policies blindly; inspect their names and conditions first.

D. Keep the INSERT policy needed for submissions/uploads. The website expects the Supabase table public.vpn_submissions and bucket vpn-files, with columns including title, uploader, file_name, file_path, status and created_at.

E. Keep administrator review protected by Supabase Row Level Security. The page checks app_metadata.role === "admin" for the admin interface, but database UPDATE permissions must independently restrict status changes to the actual administrator. Do not rely on a browser-side check alone.

ACCOUNT SIGN-IN
- Supabase Authentication must have Email provider enabled.
- If email confirmation is enabled, new users must confirm their email before they can sign in.
- The public publishable key in app.js is intended for browser use. Never put a Supabase service-role key in HTML or JavaScript.

TEST
1. Open the website in a private/incognito browser window.
2. Tap Download while signed out: it should prompt for Sign in/Create account.
3. Create an account or sign in, then tap Download for an approved file.
4. A pending or rejected file must not be downloadable.
5. Test administrator approval using the administrator account.

NOTES
- The four dashboard counts are design placeholders, not live totals.
- Marketplace is currently a placeholder.
- Upload limit in app.js is 10 MB; ensure the Supabase bucket limit is at least 10 MB.
- This package updates files only. It does not deploy to GitHub or change Supabase settings automatically.
