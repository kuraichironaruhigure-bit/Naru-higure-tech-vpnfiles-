
// Naru Higure Hub X — Supabase file sharing and administrator review.
// Uses the public publishable key only. Never place a service-role key in a website.

const SUPABASE_URL = "https://vmiihzuzdiheyrhmpcor.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_gwSGws_4eY2lbP4fsnHUqw_EoVMnTov";
const BUCKET = "vpn-files";

const configured =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_ANON_KEY.includes("PASTE_");

const db =
  configured && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

window.naruSupabase = db;

const $ = id => document.getElementById(id);

// Prevent duplicate view counts during the same page visit.
const recordedFileViews = new Set();

async function recordAutomaticFileView(fileId) {
  if (!db || !fileId || recordedFileViews.has(fileId)) return;

  recordedFileViews.add(fileId);

  const { error } = await db.rpc("record_file_view", {
    file_id: fileId
  });

  if (error) {
    recordedFileViews.delete(fileId);
    console.warn("Could not record automatic file view:", error.message);
  }
}

$("year").textContent = new Date().getFullYear();

function configMessage() {
  return "Supabase could not be reached. Check your internet connection and project settings.";
}

// LOAD APPROVED FILES
async function loadApproved() {
  const box = $("file-list");

  if (!db) {
    box.innerHTML = `<p class="muted">${configMessage()}</p>`;
    return;
  }

  const { data, error } = await db
    .from("vpn_submissions")
    .select("id,title,uploader,file_name,storage_path,created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    box.textContent = "Could not load files: " + error.message;
    return;
  }

  box.innerHTML = "";

  if (!data.length) {
    box.innerHTML = '<p class="muted">No approved files yet.</p>';
    return;
  }

  for (const item of data) {
    const row = document.createElement("div");
    row.className = "file-row";

    const info = document.createElement("div");
    info.innerHTML = "<b></b><small></small>";

    info.querySelector("b").textContent = item.title;

    info.querySelector("small").textContent =
      `${item.file_name} • ${item.uploader || "Community member"}`;

    // DOWNLOAD BUTTON ONLY — NO VIEW BUTTON.
    const btn = document.createElement("button");
    btn.className = "outline";
    btn.textContent = "Download";

    btn.onclick = async () => {
      const { data, error } = await db.storage
        .from(BUCKET)
        .createSignedUrl(item.storage_path, 60);

      if (error) {
        alert(error.message);
        return;
      }

      window.open(data.signedUrl, "_blank", "noopener");
    };

    row.append(info, btn);
    box.append(row);

    // AUTOMATIC VIEW COUNT:
    // A view is recorded when the approved file is displayed.
    // No button or visitor click is required.
    void recordAutomaticFileView(item.id);
  }
}

