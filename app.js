// NARU HIGURE FILE HUB — app.js
const SUPABASE_URL = "https://vmiihzuzdiheyrhmpcor.supabase.co";
const SUPABASE_KEY = "sb_publishable_gwSGws_4eY2lbP4fsnHUqw_EoVMnTov";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.naruSupabase = db;

const $ = id => document.getElementById(id);
const ADMIN_EMAIL = "kuraichironaruhigure@gmail.com";
const FILE_BUCKET = "vpn-files";
const AVATAR_BUCKET = "avatars";

let currentUser = null;

function status(id, message) {
  const el = $(id);
  if (el) el.textContent = message;
}

function safeText(value) {
  return String(value ?? "");
}

function make(tag, className, value) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (value !== undefined) el.textContent = value;
  return el;
}

async function getUser() {
  const { data } = await db.auth.getUser();
  currentUser = data.user || null;
  return currentUser;
}

async function requireSignIn() {
  const user = await getUser();
  if (!user) {
    alert("Please sign in or create an account before continuing.");
    $("openSignin")?.click();
    return null;
  }
  return user;
}

async function isAdmin() {
  const user = await getUser();
  return !!user &&
    user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
    user.app_metadata?.role === "admin";
}

// ---------- APPROVED FILES ----------
async function loadApproved() {
  const box = $("file-list");
  if (!box) return;

  box.replaceChildren(make("p", "muted", "Loading approved files..."));

  const { data, error } = await db
    .from("vpn_submissions")
    .select("id,title,uploader,file_name,file_path,created_at,view_count,download_count")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    box.replaceChildren(make("p", "status", error.message));
    return;
  }

  box.replaceChildren();

  if (!data?.length) {
    box.append(make("p", "muted", "No approved files yet."));
    return;
  }

  for (const item of data) {
    const card = make("article", "file-row");
    const info = make("div");
    info.append(make("b", "", item.title));
    info.append(make("small", "", "Uploaded by " + (item.uploader || "Community")));
    info.append(make("small", "", item.file_name || "File"));
    info.append(make("small", "", `Views: ${item.view_count || 0} · Downloads: ${item.download_count || 0}`));

    const actions = make("div", "file-actions");
    const download = make("button", "primary", "Download");
    download.type = "button";

    download.addEventListener("click", async () => {
      const user = await requireSignIn();
      if (!user) return;

      download.disabled = true;
      download.textContent = "Preparing...";

      const { data: signed, error: signError } = await db.storage
        .from(FILE_BUCKET)
        .createSignedUrl(item.file_path, 60);

      if (signError) {
        alert(signError.message);
        download.disabled = false;
        download.textContent = "Download";
        return;
      }

      await db.rpc("record_file_download", { file_id: item.id });

      const a = document.createElement("a");
      a.href = signed.signedUrl;
      a.download = item.file_name || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();

      download.disabled = false;
      download.textContent = "Download";
      loadApproved();
    });

    actions.append(download);
    info.append(actions);
    card.append(info);
    box.append(card);

    // Record a view when an approved file card is displayed.
    db.rpc("record_file_view", { file_id: item.id });
  }

  updateStats(data);
}

function updateStats(files) {
  const numbers = document.querySelectorAll(".stat-number");
  if (numbers[0]) {
    numbers[0].textContent = files.length;
  }
  if (numbers[3]) {
    db.from("community_posts")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => {
        numbers[3].textContent = count || 0;
      });
  }
}

// ---------- FILE SUBMISSIONS ----------
$("upload-form")?.addEventListener("submit", async event => {
  event.preventDefault();

  const user = await requireSignIn();
  if (!user) return;

  const file = $("file")?.files?.[0];
  const title = $("title")?.value.trim();
  const uploader = $("uploader")?.value.trim() || user.email;

  if (!file || !title) {
    status("upload-status", "Enter a title and choose a file.");
    return;
  }

  status("upload-status", "Uploading file...");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await db.storage
    .from(FILE_BUCKET)
    .upload(path, file, { upsert: false });

  if (uploadError) {
    status("upload-status", uploadError.message);
    return;
  }

  const { error: insertError } = await db
    .from("vpn_submissions")
    .insert({
      title,
      uploader,
      file_name: file.name,
      file_path: path,
      status: "pending",
      user_id: user.id
    });

  if (insertError) {
    status("upload-status", "File uploaded, but submission failed: " + insertError.message);
    return;
  }

  $("upload-form").reset();
  status("upload-status", "Submitted successfully. Wait for administrator approval.");
});

// ---------- USER PROFILE ----------
async function loadProfile() {
  const user = await getUser();
  if (!user) return;

  const { data } = await db
    .from("profiles")
    .select("display_name,about,avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (data) {
    $("profile-name").value = data.display_name || "";
    $("profile-about").value = data.about || "";
  }
}

$("profile-form")?.addEventListener("submit", async event => {
  event.preventDefault();

  const user = await requireSignIn();
  if (!user) return;

  status("profile-status", "Saving profile...");

  let avatarUrl = null;
  const imageFile = $("profile-avatar")?.files?.[0];

  if (imageFile) {
    if (!imageFile.type.startsWith("image/")) {
      status("profile-status", "Please select an image.");
      return;
    }

    if (imageFile.size > 3 * 1024 * 1024) {
      status("profile-status", "Please use an image smaller than 3 MB.");
      return;
    }

    const ext = imageFile.name.split(".").pop().replace(/[^a-z0-9]/gi, "");
    const path = `${user.id}/avatar-${Date.now()}.${ext || "jpg"}`;

    const { error: uploadError } = await db.storage
      .from(AVATAR_BUCKET)
      .upload(path, imageFile, { upsert: true });

    if (uploadError) {
      status("profile-status", uploadError.message);
      return;
    }

    const { data } = db.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    avatarUrl = data.publicUrl;
  }

  const profile = {
    id: user.id,
    display_name: $("profile-name").value.trim() || "Member",
    about: $("profile-about").value.trim(),
    updated_at: new Date().toISOString()
  };

  if (avatarUrl) profile.avatar_url = avatarUrl;

  const { error } = await db.from("profiles").upsert(profile);

  status("profile-status", error ? error.message : "Profile saved successfully.");
});

