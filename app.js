(() => {
  "use strict";
  const SUPABASE_URL = "https://vmiihzuzdiheyrhmpcor.supabase.co";
  const SUPABASE_KEY = "sb_publishable_gwSGws_4eY2lbP4fsnHUqw_EoVMnTov";
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.naruSupabase = sb;

  const $ = (id) => document.getElementById(id);
  const say = (id, msg) => { const el = $(id); if (el) el.textContent = msg || ""; };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  let currentUser = null;
  let adminMode = false;

  async function sessionUser() {
    const { data } = await sb.auth.getUser();
    currentUser = data.user || null;
    return currentUser;
  }

  async function loadFiles() {
    const host = $("file-list");
    if (!host) return;
    host.innerHTML = '<p class="muted">Loading approved files…</p>';
    const { data, error } = await sb.from("vpn_submissions")
      .select("id,title,uploader,file_name,file_size,view_count,download_count,created_at")
      .eq("status", "approved").order("created_at", { ascending: false });
    if (error) { host.innerHTML = `<p class="muted">Could not load files: ${esc(error.message)}</p>`; return; }
    if (!data?.length) { host.innerHTML = '<p class="muted">No approved files yet.</p>'; return; }
    host.innerHTML = data.map(f => `
      <article class="file-row" data-file-id="${esc(f.id)}">
        <div class="file-info"><b>${esc(f.title)}</b>
          <p class="muted">${esc(f.file_name || "File")} · ${esc(f.uploader || "Community member")}</p>
          <p class="muted">Views: <strong>${Number(f.view_count)||0}</strong> · Downloads: <strong>${Number(f.download_count)||0}</strong></p>
        </div>
        <div class="file-actions">
          <button class="outline" type="button" data-view="${esc(f.id)}">View</button>
          <button class="primary" type="button" data-download="${esc(f.id)}">Download</button>
        </div>
      </article>`).join("");
    host.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", async () => {
      const id = b.dataset.view;
      await sb.rpc("record_file_view", { file_id: id });
      b.closest(".file-row").querySelector(".file-info .muted:last-child").textContent =
        "Views: " + ((Number(data.find(x=>x.id===id)?.view_count)||0)+1) +
        " · Downloads: " + (Number(data.find(x=>x.id===id)?.download_count)||0);
    }));
    host.querySelectorAll("[data-download]").forEach(b => b.addEventListener("click", () => downloadFile(b.dataset.download)));
  }

  async function downloadFile(id) {
    const user = await sessionUser();
    if (!user) {
      say("accountStatus", "Please sign in or create an account before downloading.");
      const modal = $("accountModal");
      if (modal) modal.classList.add("show");
      return;
    }
    const { data: file, error } = await sb.from("vpn_submissions")
      .select("storage_path,file_name").eq("id", id).eq("status", "approved").single();
    if (error || !file) { alert("This file is not available."); return; }
    const { data: signed, error: signError } = await sb.storage.from("vpn-files")
      .createSignedUrl(file.storage_path, 90);
    if (signError || !signed?.signedUrl) { alert("Could not prepare download: " + (signError?.message || "")); return; }
    await sb.rpc("record_file_download", { file_id: id });
    const a = document.createElement("a");
    a.href = signed.signedUrl; a.download = file.file_name || ""; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    await loadFiles();
  }

  async function submitFile(e) {
    e.preventDefault();
    const user = await sessionUser();
    if (!user) { say("upload-status", "Please sign in before submitting a file."); $("accountModal")?.classList.add("show"); return; }
    const file = $("file")?.files?.[0];
    const title = $("title")?.value.trim();
    if (!file || !title) return;
    if (file.size > 50 * 1024 * 1024) { say("upload-status", "Maximum file size is 50 MB."); return; }
    say("upload-status", "Uploading your submission…");
    const safeName = file.name.replace(/[^\w.\-() ]/g, "_");
    const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await sb.storage.from("vpn-files").upload(path, file, { upsert: false });
    if (uploadError) { say("upload-status", uploadError.message); return; }
    const { error } = await sb.from("vpn_submissions").insert({
      title, uploader: $("uploader")?.value.trim() || null,
      file_name: file.name, file_size: file.size, storage_path: path,
      user_id: user.id, status: "pending"
    });
    if (error) {
      await sb.storage.from("vpn-files").remove([path]);
      say("upload-status", error.message); return;
    }
    $("upload-form").reset();
    say("upload-status", "Submitted. Your file will appear after administrator approval.");
    await loadPending();
  }

  async function loadProfile() {
    const user = await sessionUser();
    if (!user) return;
    const { data } = await sb.from("profiles").select("display_name,about,avatar_url").eq("id", user.id).maybeSingle();
    if (data) {
      $("profile-name").value = data.display_name || "";
      $("profile-about").value = data.about || "";
      if (data.avatar_url) say("profile-status", "Profile picture is saved.");
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    const user = await sessionUser();
    if (!user) { say("profile-status", "Please sign in first."); $("accountModal")?.classList.add("show"); return; }
    let avatar_url = null;
    const avatar = $("profile-avatar")?.files?.[0];
    if (avatar) {
      if (!avatar.type.startsWith("image/") || avatar.size > 5 * 1024 * 1024) {
        say("profile-status", "Choose an image under 5 MB."); return;
      }
      const path = `${user.id}/${crypto.randomUUID()}-${avatar.name.replace(/[^\w.\-]/g,"_")}`;
      const { error: upErr } = await sb.storage.from("profile-avatars").upload(path, avatar, { upsert: true });
      if (upErr) { say("profile-status", upErr.message); return; }
      const { data } = sb.storage.from("profile-avatars").getPublicUrl(path);
      avatar_url = data.publicUrl;
    }
    const row = { id: user.id, display_name: $("profile-name").value.trim(), about: $("profile-about").value.trim(), updated_at: new Date().toISOString() };
    if (avatar_url) row.avatar_url = avatar_url;
    const { error } = await sb.from("profiles").upsert(row);
    say("profile-status", error ? error.message : "Profile saved.");
  }

  async function loadChat() {
    const host = $("community-messages");
    if (!host) return;
    const { data, error } = await sb.from("community_posts")
      .select("id,user_id,message,created_at").order("created_at", { ascending: true }).limit(100);
    if (error) { host.innerHTML = `<p class="muted">${esc(error.message)}</p>`; return; }
    if (!data?.length) { host.innerHTML = '<p class="muted">No messages yet. Start the conversation.</p>'; return; }
    const ids = [...new Set(data.map(x=>x.user_id))];
    const { data: profiles } = await sb.from("profiles").select("id,display_name,avatar_url").in("id", ids);
    const map = new Map((profiles||[]).map(p=>[p.id,p]));
    host.innerHTML = data.map(m => {
      const p = map.get(m.user_id);
      return `<article class="file-row"><div class="file-info"><b>${esc(p?.display_name || "Community member")}</b><p>${esc(m.message)}</p><small class="muted">${new Date(m.created_at).toLocaleString()}</small></div></article>`;
    }).join("");
    host.scrollTop = host.scrollHeight;
  }

  async function sendChat(e) {
    e.preventDefault();
    const user = await sessionUser();
    if (!user) { say("community-status", "Sign in to send messages."); $("accountModal")?.classList.add("show"); return; }
    const message = $("community-message").value.trim();
    if (!message) return;
    const { error } = await sb.from("community_posts").insert({ user_id: user.id, message });
    say("community-status", error ? error.message : "");
    if (!error) { $("community-form").reset(); await loadChat(); }
  }

  async function loadPending() {
    const host = $("pending-list");
    if (!host || !adminMode) return;
    const { data, error } = await sb.from("vpn_submissions")
      .select("id,title,uploader,file_name,file_size,created_at,status")
      .eq("status", "pending").order("created_at", { ascending: true });
    if (error) { host.innerHTML = `<p class="muted">${esc(error.message)}</p>`; return; }
    host.innerHTML = (data||[]).map(f => `
      <article class="file-row"><div class="file-info"><b>${esc(f.title)}</b>
      <p class="muted">${esc(f.file_name)} · ${esc(f.uploader||"No display name")}</p></div>
      <div class="file-actions"><button class="primary" data-approve="${esc(f.id)}">Approve</button>
      <button class="outline" data-reject="${esc(f.id)}">Reject</button></div></article>`).join("") || '<p class="muted">No pending submissions.</p>';
    host.querySelectorAll("[data-approve]").forEach(b=>b.addEventListener("click",()=>review(b.dataset.approve,"approved")));
    host.querySelectorAll("[data-reject]").forEach(b=>b.addEventListener("click",()=>review(b.dataset.reject,"rejected")));
  }

  async function review(id, status) {
    const { error } = await sb.from("vpn_submissions").update({ status }).eq("id", id);
    say("admin-status", error ? error.message : `File ${status}.`);
    await loadPending(); await loadFiles();
  }

  async function adminLogin(e) {
    e.preventDefault();
    say("admin-status", "Signing in…");
    const { error } = await sb.auth.signInWithPassword({
      email: $("admin-email").value.trim(), password: $("admin-password").value
    });
    if (error) { say("admin-status", error.message); return; }
    await checkAdmin();
  }

  async function checkAdmin() {
    const user = await sessionUser();
    adminMode = !!user && user.app_metadata?.role === "admin";
    if (adminMode) {
      say("admin-status", "Administrator signed in.");
      $("logout")?.classList.remove("hidden");
      await loadPending();
    } else if (user) {
      say("admin-status", "Signed in, but this account is not an administrator.");
    }
  }

  async function logout() {
    await sb.auth.signOut();
    currentUser = null; adminMode = false;
    say("admin-status", "Signed out.");
    $("logout")?.classList.add("hidden");
    if ($("pending-list")) $("pending-list").innerHTML = "";
  }

  document.addEventListener("DOMContentLoaded", async () => {
    $("upload-form")?.addEventListener("submit", submitFile);
    $("profile-form")?.addEventListener("submit", saveProfile);
    $("community-form")?.addEventListener("submit", sendChat);
    $("login-form")?.addEventListener("submit", adminLogin);
    $("logout")?.addEventListener("click", logout);
    $("refresh")?.addEventListener("click", async()=>{await loadFiles();await loadPending();});
    await sessionUser();
    await loadFiles(); await loadChat(); await loadProfile(); await checkAdmin();
    sb.auth.onAuthStateChange(async () => {
      await sessionUser(); await loadProfile(); await loadChat(); await checkAdmin();
    });
  });
})();