// FILE UPLOAD
$("upload-form").addEventListener("submit", async e => {
  e.preventDefault();

  const status = $("upload-status");

  if (!db) {
    status.textContent = configMessage();
    return;
  }

  const file = $("file").files[0];

  if (!file) {
    status.textContent = "Please choose a file.";
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    status.textContent = "Please choose a file smaller than 10 MB.";
    return;
  }

  status.textContent = "Uploading for review…";

  const path =
    `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const up = await db.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false });

  if (up.error) {
    status.textContent = up.error.message;
    return;
  }

  const { error } = await db
    .from("vpn_submissions")
    .insert({
      title: $("title").value.trim(),
      uploader: $("uploader").value.trim(),
      file_name: file.name,
      storage_path: path,
      status: "pending"
    });

  if (error) {
    await db.storage.from(BUCKET).remove([path]);
    status.textContent = error.message;
    return;
  }

  status.textContent =
    "Submitted. It will appear after administrator approval.";

  e.target.reset();
});

// REFRESH FILES
$("refresh").onclick = loadApproved;

// ADMIN LOGIN
$("login-form").addEventListener("submit", async e => {
  e.preventDefault();

  const status = $("admin-status");

  if (!db) {
    status.textContent = configMessage();
    return;
  }

  const { data, error } = await db.auth.signInWithPassword({
    email: $("admin-email").value,
    password: $("admin-password").value
  });

  if (error) {
    status.textContent = error.message;
    return;
  }

  if (data.user?.app_metadata?.role !== "admin") {
    await db.auth.signOut();
    status.textContent = "This account is not an administrator.";
    return;
  }

  status.textContent = "Administrator signed in.";

  $("logout").classList.remove("hidden");

  await loadPending();
});

// ADMIN LOGOUT
$("logout").onclick = async () => {
  await db?.auth.signOut();

  $("logout").classList.add("hidden");
  $("pending-list").innerHTML = "";
  $("admin-status").textContent = "Signed out.";
};

// LOAD PENDING SUBMISSIONS
async function loadPending() {
  const box = $("pending-list");

  const { data, error } = await db
    .from("vpn_submissions")
    .select("*")
    .eq("status", "pending")
    .order("created_at");

  if (error) {
    box.textContent = error.message;
    return;
  }

  box.innerHTML = "<h3>Pending submissions</h3>";

  if (!data.length) {
    box.innerHTML +=
      "<p class='muted'>Nothing waiting for review.</p>";
    return;
  }

  for (const item of data) {
    const row = document.createElement("div");
    row.className = "file-row";

    const info = document.createElement("div");
    info.innerHTML = "<b></b><small></small>";

    info.querySelector("b").textContent = item.title;

    info.querySelector("small").textContent =
      `${item.file_name} • ${item.uploader || "No name"}`;

    const actions = document.createElement("div");
    actions.className = "file-actions";

    for (const [label, status] of [
      ["Approve", "approved"],
      ["Reject", "rejected"]
    ]) {
      const b = document.createElement("button");

      b.className = "outline";
      b.textContent = label;

      b.onclick = async () => {
        const { error } = await db
          .from("vpn_submissions")
          .update({ status })
          .eq("id", item.id);

        if (error) {
          alert(error.message);
        } else {
          await loadPending();
          await loadApproved();
        }
      };

      actions.append(b);
    }

    row.append(info, actions);
    box.append(row);
  }
}

// INITIAL FILE LOAD
loadApproved();

    if (!visible.length) { host.innerHTML = `<p class="muted">${filesCache.length ? "No approved files for this country yet." : "No approved files yet."}</p>`; return; }
    host.innerHTML = visible.map(f => `
      <article class="file-row" data-file-id="${esc(f.id)}"><div class="file-info"><b>${esc(f.title)}</b>
      <p class="muted">${esc(f.country || "Country not set")} · ${esc(f.file_name || "File")} · ${esc(f.uploader || "Community member")}</p>
      <p class="muted" data-stats>Views: ${Number(f.view_count)||0} · Downloads: ${Number(f.download_count)||0}</p></div>
      <div class="file-actions"><button class="outline" type="button" data-view="${esc(f.id)}">View</button>
      <button class="primary" type="button" data-download="${esc(f.id)}">Download</button>
      ${adminMode ? `<select aria-label="Set country for ${esc(f.title)}" data-set-country="${esc(f.id)}" style="max-width:150px;padding:8px;border-radius:8px;background:#101015;color:var(--text);border:1px solid #34313a"><option value="Other" ${(!f.country || f.country === "Other") ? "selected" : ""}>Other / Not assigned</option>${COUNTRIES.map(c => `<option value="${esc(c)}" ${f.country === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select><button class="outline" type="button" data-delete-file="${esc(f.id)}">Delete</button>` : ""}</div></article>`).join("");
    host.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", async () => {
      const id = button.dataset.view; const { error: viewError } = await sb.rpc("record_file_view", { file_id: id });
      if (viewError) { alert("Could not record this view: " + viewError.message); return; }
      const file = filesCache.find(item => item.id === id); if (file) file.view_count = Number(file.view_count || 0) + 1;
      const stats = button.closest(".file-row")?.querySelector("[data-stats]");
      if (stats && file) stats.textContent = `Views: ${file.view_count} · Downloads: ${Number(file.download_count)||0}`;
      await loadTotals();
    }));
    host.querySelectorAll("[data-download]").forEach(button => button.addEventListener("click", () => downloadFile(button.dataset.download)));
    host.querySelectorAll("[data-delete-file]").forEach(button => button.addEventListener("click", () => deleteFile(button.dataset.deleteFile)));
    host.querySelectorAll("[data-set-country]").forEach(select => select.addEventListener("change", () => updateFileCountry(select.dataset.setCountry, select.value)));
  }

  async function updateFileCountry(id, country) {
    if (!adminMode) return;
    const { error } = await sb.from("vpn_submissions").update({ country }).eq("id", id);
    if (error) { say("admin-status", "Could not update country: " + error.message); return; }
    const file = filesCache.find(item => item.id === id); if (file) file.country = country;
    say("admin-status", "File country updated."); renderFiles();
  }

  async function deleteFile(id) {
    if (!adminMode) return;
    const { data: record, error: readError } = await sb.from("vpn_submissions").select("title,storage_path").eq("id", id).maybeSingle();
    if (readError || !record) { say("admin-status", readError?.message || "File not found."); return; }
    if (!confirm(`Delete "${record.title}" permanently?`)) return;
    if (record.storage_path) {
      const { error: storageError } = await sb.storage.from(FILE_BUCKET).remove([record.storage_path]);
      if (storageError) { say("admin-status", "File storage deletion failed: " + storageError.message); return; }
    }
    const { error } = await sb.from("vpn_submissions").delete().eq("id", id);
    say("admin-status", error ? error.message : "File deleted.");
    if (!error) { await loadFiles(); await loadPending(); }
  }

  async function refreshUser() {
    const { data, error } = await sb.auth.getUser();
    if (error) console.warn("Session check:", error.message);
    currentUser = data?.user || null;
    adminMode = !!currentUser && currentUser.email?.toLowerCase() === ADMIN_EMAIL && currentUser.app_metadata?.role === "admin";
    applyAccess();
    return currentUser;
  }

  function openSignin() { $("openSignin")?.click(); }

  function applyAccess() {
    const signedIn = !!currentUser;
    ["upload-gate"].forEach(id => $(id)?.classList.toggle("hidden", signedIn));
    $("upload-form")?.classList.toggle("hidden", !signedIn);
    $("community-gate")?.classList.toggle("hidden", signedIn);
    $("community-messages")?.classList.toggle("hidden", !signedIn);
    $("community-form")?.classList.toggle("hidden", !signedIn);
    $("profile-gate")?.classList.toggle("hidden", signedIn);
    $("profile-form")?.classList.toggle("hidden", !signedIn);
    $("profile-preview-wrap")?.classList.toggle("hidden", !signedIn);
    $("user-logout")?.classList.toggle("hidden", !signedIn);
    $("admin")?.classList.toggle("hidden", !adminMode);
    $("admin-gate")?.classList.toggle("hidden", adminMode);
    $("admin-menu-link")?.classList.toggle("hidden", !adminMode);
    if (!signedIn) {
      if ($("community-messages")) $("community-messages").innerHTML = '<p class="muted">Sign in to view community messages.</p>';
      if ($("profile-preview")) $("profile-preview").classList.add("hidden");
      say("profile-preview-name", "Sign in to see your profile.");
      if ($("pending-list")) $("pending-list").innerHTML = "";
    }
  }

  async function loadTotals() {
    const { data, error } = await sb.from("vpn_submissions").select("view_count,download_count").eq("status", "approved");
    if (error) return;
    const views = (data || []).reduce((n, f) => n + Number(f.view_count || 0), 0);
    const downloads = (data || []).reduce((n, f) => n + Number(f.download_count || 0), 0);
    say("total-views", views.toLocaleString());
    say("total-downloads", downloads.toLocaleString());
  }

  async function loadFiles() {
    const host = $("file-list"); if (!host) return;
    host.innerHTML = '<p class="muted">Loading approved files…</p>';
    const { data, error } = await sb.from("vpn_submissions")
      .select("id,title,uploader,file_name,file_size,view_count,download_count,created_at,country")
      .eq("status", "approved").order("created_at", { ascending: false });
    if (error) { host.innerHTML = `<p class="muted">Could not load files: ${esc(error.message)}</p>`; return; }
    filesCache = data || []; renderFiles(); await loadTotals();
  }

  async function downloadFile(id) {
    const user = await refreshUser();
    if (!user) { say("accountStatus", "Please sign in or create an account before downloading."); openSignin(); return; }
    const { data: file, error } = await sb.from("vpn_submissions")
      .select("storage_path,file_name").eq("id", id).eq("status", "approved").single();
    if (error || !file?.storage_path) { alert("This approved file is unavailable: " + (error?.message || "Missing storage path.")); return; }
    const { data: signed, error: signError } = await sb.storage.from(FILE_BUCKET).createSignedUrl(file.storage_path, 90);
    if (signError || !signed?.signedUrl) { alert("Could not prepare download: " + (signError?.message || "Unknown error")); return; }
    const { error: countError } = await sb.rpc("record_file_download", { file_id: id });
    if (countError) { alert("Download blocked: " + countError.message); return; }
    const link = document.createElement("a"); link.href = signed.signedUrl; link.download = file.file_name || "download"; link.rel = "noopener";
    document.body.appendChild(link); link.click(); link.remove();
    await loadFiles();
  }

  async function submitFile(event) {
    event.preventDefault();
    const user = await refreshUser();
    if (!user) { say("upload-status", "Please sign in before submitting a file."); openSignin(); return; }
    const file = $("file")?.files?.[0], title = $("title")?.value.trim(), country = $("file-country")?.value;
    if (!file || !title || !country) { say("upload-status", "Choose a country before submitting the file."); return; }
    if (file.size > 50 * 1024 * 1024) { say("upload-status", "Maximum file size is 50 MB."); return; }
    say("upload-status", "Uploading your submission…");
    const safeName = file.name.replace(/[^\w.\-() ]/g, "_");
    const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await sb.storage.from(FILE_BUCKET).upload(path, file, { upsert: false });
    if (uploadError) { say("upload-status", uploadError.message); return; }
    const { error } = await sb.from("vpn_submissions").insert({ title, uploader: $("uploader")?.value.trim() || null, file_name: file.name, file_size: file.size, storage_path: path, user_id: user.id, status: "pending", country });
    if (error) { await sb.storage.from(FILE_BUCKET).remove([path]); say("upload-status", error.message); return; }
    $("upload-form").reset(); say("upload-status", "Submitted. Your file will appear after administrator approval.");
    if (adminMode) await loadPending();
  }

  async function loadProfile() {
    if (!currentUser) return;
    const { data, error } = await sb.from("profiles").select("display_name,about,avatar_url").eq("id", currentUser.id).maybeSingle();
    if (error) { say("profile-status", error.message); return; }
    if (data) {
      $("profile-name").value = data.display_name || "";
      $("profile-about").value = data.about || "";
      if (data.avatar_url) { $("profile-preview").src = data.avatar_url; $("profile-preview").classList.remove("hidden"); say("profile-preview-name", data.display_name || "Your profile picture"); }
      else { $("profile-preview").classList.add("hidden"); say("profile-preview-name", "No profile picture uploaded yet."); }
      say("profile-status", "Profile loaded.");
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    const user = await refreshUser();
    if (!user) { say("profile-status", "Please sign in first."); openSignin(); return; }
    let avatarUrl;
    const avatar = $("profile-avatar")?.files?.[0];
    if (avatar) {
      if (!avatar.type.startsWith("image/") || avatar.size > 5 * 1024 * 1024) { say("profile-status", "Choose an image under 5 MB."); return; }
      const ext = (avatar.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await sb.storage.from(AVATAR_BUCKET).upload(path, avatar, { upsert: false });
      if (uploadError) { say("profile-status", uploadError.message); return; }
      avatarUrl = sb.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
    }
    const row = { id: user.id, display_name: $("profile-name").value.trim() || "Community member", about: $("profile-about").value.trim(), updated_at: new Date().toISOString() };
    if (avatarUrl) row.avatar_url = avatarUrl;
    const { error } = await sb.from("profiles").upsert(row, { onConflict: "id" });
    if (error) { say("profile-status", error.message); return; }
    say("profile-status", "Profile and picture saved successfully.");
    await loadProfile();
  }

  function startChatRealtime() {
    if (!currentUser || chatChannel) return;
    chatChannel = sb.channel("naru-higure-community")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_posts" }, () => { if (currentUser) loadChat(); })
      .subscribe();
  }
  function stopChatRealtime() {
    if (chatChannel) { sb.removeChannel(chatChannel); chatChannel = null; }
  }

  async function loadChat() {
    const host = $("community-messages");
    if (!host || !currentUser) return;
    host.innerHTML = '<p class="muted">Loading community chat…</p>';
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await sb.from("community_posts").select("id,user_id,message,created_at").gte("created_at", cutoff).order("created_at", { ascending: true }).limit(100);
    if (error) { host.innerHTML = `<p class="muted">Could not load chat: ${esc(error.message)}</p>`; return; }
    if (!data?.length) { host.innerHTML = '<p class="muted">No messages yet. Start the conversation.</p>'; return; }
    const ids = [...new Set(data.map(row => row.user_id))];
    const { data: profiles } = await sb.from("profiles").select("id,display_name,avatar_url").in("id", ids);
    const profileMap = new Map((profiles || []).map(profile => [profile.id, profile]));
    host.innerHTML = data.map(message => {
      const profile = profileMap.get(message.user_id);
      const avatar = profile?.avatar_url ? `<img src="${esc(profile.avatar_url)}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0">` : '<span style="width:36px;height:36px;border-radius:50%;background:#29232b;display:inline-block;flex-shrink:0"></span>';
      return `<article class="file-row">${avatar}<div class="file-info"><b>${esc(profile?.display_name || "Community member")}</b><p>${esc(message.message)}</p><small class="muted">${new Date(message.created_at).toLocaleString()}</small></div></article>`;
    }).join("");
    host.scrollTop = host.scrollHeight;
  }

  async function sendChat(event) {
    event.preventDefault();
    const user = await refreshUser();
    if (!user) { say("community-status", "Sign in to send messages."); openSignin(); return; }
    const message = $("community-message").value.trim();
    if (!message) return;
    const { error } = await sb.from("community_posts").insert({ user_id: user.id, message });
    say("community-status", error ? error.message : "");
    if (!error) { $("community-form").reset(); await loadChat(); }
  }

  async function loadPending() {
    const host = $("pending-list");
    if (!host || !adminMode) return;
    const { data, error } = await sb.from("vpn_submissions").select("id,title,uploader,file_name,file_size,created_at,status,country").eq("status", "pending").order("created_at", { ascending: true });
    if (error) { host.innerHTML = `<p class="muted">${esc(error.message)}</p>`; return; }
    host.innerHTML = (data || []).map(file => `<article class="file-row"><div class="file-info"><b>${esc(file.title)}</b><p class="muted">${esc(file.country || "Country not set")} · ${esc(file.file_name)} · ${esc(file.uploader || "No display name")}</p></div><div class="file-actions"><button class="primary" type="button" data-approve="${esc(file.id)}">Approve</button><button class="outline" type="button" data-reject="${esc(file.id)}">Reject</button><button class="outline" type="button" data-delete-pending="${esc(file.id)}">Delete</button></div></article>`).join("") || '<p class="muted">No pending submissions.</p>';
    host.querySelectorAll("[data-approve]").forEach(button => button.addEventListener("click", () => review(button.dataset.approve, "approved")));
    host.querySelectorAll("[data-reject]").forEach(button => button.addEventListener("click", () => review(button.dataset.reject, "rejected")));
    host.querySelectorAll("[data-delete-pending]").forEach(button => button.addEventListener("click", () => deleteFile(button.dataset.deletePending)));
  }

  async function review(id, status) {
    if (!adminMode) return;
    const { error } = await sb.from("vpn_submissions").update({ status }).eq("id", id);
    say("admin-status", error ? error.message : `File ${status}.`);
    await loadPending(); await loadFiles();
  }

  async function logout() {
    const { error } = await sb.auth.signOut();
    if (error) say("profile-status", error.message);
    await refreshUser();
    say("profile-status", "Signed out.");
    say("admin-status", "");
    await loadFiles();
  }

  async function syncSession() {
    await refreshUser();
    await loadFiles();
    if (currentUser) { await loadProfile(); await loadChat(); startChatRealtime(); }
    else stopChatRealtime();
    if (adminMode) await loadPending();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    fillCountryMenus();
    $("country-filter")?.addEventListener("change", renderFiles);
    $("upload-form")?.addEventListener("submit", submitFile);
    $("profile-form")?.addEventListener("submit", saveProfile);
    $("community-form")?.addEventListener("submit", sendChat);
    $("user-logout")?.addEventListener("click", logout);
    $("refresh")?.addEventListener("click", async () => { await loadFiles(); if (adminMode) await loadPending(); });
    await syncSession();
    sb.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      adminMode = !!currentUser && currentUser.email?.toLowerCase() === ADMIN_EMAIL && currentUser.app_metadata?.role === "admin";
      applyAccess();
      setTimeout(async () => {
        if (currentUser) { await loadProfile(); await loadChat(); startChatRealtime(); }
        else { stopChatRealtime(); say("profile-status", "Sign in to manage your profile."); }
        if (adminMode) await loadPending();
        await loadFiles();
      }, 0);
    });
  });
})();
