/* NARU HIGURE FILE HUB — app.js
 * Requires the Naru Higure base Supabase setup AND naru-higure-feature-upgrade.sql.
 * Browser-safe publishable key only. Never place a service-role key in this file.
 */
(() => {
  'use strict';
  const SUPABASE_URL = 'https://vmiihzuzdiheyrhmpcor.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_gwSGws_4eY2lbP4fsnHUqw_EoVMnTov';
  const ADMIN_EMAIL = 'kuraichironaruhigure@gmail.com';
  const FILE_BUCKET = 'vpn-files';
  const AVATAR_BUCKET = 'profile-avatars';
  const sb = window.naruSupabase || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.naruSupabase = sb;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const say = (id, msg) => { if ($(id)) $(id).textContent = msg || ''; };
  const countries = ['All countries','Zimbabwe','South Africa','Botswana','Zambia','Mozambique','Malawi','Namibia','Lesotho','Eswatini','Angola','Tanzania','Kenya','Uganda','Rwanda','Burundi','Democratic Republic of the Congo','Nigeria','Ghana','Other'];
  let user = null, admin = false, files = [], chatChannel = null, presenceTimer = null;
  const viewedThisSession = new Set();

  function button(text, attrs='') { return `<button type="button" class="outline" ${attrs}>${text}</button>`; }
  function injectFeatureUI() {
    if ($('naru-extra-features')) return;
    const main = $('files') || $('admin')?.parentElement?.parentElement || document.querySelector('main');
    if (!main) return;
    const section = document.createElement('section'); section.id = 'naru-extra-features'; section.className = 'section';
    section.innerHTML = `
      <style>
      #naru-extra-features .naru-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
      #naru-extra-features .naru-box{background:#111116;border:1px solid #38313a;border-radius:13px;padding:14px;margin:10px 0}
      #naru-extra-features input,#naru-extra-features select,#naru-extra-features textarea{width:100%;padding:10px;margin:5px 0 10px;background:#09090d;color:inherit;border:1px solid #49404a;border-radius:9px}
      #naru-extra-features textarea{min-height:72px}#naru-extra-features .naru-row{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
      #naru-extra-features .naru-row>*{flex:1 1 130px}#naru-extra-features h3{margin:4px 0 10px;font-size:17px}
      #naru-extra-features small{color:var(--muted)}#naru-extra-features .naru-item{padding:10px;border-bottom:1px solid #34313a}
      </style>
      <div class="panel"><h2>Hub tools & community features</h2><p class="muted">Notifications, saved files, ratings, community tools and help.</p>
        <div class="naru-grid">
          <div class="naru-box"><h3>🔔 Notifications</h3><div id="naru-notifications">Sign in to view notifications.</div></div>
          <div class="naru-box"><h3>🔖 Saved files</h3><div id="naru-saved">Sign in to view saved files.</div></div>
          <div class="naru-box"><h3>📢 Announcements</h3><div id="naru-announcements">Loading announcements…</div><div id="naru-announcement-admin" class="hidden"><input id="naru-ann-title" maxlength="120" placeholder="Announcement title"><textarea id="naru-ann-body" maxlength="3000" placeholder="Announcement details"></textarea><button class="primary" id="naru-ann-post">Publish announcement</button></div></div>
          <div class="naru-box"><h3>🏆 Contributor leaderboard</h3><div id="naru-leaderboard">Loading leaderboard…</div></div>
          <div class="naru-box"><h3>🟢 Online members</h3><div id="naru-online">Sign in to see members online.</div></div>
          <div class="naru-box"><h3>❓ Help centre / FAQ</h3><div id="naru-help">Loading help articles…</div><div id="naru-help-admin" class="hidden"><input id="naru-help-q" placeholder="FAQ question"><textarea id="naru-help-a" placeholder="Answer"></textarea><button class="primary" id="naru-help-add">Add FAQ</button></div></div>
        </div>
        <div class="naru-box"><h3>🔎 Advanced file search</h3><div class="naru-row"><input id="naru-search" placeholder="Search file title or uploader"><select id="naru-type"><option value="">All file types</option><option>ovpn</option><option>json</option><option>conf</option><option>txt</option><option>npv</option><option>hat</option><option>other</option></select><input id="naru-date" type="date"></div><p class="muted">Filters apply to the VPN file list above.</p></div>
        <div class="naru-box"><h3>👥 Community replies & reactions</h3><p class="muted">Replies and emoji reactions appear below each community post.</p></div>
        <div id="naru-admin-tools" class="naru-box hidden"><h3>📊 Admin analytics</h3><div id="naru-analytics">Loading analytics…</div><h3>🚩 Content reports</h3><div id="naru-reports">Loading reports…</div><h3>🧾 Admin activity log</h3><div id="naru-logs">Loading activity…</div></div>
      </div>`;
    main.appendChild(section);
    const filesSection = $('files');
    const fileList = $('file-list');
    if (filesSection && fileList && !$('naru-country')) {
      const countryWrap = document.createElement('div');
      countryWrap.className = 'panel';
      countryWrap.style.marginBottom = '12px';
      countryWrap.innerHTML = '<label for="naru-country" style="display:block;margin:0 0 8px;font-weight:700">Filter VPN files by country</label><select id="naru-country" aria-label="Filter VPN files by country" style="width:100%;padding:13px;background:#09090d;color:white;border:1px solid #ef2638;border-radius:10px"></select>';
      fileList.parentElement.insertBefore(countryWrap, fileList);
    }
    const uploadForm = $('upload-form');
    if (uploadForm && !$('file-country')) {
      const label = document.createElement('label'); label.textContent = 'Country';
      const select = document.createElement('select'); select.id = 'file-country'; select.required = true;
      select.innerHTML = countries.filter(c=>c!=='All countries').map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
      const submit = uploadForm.querySelector('[type=submit]'); uploadForm.insertBefore(label, submit || null); label.appendChild(select);
    }
    const country = $('naru-country'); country.innerHTML = countries.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  }

  function setAccess() {
    const signed = !!user;
    ['upload-gate','community-gate','profile-gate'].forEach(id=>$(id)?.classList.toggle('hidden',signed));
    ['upload-form','community-form','profile-form','community-messages','user-logout'].forEach(id=>$(id)?.classList.toggle('hidden',!signed));
    $('admin')?.classList.toggle('hidden',!admin);
    $('admin-gate')?.classList.toggle('hidden',admin);
    $('admin-menu-link')?.classList.toggle('hidden',!admin);
    $('naru-admin-tools')?.classList.toggle('hidden',!admin);
    $('naru-announcement-admin')?.classList.toggle('hidden',!admin);
    $('naru-help-admin')?.classList.toggle('hidden',!admin);
    if ($('openSignin')) $('openSignin').textContent = signed ? 'Account' : 'Sign in';
  }
  async function refreshUser() {
    const {data,error}=await sb.auth.getUser(); if(error) console.warn(error.message);
    user=data?.user||null;
    admin=!!user && user.email?.toLowerCase()===ADMIN_EMAIL && user.app_metadata?.role==='admin';
    setAccess(); return user;
  }
  function openSignin(){ $('openSignin')?.click(); }

  async function loadFiles() {
    const host=$('file-list'); if(!host)return;
    host.innerHTML='<p class="muted">Loading approved files…</p>';
    let q=sb.from('vpn_submissions').select('id,title,uploader,file_name,file_size,storage_path,file_path,country,view_count,download_count,created_at,user_id').eq('status','approved').order('created_at',{ascending:false});
    let {data,error}=await q;
    if(error && /country/i.test(error.message)) { const fallback=await sb.from('vpn_submissions').select('id,title,uploader,file_name,file_size,storage_path,file_path,view_count,download_count,created_at,user_id').eq('status','approved').order('created_at',{ascending:false}); data=fallback.data; error=fallback.error; if(data)data=data.map(f=>({...f,country:'Zimbabwe'})); }
    if(error){host.innerHTML=`<p class="muted">Could not load files: ${esc(error.message)}</p>`;return;}
    files=data||[];
    const countrySel=$('naru-country'); if(countrySel){const previous=countrySel.value||'All countries';const opts=[...new Set([...countries,...files.map(f=>f.country||'Zimbabwe')])];countrySel.innerHTML=opts.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');countrySel.value=opts.includes(previous)?previous:'All countries';}
    renderFiles(); loadTotals();
  }
  function renderFiles() {
    const host=$('file-list');if(!host)return;
    const query=($('naru-search')?.value||'').toLowerCase(); const country=$('naru-country')?.value||'All countries';
    const type=($('naru-type')?.value||'').toLowerCase(); const date=$('naru-date')?.value||'';
    const filtered=files.filter(f=>{const name=(f.file_name||'').toLowerCase();return (!query||`${f.title} ${f.uploader} ${name}`.toLowerCase().includes(query))&&(country==='All countries'||(f.country||'Zimbabwe')===country)&&(!type||name.endsWith('.'+type)||name.toLowerCase().includes(type))&&(!date||String(f.created_at||'').slice(0,10)===date);});
    if(!filtered.length){host.innerHTML='<p class="muted">No approved files match these filters.</p>';return;}
    host.innerHTML=filtered.map(f=>`<article class="file-row" data-file-id="${esc(f.id)}"><div class="file-info"><b>${esc(f.title||f.file_name)}</b><small>${esc(f.file_name||'File')} · ${esc(f.uploader||'Community member')} · ${esc(f.country||'Zimbabwe')}</small><small>Views: ${Number(f.view_count)||0} · Downloads: ${Number(f.download_count)||0}</small><small id="rating-${esc(f.id)}">Ratings loading…</small></div><div class="file-actions"><button class="primary" data-download="${esc(f.id)}">Download</button><button class="outline" data-save="${esc(f.id)}">☆ Save</button><button class="outline" data-rate="${esc(f.id)}">Rate</button><button class="outline" data-report="${esc(f.id)}">Report</button><button class="outline" data-version="${esc(f.id)}">Versions</button>${admin?`<button class="outline" data-delete="${esc(f.id)}">Delete</button><button class="outline" data-add-version="${esc(f.id)}">Add version</button>`:''}</div></article>`).join('');
    host.querySelectorAll('[data-download]').forEach(b=>b.onclick=()=>downloadFile(b.dataset.download));
    host.querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>toggleSaved(b.dataset.save));
    host.querySelectorAll('[data-rate]').forEach(b=>b.onclick=()=>rateFile(b.dataset.rate));
    host.querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>reportContent(b.dataset.report,null));
    host.querySelectorAll('[data-version]').forEach(b=>b.onclick=()=>showVersions(b.dataset.version));
    host.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteFile(b.dataset.delete));
    host.querySelectorAll('[data-add-version]').forEach(b=>b.onclick=()=>addVersion(b.dataset.addVersion));
    filtered.forEach(f=>{ loadRatingSummary(f.id); if(!viewedThisSession.has(f.id)){ viewedThisSession.add(f.id); recordView(f.id).then(()=>{ f.view_count=Number(f.view_count||0)+1; }); } });
  }
  async function loadTotals(){const {data,error}=await sb.from('vpn_submissions').select('view_count,download_count').eq('status','approved');if(error)return;const v=(data||[]).reduce((n,x)=>n+Number(x.view_count||0),0),d=(data||[]).reduce((n,x)=>n+Number(x.download_count||0),0);say('total-views',v.toLocaleString());say('total-downloads',d.toLocaleString());}
  async function recordView(id){const {error}=await sb.rpc('record_file_view',{file_id:id});if(error)console.warn('View count:',error.message);}
  async function downloadFile(id){if(!await refreshUser()){openSignin();return;}const f=files.find(x=>x.id===id);if(!f)return;const path=f.storage_path||f.file_path;if(!path){alert('File storage path is missing.');return;}const {data,error}=await sb.storage.from(FILE_BUCKET).createSignedUrl(path,120);if(error){alert(error.message);return;}const count=await sb.rpc('record_file_download',{file_id:id});if(count.error){alert(count.error.message);return;}await recordView(id);const a=document.createElement('a');a.href=data.signedUrl;a.download=f.file_name||'download';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();await loadFiles();}
  async function submitFile(e){e.preventDefault();if(!await refreshUser()){openSignin();return;}const file=$('file')?.files?.[0],title=$('title')?.value.trim();if(!file||!title)return;if(file.size>50*1024*1024){say('upload-status','Maximum file size is 50 MB.');return;}const country=$('file-country')?.value||'Zimbabwe';say('upload-status','Uploading…');const path=`${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.()-]/g,'_')}`;const up=await sb.storage.from(FILE_BUCKET).upload(path,file);if(up.error){say('upload-status',up.error.message);return;}const {error}=await sb.from('vpn_submissions').insert({title,uploader:$('uploader')?.value.trim()||null,file_name:file.name,file_size:file.size,storage_path:path,country,user_id:user.id,status:'pending'});if(error){await sb.storage.from(FILE_BUCKET).remove([path]);say('upload-status',error.message);return;}$('upload-form').reset();say('upload-status','Submitted. It will appear after admin approval.');}
  async function deleteFile(id){if(!admin||!confirm('Permanently delete this file?'))return;const f=files.find(x=>x.id===id);const path=f?.storage_path||f?.file_path;if(path){const r=await sb.storage.from(FILE_BUCKET).remove([path]);if(r.error){alert(r.error.message);return;}}const {error}=await sb.from('vpn_submissions').delete().eq('id',id);if(error)alert(error.message);else await loadFiles();}

  // Feature 1: approval/rejection notifications
  async function loadNotifications(){const box=$('naru-notifications');if(!box)return;if(!user){box.textContent='Sign in to view notifications.';return;}const {data,error}=await sb.from('notifications').select('*').order('created_at',{ascending:false}).limit(20);if(error){box.textContent=error.message;return;}box.innerHTML=(data||[]).map(n=>`<div class="naru-item"><b>${esc(n.title)}</b><p>${esc(n.body)}</p><small>${new Date(n.created_at).toLocaleString()} · ${n.is_read?'Read':'New'}</small>${!n.is_read?button('Mark read',`data-notice-read="${esc(n.id)}"`):''}</div>`).join('')||'<small>No notifications yet.</small>';box.querySelectorAll('[data-notice-read]').forEach(b=>b.onclick=async()=>{await sb.from('notifications').update({is_read:true}).eq('id',b.dataset.noticeRead);loadNotifications();});}
  // Feature 7: bookmarks
  async function toggleSaved(id){if(!await refreshUser()){openSignin();return;}const {data}=await sb.from('saved_files').select('file_id').eq('file_id',id).maybeSingle();const result=data?await sb.from('saved_files').delete().eq('file_id',id):await sb.from('saved_files').insert({user_id:user.id,file_id:id});if(result.error)alert(result.error.message);else{loadSaved();alert(data?'Removed from saved files.':'File saved.');}}
  async function loadSaved(){const box=$('naru-saved');if(!box)return;if(!user){box.textContent='Sign in to view saved files.';return;}const {data,error}=await sb.from('saved_files').select('file_id,vpn_submissions(id,title,file_name,country)').order('created_at',{ascending:false});if(error){box.textContent=error.message;return;}box.innerHTML=(data||[]).map(x=>`<div class="naru-item">${esc(x.vpn_submissions?.title||x.vpn_submissions?.file_name||x.file_id)} ${button('Remove',`data-unsave="${esc(x.file_id)}"`)}</div>`).join('')||'<small>No saved files yet.</small>';box.querySelectorAll('[data-unsave]').forEach(b=>b.onclick=()=>toggleSaved(b.dataset.unsave));}
  // Feature 8: ratings and feedback
  async function rateFile(id){if(!await refreshUser()){openSignin();return;}const rating=Number(prompt('Rate this file from 1 to 5 stars:'));if(!Number.isInteger(rating)||rating<1||rating>5)return;const feedback=prompt('Optional feedback (up to 500 characters):')||'';const {error}=await sb.from('file_ratings').upsert({file_id:id,user_id:user.id,rating,feedback:feedback.slice(0,500),updated_at:new Date().toISOString()},{onConflict:'file_id,user_id'});if(error)alert(error.message);else loadRatingSummary(id);}
  async function loadRatingSummary(id){const {data,error}=await sb.from('file_ratings').select('rating').eq('file_id',id);const el=$(`rating-${id}`);if(error||!el)return;const a=data||[];el.textContent=a.length?`Rating: ${(a.reduce((n,x)=>n+x.rating,0)/a.length).toFixed(1)}/5 (${a.length})`:'Not rated yet';}
  // Feature 11: reports
  async function reportContent(fileId,postId){if(!await refreshUser()){openSignin();return;}const reason=prompt('Report reason: broken_file, spam, inappropriate, or other','broken_file');if(!['broken_file','spam','inappropriate','other'].includes(reason))return;const details=prompt('Extra details (optional):')||'';const {error}=await sb.from('content_reports').insert({reporter_id:user.id,file_id:fileId,community_post_id:postId,reason,details:details.slice(0,1000)});alert(error?error.message:'Report submitted for admin review.');}
  // Feature 12: file version history
  async function showVersions(id){const {data,error}=await sb.from('file_versions').select('version_label,notes,created_at').eq('file_id',id).order('created_at',{ascending:false});if(error){alert(error.message);return;}alert((data||[]).map(v=>`${v.version_label} — ${v.notes} (${new Date(v.created_at).toLocaleDateString()})`).join('\n')||'No version history yet.');}
  async function addVersion(id){if(!admin)return;const picker=document.createElement('input');picker.type='file';picker.accept='*/*';picker.onchange=async()=>{const f=picker.files?.[0];if(!f)return;const label=prompt('Version label (for example 2.0)','2.0');if(!label)return;const notes=prompt('Version notes (optional)')||'';const path=`versions/${id}/${Date.now()}-${f.name.replace(/[^\w.-]/g,'_')}`;const up=await sb.storage.from(FILE_BUCKET).upload(path,f);if(up.error){alert(up.error.message);return;}const {error}=await sb.from('file_versions').insert({file_id:id,version_label:label,storage_path:path,notes:notes.slice(0,500),created_by:user.id});if(error)alert(error.message);else alert('Version saved to history.');};picker.click();}

  // Features 5 and 6: replies and reactions
  async function loadChat(){const host=$('community-messages');if(!host||!user)return;const cutoff=new Date(Date.now()-86400000).toISOString();const {data,error}=await sb.from('community_posts').select('id,user_id,message,created_at').gte('created_at',cutoff).order('created_at',{ascending:true}).limit(100);if(error){host.textContent=error.message;return;}const ids=[...new Set((data||[]).map(x=>x.user_id))];const prof=ids.length?await sb.from('profiles').select('id,display_name,avatar_url').in('id',ids):{data:[]};const map=new Map((prof.data||[]).map(p=>[p.id,p]));host.innerHTML=(data||[]).map(p=>`<article class="file-row"><div class="file-info"><b>${esc(map.get(p.user_id)?.display_name||'Community member')}</b><p>${esc(p.message)}</p><small>${new Date(p.created_at).toLocaleString()}</small><div class="naru-row">${['👍','❤️','😂','🔥','👏'].map(e=>`<button class="outline" data-react="${esc(p.id)}" data-emoji="${e}">${e}</button>`).join('')}<button class="outline" data-reply="${esc(p.id)}">Reply</button><button class="outline" data-post-report="${esc(p.id)}">Report</button></div><div id="replies-${esc(p.id)}"></div></div></article>`).join('')||'<p class="muted">No community messages in the last 24 hours.</p>';
    host.querySelectorAll('[data-react]').forEach(b=>b.onclick=()=>react(b.dataset.react,b.dataset.emoji));host.querySelectorAll('[data-reply]').forEach(b=>b.onclick=()=>reply(b.dataset.reply));host.querySelectorAll('[data-post-report]').forEach(b=>b.onclick=()=>reportContent(null,b.dataset.postReport));for(const p of data||[])loadReplies(p.id);
  }
  async function loadReplies(postId){const box=$(`replies-${postId}`);if(!box)return;const {data,error}=await sb.from('community_replies').select('message,created_at,user_id').eq('post_id',postId).order('created_at');if(error){box.textContent=error.message;return;}box.innerHTML=(data||[]).map(r=>`<div class="naru-item"><small>${esc(r.message)} · ${new Date(r.created_at).toLocaleString()}</small></div>`).join('');}
  async function reply(postId){if(!await refreshUser()){openSignin();return;}const message=prompt('Write your reply (max 1000 characters):');if(!message?.trim())return;const {error}=await sb.from('community_replies').insert({post_id:postId,user_id:user.id,message:message.trim().slice(0,1000)});if(error)alert(error.message);else loadReplies(postId);}
  async function react(postId,emoji){if(!await refreshUser()){openSignin();return;}const {data}=await sb.from('community_reactions').select('id').eq('post_id',postId).eq('user_id',user.id).eq('emoji',emoji).maybeSingle();const result=data?await sb.from('community_reactions').delete().eq('id',data.id):await sb.from('community_reactions').insert({post_id:postId,user_id:user.id,emoji});if(result.error)alert(result.error.message);}
  async function sendChat(e){e.preventDefault();if(!await refreshUser()){openSignin();return;}const message=$('community-message')?.value.trim();if(!message)return;const {error}=await sb.from('community_posts').insert({user_id:user.id,message});say('community-status',error?.message||'Message sent.');if(!error){$('community-form').reset();loadChat();}}
  function startChatRealtime(){if(!user||chatChannel)return;chatChannel=sb.channel('naru-hub-chat').on('postgres_changes',{event:'*',schema:'public',table:'community_posts'},()=>loadChat()).subscribe();}
  function stopChatRealtime(){if(chatChannel){sb.removeChannel(chatChannel);chatChannel=null;}}

  // Feature 3: admin analytics
  async function loadAnalytics(){const box=$('naru-analytics');if(!box||!admin)return;const {data,error}=await sb.from('naru_admin_analytics').select('*').maybeSingle();if(error){box.textContent=error.message;return;}box.innerHTML=data?Object.entries(data).map(([k,v])=>`<div class="naru-item"><b>${esc(k.replaceAll('_',' '))}:</b> ${Number(v).toLocaleString()}</div>`).join(''):'No analytics available.';}
  // Feature 9: announcements
  async function loadAnnouncements(){const box=$('naru-announcements');if(!box)return;const {data,error}=await sb.from('announcements').select('*').eq('is_published',true).order('created_at',{ascending:false}).limit(20);if(error){box.textContent=error.message;return;}box.innerHTML=(data||[]).map(a=>`<div class="naru-item"><b>${esc(a.title)}</b><p>${esc(a.body)}</p><small>${new Date(a.created_at).toLocaleString()}</small></div>`).join('')||'<small>No announcements.</small>';}
  async function postAnnouncement(){const title=$('naru-ann-title').value.trim(),body=$('naru-ann-body').value.trim();if(!admin||!title||!body)return;const {error}=await sb.from('announcements').insert({title,body,created_by:user.id,is_published:true});say('naru-ann-title','');if(error)alert(error.message);else{$('naru-ann-title').value='';$('naru-ann-body').value='';loadAnnouncements();}}
  // Feature 10: leaderboard
  async function loadLeaderboard(){const box=$('naru-leaderboard');if(!box)return;const {data,error}=await sb.from('naru_contributor_leaderboard').select('*').limit(20);if(error){box.textContent=error.message;return;}box.innerHTML=(data||[]).map((x,i)=>`<div class="naru-item">${i+1}. <b>${esc(x.display_name)}</b> — ${x.approved_uploads} approved uploads</div>`).join('')||'<small>No approved contributors yet.</small>';}
  // Feature 13: online presence heartbeat
  async function heartbeat(){if(!user)return;const {error}=await sb.from('online_presence').upsert({user_id:user.id,last_seen_at:new Date().toISOString()},{onConflict:'user_id'});if(error)console.warn('Presence:',error.message);}
  async function loadOnline(){const box=$('naru-online');if(!box)return;if(!user){box.textContent='Sign in to see members online.';return;}const cutoff=new Date(Date.now()-5*60000).toISOString();const {data,error}=await sb.from('online_presence').select('user_id,last_seen_at').gte('last_seen_at',cutoff).limit(100);if(error){box.textContent=error.message;return;}box.textContent=`${data?.length||0} member(s) active in the last 5 minutes.`;}
  // Feature 14: FAQ
  async function loadHelp(){const box=$('naru-help');if(!box)return;const {data,error}=await sb.from('help_articles').select('*').eq('is_published',true).order('sort_order');if(error){box.textContent=error.message;return;}box.innerHTML=(data||[]).map(x=>`<details class="naru-item"><summary>${esc(x.question)}</summary><p>${esc(x.answer)}</p></details>`).join('')||'<small>Help articles will appear here.</small>';}
  async function addHelp(){if(!admin)return;const question=$('naru-help-q').value.trim(),answer=$('naru-help-a').value.trim();if(!question||!answer)return;const {error}=await sb.from('help_articles').insert({question,answer,updated_by:user.id,is_published:true});if(error)alert(error.message);else{$('naru-help-q').value='';$('naru-help-a').value='';loadHelp();}}
  // Feature 15: admin logs and report moderation
  async function loadReports(){const box=$('naru-reports');if(!box||!admin)return;const {data,error}=await sb.from('content_reports').select('*').order('created_at',{ascending:false}).limit(50);if(error){box.textContent=error.message;return;}box.innerHTML=(data||[]).map(r=>`<div class="naru-item"><b>${esc(r.reason)}</b> · ${esc(r.details)} · ${esc(r.status)} ${button('Resolve',`data-resolve="${r.id}"`)}</div>`).join('')||'<small>No reports.</small>';box.querySelectorAll('[data-resolve]').forEach(b=>b.onclick=async()=>{const {error}=await sb.from('content_reports').update({status:'resolved',reviewed_by:user.id}).eq('id',b.dataset.resolve);if(error)alert(error.message);else loadReports();});}
  async function loadLogs(){const box=$('naru-logs');if(!box||!admin)return;const {data,error}=await sb.from('admin_activity_logs').select('*').order('created_at',{ascending:false}).limit(40);if(error){box.textContent=error.message;return;}box.innerHTML=(data||[]).map(l=>`<div class="naru-item">${esc(l.action)} · ${esc(l.target_table)} · ${new Date(l.created_at).toLocaleString()}</div>`).join('')||'<small>No activity recorded.</small>';}
  async function loadPending(){const host=$('pending-list');if(!host||!admin)return;const {data,error}=await sb.from('vpn_submissions').select('id,title,file_name,uploader,country,status,created_at').eq('status','pending').order('created_at');if(error){host.textContent=error.message;return;}host.innerHTML=(data||[]).map(f=>`<article class="file-row"><div><b>${esc(f.title)}</b><small>${esc(f.file_name)} · ${esc(f.uploader)} · ${esc(f.country||'Zimbabwe')}</small></div><div class="file-actions"><button class="primary" data-approve="${f.id}">Approve</button><button class="outline" data-reject="${f.id}">Reject</button></div></article>`).join('')||'<p class="muted">No pending submissions.</p>';host.querySelectorAll('[data-approve]').forEach(b=>b.onclick=()=>review(b.dataset.approve,'approved'));host.querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>review(b.dataset.reject,'rejected'));}
  async function review(id,status){if(!admin)return;const {error}=await sb.from('vpn_submissions').update({status}).eq('id',id);say('admin-status',error?.message||`File ${status}.`);if(!error){loadPending();loadFiles();loadNotifications();}}

  async function loadProfile(){if(!user)return;const {data,error}=await sb.from('profiles').select('display_name,about,avatar_url').eq('id',user.id).maybeSingle();if(error){say('profile-status',error.message);return;}if(data){if($('profile-name'))$('profile-name').value=data.display_name||'';if($('profile-about'))$('profile-about').value=data.about||'';if(data.avatar_url&&$('profile-preview')){$('profile-preview').src=data.avatar_url;$('profile-preview').classList.remove('hidden');}say('profile-preview-name',data.display_name||'Your profile');}}
  async function saveProfile(e){e.preventDefault();if(!await refreshUser()){openSignin();return;}let avatar_url;const f=$('profile-avatar')?.files?.[0];if(f){if(!f.type.startsWith('image/')||f.size>5*1024*1024){say('profile-status','Choose an image under 5 MB.');return;}const path=`${user.id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]/g,'_')}`;const up=await sb.storage.from(AVATAR_BUCKET).upload(path,f);if(up.error){say('profile-status',up.error.message);return;}avatar_url=sb.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;}const row={id:user.id,display_name:$('profile-name')?.value.trim()||'Community member',about:$('profile-about')?.value.trim()||'',updated_at:new Date().toISOString()};if(avatar_url)row.avatar_url=avatar_url;const {error}=await sb.from('profiles').upsert(row,{onConflict:'id'});say('profile-status',error?.message||'Profile saved.');if(!error)loadProfile();}
  async function logout(){stopChatRealtime();if(presenceTimer)clearInterval(presenceTimer);await sb.from('online_presence').delete().eq('user_id',user?.id);await sb.auth.signOut();await refreshUser();loadFiles();}
  function bind(){
    $('upload-form')?.addEventListener('submit',submitFile);$('community-form')?.addEventListener('submit',sendChat);$('profile-form')?.addEventListener('submit',saveProfile);$('user-logout')?.addEventListener('click',logout);$('logout')?.addEventListener('click',logout);$('refresh')?.addEventListener('click',()=>{loadFiles();if(admin)loadPending();});
    $('naru-search')?.addEventListener('input',renderFiles);$('naru-country')?.addEventListener('change',renderFiles);$('naru-type')?.addEventListener('change',renderFiles);$('naru-date')?.addEventListener('change',renderFiles);
    $('naru-ann-post')?.addEventListener('click',postAnnouncement);$('naru-help-add')?.addEventListener('click',addHelp);
    $('searchForm')?.addEventListener('submit',e=>{e.preventDefault();if($('naru-search'))$('naru-search').value=$('hubSearch')?.value||'';renderFiles();$('files')?.scrollIntoView({behavior:'smooth'});});
    if($('year'))say('year',new Date().getFullYear());
  }
  async function loadFeatures(){await Promise.all([loadNotifications(),loadSaved(),loadAnnouncements(),loadLeaderboard(),loadHelp()]);if(admin)await Promise.all([loadAnalytics(),loadReports(),loadLogs()]);await loadOnline();}
  async function sync(){if(presenceTimer){clearInterval(presenceTimer);presenceTimer=null;}await refreshUser();await loadFiles();await loadAnnouncements();await loadLeaderboard();await loadHelp();if(user){await Promise.all([loadProfile(),loadChat(),loadNotifications(),loadSaved(),heartbeat(),loadOnline()]);startChatRealtime();presenceTimer=setInterval(()=>{heartbeat();loadOnline();},60000);}else{stopChatRealtime();}if(admin){await Promise.all([loadPending(),loadAnalytics(),loadReports(),loadLogs()]);}}
  document.addEventListener('DOMContentLoaded',()=>{injectFeatureUI();bind();sync();sb.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;admin=!!user&&user.email?.toLowerCase()===ADMIN_EMAIL&&user.app_metadata?.role==='admin';setAccess();setTimeout(()=>sync(),0);});});
})();
