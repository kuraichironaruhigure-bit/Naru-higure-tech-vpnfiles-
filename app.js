/* NARU HIGURE FILE HUB — repaired client script. Uses only the Supabase public key. */
(() => {
  'use strict';
  const SUPABASE_URL = 'https://vmiihzuzdiheyrhmpcor.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_gwSGws_4eY2lbP4fsnHUqw_EoVMnTov';
  const FILE_BUCKET = 'vpn-files';
  const AVATAR_BUCKET = 'profile-avatars';
  const $ = id => document.getElementById(id);
  const setText = (id, value) => { const el=$(id); if(el) el.textContent=String(value ?? ''); };
  const show = (id, yes) => { const el=$(id); if(el) el.classList.toggle('hidden', !yes); };
  const status = (id, value) => setText(id, value);
  const viewed = new Set();
  let db=null, currentUser=null, isAdmin=false, approvedFiles=[];
  let selectedCountry='All countries';
  const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function initClient(){
    if (!window.supabase?.createClient) {
      const target=$('file-list'); if(target) target.textContent='Supabase did not load. Check your internet connection and refresh.';
      return false;
    }
    db = window.naruSupabase || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    window.naruSupabase=db;
    return true;
  }

  function ensureCountryControls(){
    const filter=$('country-filter');
    if(filter){
      selectedCountry=filter.value || 'All countries';
      if(selectedCountry==='All') selectedCountry='All countries';
      filter.addEventListener('change',()=>{selectedCountry=filter.value;renderFiles();});
    }
    const uploadForm=$('upload-form');
    if(uploadForm && !$('file-country')){
      const label=document.createElement('label');
      label.textContent='Country';
      const select=document.createElement('select'); select.id='file-country'; select.required=true;
      select.innerHTML='<option value="Zimbabwe">Zimbabwe</option><option value="South Africa">South Africa</option><option value="Botswana">Botswana</option><option value="Zambia">Zambia</option><option value="Mozambique">Mozambique</option><option value="Other">Other</option>';
      label.appendChild(select);
      const submit=uploadForm.querySelector('[type="submit"]');
      uploadForm.insertBefore(label,submit || null);
    }
    if(filter && filter.options.length<=2){
      const known=['All countries','Zimbabwe','South Africa','Botswana','Zambia','Mozambique','Other'];
      filter.innerHTML=known.map(x=>`<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`).join('');
      filter.value=selectedCountry;
    }
  }

  function updateAuthUI(){
    const signed=!!currentUser;
    show('upload-gate',!signed); show('community-gate',!signed); show('profile-gate',!signed);
    show('upload-form',signed); show('community-form',signed); show('profile-form',signed);
    show('community-messages',signed);
    show('user-logout',signed);
    if($('openSignin')) $('openSignin').textContent=signed?'Account':'Sign in';
    if(!signed){
      status('community-status','Sign in to use the community.');
      status('profile-status','Sign in to edit your profile.');
      status('upload-status','Sign in to submit a file.');
      show('admin',false); show('admin-gate',false); show('admin-menu-link',false);
    } else {
      status('community-status','');
      if(isAdmin){show('admin',true);show('admin-gate',false);show('admin-menu-link',true);}
      else {show('admin',false);show('admin-gate',true);show('admin-menu-link',false);}
    }
  }

  async function refreshSession(){
    const {data,error}=await db.auth.getSession();
    if(error) console.warn('Session check:',error.message);
    currentUser=data?.session?.user || null;
    isAdmin=currentUser?.app_metadata?.role==='admin';
    updateAuthUI();
    if(currentUser){await Promise.all([loadCommunity(),loadProfile()]);}
    if(isAdmin) await loadPending();
  }

  function setStats(files){
    const views=files.reduce((n,f)=>n+Number(f.view_count||0),0);
    const downloads=files.reduce((n,f)=>n+Number(f.download_count||0),0);
    if($('total-views')) setText('total-views',views.toLocaleString());
    if($('total-downloads')) setText('total-downloads',downloads.toLocaleString());
  }

  async function recordAutomaticView(file, label){
    if(!file?.id || viewed.has(file.id)) return;
    viewed.add(file.id);
    const {error}=await db.rpc('record_file_view',{file_id:file.id});
    if(error){viewed.delete(file.id);console.warn('Automatic view not recorded:',error.message);return;}
    file.view_count=Number(file.view_count||0)+1;
    if(label) label.textContent=`${file.file_name||'File'} · ${file.uploader||'Community member'} · ${file.country||'Zimbabwe'} · ${file.view_count} views`;
    setStats(approvedFiles);
  }

  async function fetchApproved(){
    let q=db.from('vpn_submissions').select('id,title,uploader,file_name,file_size,storage_path,file_path,country,view_count,download_count,created_at').eq('status','approved').order('created_at',{ascending:false});
    let result=await q;
    if(result.error && /country/i.test(result.error.message)){
      result=await db.from('vpn_submissions').select('id,title,uploader,file_name,file_size,storage_path,file_path,view_count,download_count,created_at').eq('status','approved').order('created_at',{ascending:false});
      if(!result.error) result.data=(result.data||[]).map(f=>({...f,country:'Zimbabwe'}));
    }
    return result;
  }

  function renderFiles(){
    const box=$('file-list'); if(!box) return;
    const files=selectedCountry==='All countries' ? approvedFiles : approvedFiles.filter(f=>(f.country||'Zimbabwe')===selectedCountry);
    box.innerHTML='';
    if(!files.length){box.innerHTML='<p class="muted">No approved files found for this country.</p>';return;}
    for(const file of files){
      const row=document.createElement('article'); row.className='file-row';
      const info=document.createElement('div');
      const title=document.createElement('b'); title.textContent=file.title||file.file_name||'VPN file';
      const detail=document.createElement('small'); detail.textContent=`${file.file_name||'File'} · ${file.uploader||'Community member'} · ${file.country||'Zimbabwe'} · ${Number(file.view_count||0)} views`;
      info.append(title,detail);
      const actions=document.createElement('div'); actions.className='file-actions';
      const download=document.createElement('button'); download.type='button'; download.className='outline'; download.textContent='Download'; download.addEventListener('click',()=>downloadFile(file));
      actions.append(download);
      if(isAdmin){const del=document.createElement('button');del.type='button';del.className='outline';del.textContent='Delete';del.addEventListener('click',()=>deleteFile(file));actions.append(del);}
      row.append(info,actions); box.append(row);
      // Count a view automatically when the approved card is rendered; no View button.
      void recordAutomaticView(file,detail);
    }
  }

  async function loadApprovedFiles(){
    const box=$('file-list'); if(box) box.innerHTML='<p class="muted">Loading approved files…</p>';
    const {data,error}=await fetchApproved();
    if(error){if(box) box.textContent='Could not load files: '+error.message;return;}
    approvedFiles=data||[];
    // Populate real country choices without removing the supplied All/Other options.
    const filter=$('country-filter');
    if(filter){
      const current=selectedCountry;
      const countries=[...new Set(approvedFiles.map(f=>f.country||'Zimbabwe').filter(Boolean))].sort();
      const opts=['All countries',...countries]; if(!opts.includes('Other')) opts.push('Other');
      filter.innerHTML=opts.map(x=>`<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`).join('');
      filter.value=opts.includes(current)?current:'All countries'; selectedCountry=filter.value;
    }
    setStats(approvedFiles); renderFiles();
  }

  async function downloadFile(file){
    if(!currentUser){openAccount('signin');return;}
    const path=file.storage_path||file.file_path;
    if(!path){alert('This file has no storage path. Contact the administrator.');return;}
    const {data,error}=await db.storage.from(FILE_BUCKET).createSignedUrl(path,120);
    if(error){alert('Download failed: '+error.message);return;}
    const counted=await db.rpc('record_file_download',{file_id:file.id});
    if(counted.error) console.warn('Download count was not recorded:',counted.error.message);
    file.download_count=Number(file.download_count||0)+1; setStats(approvedFiles);
    window.open(data.signedUrl,'_blank','noopener,noreferrer');
  }

  async function uploadFile(event){
    event.preventDefault(); if(!currentUser){status('upload-status','Please sign in first.');return;}
    const file=$('file')?.files?.[0]; if(!file){status('upload-status','Choose a file first.');return;}
    if(file.size>50*1024*1024){status('upload-status','File is larger than 50 MB.');return;}
    const title=$('title')?.value?.trim(); if(!title){status('upload-status','Enter a file title.');return;}
    const country=$('file-country')?.value || 'Zimbabwe';
    status('upload-status','Uploading your file…');
    const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const path=`${currentUser.id}/${crypto.randomUUID()}-${safeName}`;
    const uploaded=await db.storage.from(FILE_BUCKET).upload(path,file,{upsert:false});
    if(uploaded.error){status('upload-status','Upload failed: '+uploaded.error.message);return;}
    const row={title,uploader:$('uploader')?.value?.trim()||currentUser.email||'Community member',file_name:file.name,file_size:file.size,storage_path:path,user_id:currentUser.id,status:'pending',country};
    const {error}=await db.from('vpn_submissions').insert(row);
    if(error){await db.storage.from(FILE_BUCKET).remove([path]);status('upload-status','Could not save submission: '+error.message);return;}
    event.target.reset(); if($('file-country')) $('file-country').value='Zimbabwe';
    status('upload-status','Submitted successfully. Your file will appear after administrator approval.');
    if(isAdmin) await loadPending();
  }

  async function loadCommunity(){
    const box=$('community-messages'); if(!box) return;
    if(!currentUser){box.innerHTML='<p class="muted">Please sign in to view community messages.</p>';return;}
    const cutoff=new Date(Date.now()-24*60*60*1000).toISOString();
    const {data,error}=await db.from('community_posts').select('id,user_id,message,created_at').gte('created_at',cutoff).order('created_at',{ascending:false}).limit(100);
    if(error){box.textContent='Could not load messages: '+error.message;return;}
    box.innerHTML='';
    if(!data?.length){box.innerHTML='<p class="muted">No recent messages. Start the conversation.</p>';return;}
    for(const post of data){
      const row=document.createElement('article');row.className='file-row';
      const body=document.createElement('div'); const msg=document.createElement('b');msg.style.whiteSpace='pre-wrap';msg.textContent=post.message;
      const meta=document.createElement('small');meta.textContent=new Date(post.created_at).toLocaleString();body.append(msg,meta);row.append(body);box.append(row);
    }
  }

  async function sendCommunity(event){
    event.preventDefault();if(!currentUser){status('community-status','Please sign in first.');return;}
    const input=$('community-message');const message=input?.value?.trim();if(!message)return;
    status('community-status','Sending…');
    const {error}=await db.from('community_posts').insert({user_id:currentUser.id,message});
    if(error){status('community-status',error.message);return;}
    input.value='';status('community-status','Message sent.');await loadCommunity();
  }

  async function loadProfile(){
    if(!currentUser)return;
    const {data,error}=await db.from('profiles').select('display_name,about,avatar_url').eq('id',currentUser.id).maybeSingle();
    if(error){status('profile-status',error.message);return;}
    if(data){if($('profile-name')) $('profile-name').value=data.display_name||'';if($('profile-about')) $('profile-about').value=data.about||'';
      if($('profile-preview-name')) $('profile-preview-name').textContent=data.display_name||currentUser.email||'Profile';
      if(data.avatar_url && $('profile-preview')) $('profile-preview').src=data.avatar_url;
      if($('profile-preview-wrap')) show('profile-preview-wrap',!!data.avatar_url);
    }
  }

  async function saveProfile(event){
    event.preventDefault();if(!currentUser){status('profile-status','Please sign in first.');return;}
    status('profile-status','Saving profile…');let avatar_url;
    const avatar=$('profile-avatar')?.files?.[0];
    if(avatar){if(!avatar.type.startsWith('image/')){status('profile-status','Choose an image file.');return;}
      const path=`${currentUser.id}/${crypto.randomUUID()}-${avatar.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      const up=await db.storage.from(AVATAR_BUCKET).upload(path,avatar,{upsert:true});if(up.error){status('profile-status',up.error.message);return;}
      avatar_url=db.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
    }
    const payload={id:currentUser.id,display_name:$('profile-name')?.value?.trim()||'',about:$('profile-about')?.value?.trim()||'',updated_at:new Date().toISOString()};
    if(avatar_url)payload.avatar_url=avatar_url;
    const {error}=await db.from('profiles').upsert(payload,{onConflict:'id'});
    if(error){status('profile-status',error.message);return;}
    status('profile-status','Profile saved successfully.');await loadProfile();
  }

  async function loadPending(){
    const box=$('pending-list');if(!box||!isAdmin)return;
    status('admin-status','Loading submissions…');
    const {data,error}=await db.from('vpn_submissions').select('id,title,uploader,file_name,file_size,storage_path,file_path,country,status,created_at').in('status',['pending','approved','rejected']).order('created_at',{ascending:false}).limit(150);
    if(error){box.textContent='Could not load submissions: '+error.message;status('admin-status',error.message);return;}
    box.innerHTML='';
    if(!data?.length){box.innerHTML='<p class="muted">No submissions yet.</p>';status('admin-status','Admin access confirmed.');return;}
    for(const item of data){
      const row=document.createElement('article');row.className='file-row';const info=document.createElement('div');
      const title=document.createElement('b');title.textContent=item.title||item.file_name||'Untitled file';
      const detail=document.createElement('small');detail.textContent=`${item.file_name||'File'} · ${item.uploader||'Member'} · ${item.country||'Zimbabwe'} · ${item.status}`;info.append(title,detail);
      const actions=document.createElement('div');actions.className='file-actions';
      if(item.status==='pending'){
        for(const [label,next] of [['Approve','approved'],['Reject','rejected']]){const b=document.createElement('button');b.type='button';b.className='outline';b.textContent=label;b.addEventListener('click',()=>changeStatus(item,next));actions.append(b);}
      }
      const del=document.createElement('button');del.type='button';del.className='outline';del.textContent='Delete';del.addEventListener('click',()=>deleteFile(item));actions.append(del);
      row.append(info,actions);box.append(row);
    }
    status('admin-status','Admin access confirmed.');
  }

  async function changeStatus(item,next){
    if(!isAdmin)return;
    const {error}=await db.from('vpn_submissions').update({status:next}).eq('id',item.id);
    if(error){alert('Could not update submission: '+error.message);return;}
    await loadPending();await loadApprovedFiles();
  }

  async function deleteFile(item){
    if(!isAdmin){alert('Only the administrator can delete files.');return;}
    if(!confirm(`Delete “${item.title||item.file_name||'this file'}” permanently?`))return;
    const path=item.storage_path||item.file_path;
    if(path){const removed=await db.storage.from(FILE_BUCKET).remove([path]);if(removed.error){alert('Storage deletion failed: '+removed.error.message);return;}}
    const {error}=await db.from('vpn_submissions').delete().eq('id',item.id);
    if(error){alert('Could not delete database record: '+error.message);return;}
    await loadPending();await loadApprovedFiles();
  }

  function openAccount(mode='signin'){
    const modal=$('accountModal');if(!modal){status('upload-status','Please use the sign-in page.');return;}
    modal.classList.add('show');
    show('accountSignin',mode!=='signup');show('accountSignup',mode==='signup');
    if($('tabSignin'))$('tabSignin').className=mode==='signup'?'secondary':'primary';
    if($('tabSignup'))$('tabSignup').className=mode==='signup'?'primary':'secondary';
    status('accountStatus','Sign in to download files and use community features.');
  }

  function bindEvents(){
    if($('upload-form'))$('upload-form').addEventListener('submit',uploadFile);
    if($('community-form'))$('community-form').addEventListener('submit',sendCommunity);
    if($('profile-form'))$('profile-form').addEventListener('submit',saveProfile);
    if($('refresh'))$('refresh').addEventListener('click',loadApprovedFiles);
    if($('user-logout'))$('user-logout').addEventListener('click',async()=>{await db.auth.signOut();});
    // Older page variants may still use the legacy admin login form.
    if($('login-form'))$('login-form').addEventListener('submit',async e=>{e.preventDefault();status('admin-status','Signing in…');const {error}=await db.auth.signInWithPassword({email:$('admin-email')?.value,password:$('admin-password')?.value});if(error)status('admin-status',error.message);});
    if($('logout'))$('logout').addEventListener('click',async()=>{await db.auth.signOut();});
    // The supplied index.html already handles accountSignin/accountSignup inline; do not bind them twice.
    if($('openSignin'))$('openSignin').addEventListener('click',()=>openAccount(currentUser?'signin':'signin'));
    if($('heroSignup'))$('heroSignup').addEventListener('click',()=>openAccount('signup'));
    if($('closeAccount'))$('closeAccount').addEventListener('click',()=>{$('accountModal')?.classList.remove('show');});
    if($('tabSignin'))$('tabSignin').addEventListener('click',()=>openAccount('signin'));
    if($('tabSignup'))$('tabSignup').addEventListener('click',()=>openAccount('signup'));
    if($('searchForm'))$('searchForm').addEventListener('submit',e=>{e.preventDefault();const q=$('hubSearch')?.value?.trim().toLowerCase()||'';let visible=0;document.querySelectorAll('#file-list .file-row').forEach(row=>{const yes=!q||row.textContent.toLowerCase().includes(q);row.classList.toggle('hidden',!yes);if(yes)visible++;});show('search-empty',visible===0);$('files')?.scrollIntoView({behavior:'smooth'});});
    if($('year'))setText('year',new Date().getFullYear());
  }

  async function start(){
    if(!initClient())return;
    ensureCountryControls();bindEvents();
    await refreshSession();
    await loadApprovedFiles();
    db.auth.onAuthStateChange((_event,session)=>{
      currentUser=session?.user||null;isAdmin=currentUser?.app_metadata?.role==='admin';
      updateAuthUI();
      if(currentUser){loadCommunity();loadProfile();if(isAdmin)loadPending();}
      else {const box=$('community-messages');if(box)box.innerHTML='<p class="muted">Please sign in to view community messages.</p>';if($('pending-list'))$('pending-list').innerHTML='';}
      loadApprovedFiles();
    });
    // Realtime refresh keeps the chat current while SQL cleanup removes messages after 24 hours.
    if(currentUser && db.channel){db.channel('naru-community-live').on('postgres_changes',{event:'*',schema:'public',table:'community_posts'},()=>loadCommunity()).subscribe();}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
