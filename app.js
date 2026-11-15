// Add your Supabase Project URL and anon/publishable key below.
// Never put a Supabase service_role/secret key in a public website.
const SUPABASE_URL = "PASTE_YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_KEY";
const BUCKET = "vpn-files";
const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
const db = configured && window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = id => document.getElementById(id);
$("year").textContent = new Date().getFullYear();

function configMessage(){return "Website files are published, but Supabase is not configured yet. Follow README.txt to connect it."}
async function loadApproved(){
  const box=$("file-list");
  if(!db){box.innerHTML=`<p class="muted">${configMessage()}</p>`;return;}
  const {data,error}=await db.from("vpn_submissions").select("id,title,uploader,file_name,file_path,created_at").eq("status","approved").order("created_at",{ascending:false});
  if(error){box.textContent="Could not load files: "+error.message;return;}
  box.innerHTML="";
  if(!data.length){box.innerHTML='<p class="muted">No approved files yet.</p>';return;}
  for(const item of data){
    const row=document.createElement("div");row.className="file-row";
    const info=document.createElement("div");info.innerHTML=`<b></b><small></small>`;info.querySelector("b").textContent=item.title;info.querySelector("small").textContent=`${item.file_name} • ${item.uploader||"Community member"}`;
    const btn=document.createElement("button");btn.className="outline";btn.textContent="Download";
    btn.onclick=async()=>{const {data,error}=await db.storage.from(BUCKET).createSignedUrl(item.file_path,60);if(error){alert(error.message);return;}window.open(data.signedUrl,"_blank");};
    row.append(info,btn);box.append(row);
  }
}
$("upload-form").addEventListener("submit",async e=>{
  e.preventDefault();const status=$("upload-status");
  if(!db){status.textContent=configMessage();return;}
  const file=$("file").files[0];
  if(!file){status.textContent="Please choose a file.";return;}
  if(file.size>10*1024*1024){status.textContent="Please choose a file smaller than 10 MB.";return;}
  status.textContent="Uploading for review…";
  const path=`${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
  const up=await db.storage.from(BUCKET).upload(path,file,{upsert:false});
  if(up.error){status.textContent=up.error.message;return;}
  const {error}=await db.from("vpn_submissions").insert({title:$("title").value.trim(),uploader:$("uploader").value.trim(),file_name:file.name,file_path:path,status:"pending"});
  if(error){await db.storage.from(BUCKET).remove([path]);status.textContent=error.message;return;}
  status.textContent="Submitted. It will appear after administrator approval.";
  e.target.reset();
});
$("refresh").onclick=loadApproved;
$("login-form").addEventListener("submit",async e=>{
  e.preventDefault();const status=$("admin-status");
  if(!db){status.textContent=configMessage();return;}
  const {data,error}=await db.auth.signInWithPassword({email:$("admin-email").value,password:$("admin-password").value});
  if(error){status.textContent=error.message;return;}
  if(data.user?.app_metadata?.role!=="admin"){await db.auth.signOut();status.textContent="This account is not an administrator.";return;}
  status.textContent="Administrator signed in."; $("logout").classList.remove("hidden"); await loadPending();
});
$("logout").onclick=async()=>{await db?.auth.signOut();$("logout").classList.add("hidden");$("pending-list").innerHTML="";$("admin-status").textContent="Signed out.";};
async function loadPending(){
  const box=$("pending-list");const {data,error}=await db.from("vpn_submissions").select("*").eq("status","pending").order("created_at");
  if(error){box.textContent=error.message;return;}box.innerHTML="<h3>Pending submissions</h3>";
  if(!data.length){box.innerHTML+="<p class='muted'>Nothing waiting for review.</p>";return;}
  for(const item of data){
    const row=document.createElement("div");row.className="file-row";const info=document.createElement("div");info.innerHTML="<b></b><small></small>";info.querySelector("b").textContent=item.title;info.querySelector("small").textContent=`${item.file_name} • ${item.uploader||"No name"}`;
    const actions=document.createElement("div");actions.className="file-actions";
    for(const [label,status] of [["Approve","approved"],["Reject","rejected"]]){const b=document.createElement("button");b.className="outline";b.textContent=label;b.onclick=async()=>{const {error}=await db.from("vpn_submissions").update({status}).eq("id",item.id);if(error)alert(error.message);else{await loadPending();await loadApproved();}};actions.append(b);}
    row.append(info,actions);box.append(row);
  }
}
loadApproved();
