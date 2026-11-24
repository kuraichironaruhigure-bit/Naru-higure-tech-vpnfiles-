
/* NARU HIGURE FILE HUB — compatible with the supplied index.html and Supabase schema */
(() => {
  'use strict';

  const SUPABASE_URL = 'https://vmiihzuzdiheyrhmpcor.supabase.co';
  // This is the project's public publishable key already used by the supplied index.html.
  // Never put a Supabase service-role/secret key in browser code.
  const SUPABASE_KEY = 'sb_publishable_gwSGws_4eY2lbP4fsnHUqw_EoVMnTov';
  const FILE_BUCKET = 'vpn-files';
  const AVATAR_BUCKET = 'profile-avatars';
  const $ = (id) => document.getElementById(id);
  const requiredIds = ['file-list', 'upload-form', 'community-form', 'community-messages', 'profile-form', 'login-form'];
  if (requiredIds.some((id) => !$(id))) {
    console.error('NARU HUB: The page HTML does not match the expected File Hub layout.');
    return;
  }
  if (!window.supabase?.createClient) {
    $('file-list').textContent = 'Supabase did not load. Check your internet connection and refresh.';
    return;
  }

  const db = window.naruSupabase || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.naruSupabase = db;
  const viewedThisPage = new Set();
  let currentUser = null;
  let isAdmin = false;
  let selectedCountry = 'All countries';

  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const setText = (id, value) => { if ($(id)) $(id).textContent = value; };
  const status = (id, message) => setText(id, message);

  // Add country controls inside the existing panels; no page redesign is needed.
  function ensureCountryControls() {
    const filePanel = $('file-list').parentElement;
    if (!$('country-filter')) {
      const wrap = document.createElement('label');
      wrap.className = 'country-control';
      wrap.style.cssText = 'display:block;margin:0 0 12px;max-width:260px';
      wrap.innerHTML = 'Filter by country<select id="country-filter" class="outline" style="display:block;width:100%;margin-top:6px"><option>All countries</option><option>Zimbabwe</option><option>South Africa</option><option>Botswana</option><option>Zambia</option><option>Other</option></select>';
      filePanel.insertBefore(wrap, $('file-list'));
      $('country-filter').addEventListener('change', () => {
        selectedCountry = $('country-filter').value;
        loadApprovedFiles();
      });
    }
    if (!$('upload-country')) {
      const label = document.createElement('label');
      label.innerHTML = 'Country<select id="upload-country" required><option value="Zimbabwe">Zimbabwe</option><option value="South Africa">South Africa</option><option value="Botswana">Botswana</option><option value="Zambia">Zambia</option><option value="Other">Other</option></select>';
      $('upload-form').insertBefore(label, $('upload-form').querySelector('button[type="submit"]'));
    }
  }
  ensureCountryControls();

  async function recordAutomaticView(file, viewLabel) {
    if (!file?.id || viewedThisPage.has(file.id)) return;
    viewedThisPage.add(file.id);
    const { error } = await db.rpc('record_file_view', { file_id: file.id });
    if (error) {
      viewedThisPage.delete(file.id);
      console.warn('Automatic file view was not recorded:', error.message);
      return;
    }
    if (viewLabel) {
      const updatedCount = Number(file.view_count || 0) + 1;
      viewLabel.textContent = `${file.file_name || 'File'} · ${file.uploader || 'Community member'} · ${file.country || 'Zimbabwe'} · ${updatedCount} views`;
    }
  }

  async function loadApprovedFiles() {
    const box = $('file-list');
    box.innerHTML = '<p class="muted">Loading approved files…</p>';
    let query = db.from('vpn_submissions')
      .select('id,title,uploader,file_name,file_size,storage_path,country,view_count,download_count,created_at')
      .eq('status', 'approved').order('created_at', { ascending: false });
    if (selectedCountry !== 'All countries') query = query.eq('country', selectedCountry);
    let result = await query;
    // Graceful fallback for an older table that has not received the country column yet.
    if (result.error && /country/i.test(result.error.message)) {
      let fallback = db.from('vpn_submissions')
        .select('id,title,uploader,file_name,file_size,storage_path,view_count,download_count,created_at')
        .eq('status', 'approved').order('created_at', { ascending: false });
      result = await fallback;
      if (selectedCountry !== 'All countries') {
        box.innerHTML = '<p class="muted">Country filtering needs the country-column SQL update. Run the supplied country update in Supabase first.</p>';
        return;
      }
    }
    if (result.error) {
      box.textContent = 'Could not load files: ' + result.error.message;
      return;
    }
    const files = result.data || [];
    box.innerHTML = '';
    if (!files.length) {
      box.innerHTML = '<p class="muted">No approved files found for this country.</p>';
      return;
    }
    for (const file of files) {
      const row = document.createElement('div');
      row.className = 'file-row';
      const info = document.createElement('div');
      const title = document.createElement('b');
      title.textContent = file.title || file.file_name || 'VPN file';
      const detail = document.createElement('small');
      detail.textContent = `${file.file_name || 'File'} · ${file.uploader || 'Community member'} · ${file.country || 'Zimbabwe'} · ${Number(file.view_count || 0)} views`;
      info.append(title, detail);
      const actions = document.createElement('div');
      actions.className = 'file-actions';
      const download = document.createElement('button');
      download.type = 'button';
      download.className = 'outline';
      download.textContent = 'Download';
      download.addEventListener('click', () => downloadFile(file));
      // Deliberately no View button. A view is counted as soon as this card is rendered.
      actions.append(download);
      row.append(info, actions);
      box.append(row);
      void recordAutomaticView(file, detail);
    }
  }

  async function downloadFile(file) {
    if (!currentUser) {
      alert('Please sign in before downloading files.');
      if (location.hash !== '#signin') location.hash = '#signin';
      return;
    }
    const path = file.storage_path || file.file_path;
    if (!path) return alert('This file has no storage path. Please contact the administrator.');
    const { data, error } = await db.storage.from(FILE_BUCKET).createSignedUrl(path, 90);
    if (error) return alert('Download failed: ' + error.message);
    await db.rpc('record_file_download', { file_id: file.id });
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function loadCommunity() {
    const box = $('community-messages');
    if (!currentUser) {
      box.innerHTML = '<p class="muted">Please sign in to view and send community messages.</p>';
      status('community-status', 'Sign in to use the community.');
      return;
    }
    const { data, error } = await db.from('community_posts')
      .select('id,user_id,message,created_at')
      .order('created_at', { ascending: false }).limit(100);
    if (error) {
      box.textContent = 'Could not load community messages: ' + error.message;
      return;
    }
    box.innerHTML = '';
    if (!data?.length) {
      box.innerHTML = '<p class="muted">No community messages yet. Start the conversation.</p>';
      return;
    }
    for (const post of data) {
      const row = document.createElement('div');
      row.className = 'file-row';
      const content = document.createElement('div');
      const message = document.createElement('b');
      message.style.whiteSpace = 'pre-wrap';
      message.textContent = post.message;
      const when = document.createElement('small');
      when.textContent = new Date(post.created_at).toLocaleString();
      content.append(message, when);
      row.append(content);
      box.append(row);
    }
  }

  $('community-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentUser) return status('community-status', 'Please sign in first.');
    const input = $('community-message');
    const message = input.value.trim();
    if (!message) return;
    status('community-status', 'Sending…');
    const { error } = await db.from('community_posts').insert({ user_id: currentUser.id, message });
    if (error) return status('community-status', error.message);
    input.value = '';
    status('community-status', 'Message sent.');
    await loadCommunity();
  });

  async function loadProfile() {
    if (!currentUser) {
      status('profile-status', 'Sign in to edit your profile.');
      return;
    }
    const { data, error } = await db.from('profiles').select('display_name,about').eq('id', currentUser.id).maybeSingle();
    if (error) return status('profile-status', error.message);
    if (data) {
      $('profile-name').value = data.display_name || '';
      $('profile-about').value = data.about || '';
    }
  }

  $('profile-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentUser) return status('profile-status', 'Please sign in first.');
    status('profile-status', 'Saving profile…');
    let avatar_url;
    const avatar = $('profile-avatar').files?.[0];
    if (avatar) {
      if (!avatar.type.startsWith('image/')) return status('profile-status', 'Choose an image file.');
      const path = `${currentUser.id}/${crypto.randomUUID()}-${avatar.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const uploaded = await db.storage.from(AVATAR_BUCKET).upload(path, avatar, { upsert: true });
      if (uploaded.error) return status('profile-status', uploaded.error.message);
      const publicResult = db.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      avatar_url = publicResult.data.publicUrl;
    }
    const profile = {
      id: currentUser.id,
      display_name: $('profile-name').value.trim() || 'Community member',
      about: $('profile-about').value.trim(),
      updated_at: new Date().toISOString()
    };
    if (avatar_url) profile.avatar_url = avatar_url;
    const { error } = await db.from('profiles').upsert(profile, { onConflict: 'id' });
    status('profile-status', error ? error.message : 'Profile saved.');
  });

  // Uploads must be stored under the signed-in user's folder and include user_id,
  // because the supplied Supabase RLS policies enforce both conditions.
  $('upload-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentUser) return status('upload-status', 'Please sign in before submitting a file.');
    const file = $('file').files?.[0];
    if (!file) return status('upload-status', 'Choose a file first.');
    if (file.size > 50 * 1024 * 1024) return status('upload-status', 'Maximum file size is 50 MB.');
    const title = $('title').value.trim();
    if (!title) return status('upload-status', 'Enter a file title.');
    status('upload-status', 'Uploading…');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${currentUser.id}/${crypto.randomUUID()}-${safeName}`;
    const uploaded = await db.storage.from(FILE_BUCKET).upload(path, file, { upsert: false });
    if (uploaded.error) return status('upload-status', uploaded.error.message);
    const record = {
      title,
      uploader: $('uploader').value.trim() || 'Community member',
      file_name: file.name,
      file_size: file.size,
      storage_path: path,
      user_id: currentUser.id,
      status: 'pending',
      country: $('upload-country')?.value || 'Zimbabwe'
    };
    const saved = await db.from('vpn_submissions').insert(record);
    if (saved.error) {
      await db.storage.from(FILE_BUCKET).remove([path]);
      return status('upload-status', saved.error.message);
    }
    $('upload-form').reset();
    status('upload-status', 'File submitted. It will appear after administrator approval.');
  });

  async function loadPending() {
    if (!isAdmin) return;
    const box = $('pending-list');
    const { data, error } = await db.from('vpn_submissions').select('*')
      .eq('status', 'pending').order('created_at', { ascending: true });
    if (error) { box.textContent = error.message; return; }
    box.innerHTML = '<h3>Pending submissions</h3>';
    if (!data?.length) { box.innerHTML += '<p class="muted">Nothing waiting for review.</p>'; return; }
    for (const file of data) {
      const row = document.createElement('div'); row.className = 'file-row';
      const info = document.createElement('div');
      const name = document.createElement('b'); name.textContent = file.title || file.file_name;
      const detail = document.createElement('small'); detail.textContent = `${file.file_name} · ${file.country || 'Zimbabwe'} · ${file.uploader || 'Member'}`;
      info.append(name, detail);
      const actions = document.createElement('div'); actions.className = 'file-actions';
      for (const [label, nextStatus] of [['Approve', 'approved'], ['Reject', 'rejected']]) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'outline'; button.textContent = label;
        button.addEventListener('click', async () => {
          const { error: updateError } = await db.from('vpn_submissions').update({ status: nextStatus }).eq('id', file.id);
          if (updateError) alert(updateError.message);
          else { await loadPending(); await loadApprovedFiles(); }
        });
        actions.append(button);
      }
      row.append(info, actions); box.append(row);
    }
  }

  async function loadAdminFiles() {
    if (!isAdmin) return;
    const box = $('pending-list');
    const { data, error } = await db.from('vpn_submissions').select('*')
      .eq('status', 'approved').order('created_at', { ascending: false });
    if (error) return;
    const heading = document.createElement('h3'); heading.textContent = 'Approved files · Admin delete'; box.append(heading);
    for (const file of (data || [])) {
      const row = document.createElement('div'); row.className = 'file-row';
      const info = document.createElement('div');
      const name = document.createElement('b'); name.textContent = file.title || file.file_name;
      const small = document.createElement('small'); small.textContent = file.file_name || '';
      info.append(name, small);
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'outline'; remove.textContent = 'Delete';
      remove.addEventListener('click', async () => {
        if (!confirm(`Delete “${file.title || file.file_name}”? This cannot be undone.`)) return;
        const path = file.storage_path || file.file_path;
        if (path) {
          const storageDelete = await db.storage.from(FILE_BUCKET).remove([path]);
          if (storageDelete.error) return alert('Could not delete stored file: ' + storageDelete.error.message);
        }
        const { error: rowError } = await db.from('vpn_submissions').delete().eq('id', file.id);
        if (rowError) return alert('Could not delete file record: ' + rowError.message);
        await loadAdminPanel();
        await loadApprovedFiles();
      });
      row.append(info, remove); box.append(row);
    }
  }

  async function loadAdminPanel() {
    $('pending-list').innerHTML = '';
    await loadPending();
    await loadAdminFiles();
  }

  $('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    status('admin-status', 'Signing in…');
    const { error } = await db.auth.signInWithPassword({
      email: $('admin-email').value.trim(),
      password: $('admin-password').value
    });
    if (error) status('admin-status', error.message);
  });

  $('logout').addEventListener('click', async () => {
    const { error } = await db.auth.signOut();
    if (error) status('admin-status', error.message);
  });

  $('refresh').addEventListener('click', loadApprovedFiles);

  async function applySession(session) {
    currentUser = session?.user || null;
    isAdmin = currentUser?.app_metadata?.role === 'admin';
    const logout = $('logout');
    if (logout) logout.classList.toggle('hidden', !isAdmin);
    if ($('login-form')) $('login-form').classList.toggle('hidden', isAdmin);
    if (isAdmin) {
      status('admin-status', `Administrator signed in: ${currentUser.email || ''}`);
      await loadAdminPanel();
    } else {
      if ($('login-form')) $('login-form').classList.remove('hidden');
      if ($('pending-list')) $('pending-list').innerHTML = '';
      status('admin-status', currentUser ? 'Signed in as a member. Administrator access is restricted.' : '');
    }
    if (currentUser) {
      status('community-status', 'You are signed in.');
      await loadCommunity();
      await loadProfile();
    } else {
      await loadCommunity();
      status('profile-status', 'Sign in to edit your profile.');
    }
  }

  // The account sign-in/sign-up forms are already wired in index.html.
  // Listen for the shared Supabase session so Community/Profile update immediately.
  db.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => { void applySession(session); }, 0);
  });

  $('year').textContent = new Date().getFullYear();
  void loadApprovedFiles();
  db.auth.getSession().then(({ data, error }) => {
    if (error) console.error('Could not restore sign-in session:', error.message);
    void applySession(data?.session || null);
  });

  // Realtime refresh when community messages are added. The UI remains usable without Realtime.
  try {
    db.channel('naru-hub-community-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, () => {
        if (currentUser) void loadCommunity();
      }).subscribe();
  } catch (error) {
    console.warn('Community live refresh is unavailable:', error);
  }
})();