// ---------- COMMUNITY CHAT ----------
async function loadChat() {
  const box = $("community-messages");
  if (!box) return;

  const user = await getUser();
  if (!user) {
    box.replaceChildren(make("p", "muted", "Sign in to view community chat."));
    return;
  }

  const { data: posts, error } = await db
    .from("community_posts")
    .select("id,user_id,message,created_at")
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    box.replaceChildren(make("p", "status", error.message));
    return;
  }

  box.replaceChildren();

  if (!posts?.length) {
    box.append(make("p", "muted", "No messages yet. Start the conversation."));
    return;
  }

  const userIds = [...new Set(posts.map(post => post.user_id))];
  const { data: profiles } = await db
    .from("profiles")
    .select("id,display_name,avatar_url")
    .in("id", userIds);

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  posts.forEach(post => {
    const profile = profileMap.get(post.user_id);
    const row = make("article", "file-row");
    const info = make("div");

    if (profile?.avatar_url) {
      const avatar = document.createElement("img");
      avatar.src = profile.avatar_url;
      avatar.alt = "Profile picture";
      avatar.width = 38;
      avatar.height = 38;
      avatar.style.cssText = "width:38px;height:38px;object-fit:cover;border-radius:50%;";
      info.append(avatar);
    }

    info.append(make("b", "", profile?.display_name || "Member"));
    info.append(make("small", "", new Date(post.created_at).toLocaleString()));
    info.append(make("p", "", post.message));
    row.append(info);
    box.append(row);
  });

  box.scrollTop = box.scrollHeight;
}

$("community-form")?.addEventListener("submit", async event => {
  event.preventDefault();

  const user = await requireSignIn();
  if (!user) return;

  const message = $("community-message").value.trim();
  if (!message) return;

  status("community-status", "Sending...");

  const { error } = await db.from("community_posts").insert({
    user_id: user.id,
    message
  });

  if (error) {
    status("community-status", error.message);
    return;
  }

  $("community-message").value = "";
  status("community-status", "Message sent.");
  loadChat();
});

// ---------- ADMIN REVIEW ----------
async function loadPending() {
  const box = $("pending-list");
  if (!box) return;

  if (!(await isAdmin())) {
    box.replaceChildren();
    return;
  }

  const { data, error } = await db
    .from("vpn_submissions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    status("admin-status", error.message);
    return;
  }

  box.replaceChildren();

  if (!data?.length) {
    box.append(make("p", "muted", "No pending submissions."));
    return;
  }

  data.forEach(item => {
    const row = make("article", "file-row");
    const info = make("div");
    info.append(make("b", "", item.title));
    info.append(make("small", "", `${item.file_name} · ${item.uploader || "Member"}`));

    const actions = make("div", "file-actions");

    ["approved", "rejected"].forEach(nextStatus => {
      const button = make("button", nextStatus === "approved" ? "primary" : "outline",
        nextStatus === "approved" ? "Approve" : "Reject");
      button.type = "button";

      button.addEventListener("click", async () => {
        const { error: updateError } = await db
          .from("vpn_submissions")
          .update({ status: nextStatus })
          .eq("id", item.id);

        if (updateError) {
          status("admin-status", updateError.message);
          return;
        }

        status("admin-status", `File ${nextStatus}.`);
        loadPending();
        loadApproved();
      });

      actions.append(button);
    });

    row.append(info, actions);
    box.append(row);
  });
}

$("login-form")?.addEventListener("submit", async event => {
  event.preventDefault();

  status("admin-status", "Signing in...");

  const { data, error } = await db.auth.signInWithPassword({
    email: $("admin-email").value.trim(),
    password: $("admin-password").value
  });

  if (error) {
    status("admin-status", error.message);
    return;
  }

  const user = data.user;
  if (
    user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase() ||
    user.app_metadata?.role !== "admin"
  ) {
    await db.auth.signOut();
    status("admin-status", "This account is not authorised as administrator.");
    return;
  }

  status("admin-status", "Administrator signed in.");
  $("logout")?.classList.remove("hidden");
  loadPending();
});

$("logout")?.addEventListener("click", async () => {
  await db.auth.signOut();
  status("admin-status", "Signed out.");
  $("logout").classList.add("hidden");
  $("pending-list").replaceChildren();
});

$("refresh")?.addEventListener("click", () => {
  loadApproved();
  loadPending();
});

// ---------- SIGN-IN STATE ----------
async function refreshUserFeatures() {
  const user = await getUser();

  if (user) {
    await loadProfile();
    await loadChat();
  } else {
    $("community-messages")?.replaceChildren(
      make("p", "muted", "Sign in to view community chat.")
    );
  }

  if (await isAdmin()) {
    $("admin")?.classList.remove("hidden");
    $("logout")?.classList.remove("hidden");
    loadPending();
  }
}

db.auth.onAuthStateChange(() => {
  setTimeout(refreshUserFeatures, 0);
});

// Hide admin panel unless the administrator opens the admin address.
if (new URLSearchParams(location.search).get("admin") !== "1") {
  $("admin")?.classList.add("hidden");
}

loadApproved();
refreshUserFeatures();
