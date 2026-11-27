(() => {
"use strict";
const $=id=>document.getElementById(id),video=$("player");
const STORE="ashika.live.tv.v4",LEGACY_STORE="ashika.live.tv.v3",RECENT_STORE="ashika.live.tv.recent.v1";
let nativeFallbackTimer=null,customChannels=[],playlists=[],channels=[],activePlaylistId=null,activeGroup="All",activeChannel=null,filter="all",visibleLimit=120,hls=null,dash=null,epg=[],epgByChannel=Object.create(null),recent=[],favourites=[],favouriteSet=new Set(),searchTimer=null,hlsMediaRecovered=false,epgLoadedAt=0,settings={refresh:0,epgUrl:"",autoplayNext:false,autoRetry:true,maxRetries:3,parentalPin:"",protectedGroup:""},refreshTimer=null,retryTimer=null,retryCount=0,sleepTimer=null;
const sample="#EXTM3U\n#EXTINF:-1 tvg-id=\"sample-news\" group-title=\"News\",Sample News\nhttps://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8\n#EXTINF:-1 tvg-id=\"sample-ent\" group-title=\"Entertainment\",Sample Entertainment\nhttps://test-streams.mux.dev/test_001/stream.m3u8";
function id(){return "p"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function parseM3U(raw){const lines=raw.replace(/^\uFEFF/,"").split(/\r?\n/),out=[];let meta=null;for(const line0 of lines){const line=line0.trim();if(!line)continue;if(line.startsWith("#EXTINF")){const comma=line.indexOf(","),attrs=comma>=0?line.slice(0,comma):line,title=comma>=0?line.slice(comma+1).trim():"Untitled channel";const attr=k=>{const m=attrs.match(new RegExp(k+'="([^"]*)"' ,"i"));return m?m[1]:"";};meta={title:title||"Untitled channel",group:attr("group-title")||"Other",logo:attr("tvg-logo"),tvgId:attr("tvg-id"),tvgName:attr("tvg-name")};}else if(!line.startsWith("#")&&meta){out.push({title:meta.title,searchTitle:meta.title.toLowerCase(),group:meta.group,logo:meta.logo,tvgId:meta.tvgId,tvgName:meta.tvgName,url:line});meta=null;}}return out;}
function appendCustomChannels(){
 customChannels.forEach(function(c){
  if(!c||!c.url||channels.some(function(x){return x.url===c.url;}))return;
  channels.push({title:c.title||"Custom Channel",searchTitle:String(c.title||"Custom Channel").toLowerCase(),group:c.group||"Custom",logo:c.logo||"",tvgId:c.tvgId||"",url:c.url,source:"manual"});
 });
}
function saveCustomChannels(){
 try{localStorage.setItem("ashika.tv.custom.channels.v1",JSON.stringify(customChannels));}catch(e){}
}
function save(){try{localStorage.setItem(STORE,JSON.stringify({playlists,activePlaylistId,settings,favourites:getFavourites(),recent:recent}));}catch(e){$("playback-status").textContent="Storage is full. Remove an unused playlist.";}}
function getFavourites(){return favourites;}
function remember(c){const k=favKey(c);recent=[k].concat(recent.filter(x=>x!==k)).slice(0,30);try{localStorage.setItem(RECENT_STORE,JSON.stringify(recent));}catch(e){}window.dispatchEvent(new Event("ashika-library-changed"));}
function favKey(c){return (c.tvgId||"")+"|"+c.url;}
function isFav(c){return favouriteSet.has(favKey(c));}
function toggleFav(c){const k=favKey(c);if(favouriteSet.has(k)){favouriteSet.delete(k);favourites=favourites.filter(x=>x!==k);}else{favouriteSet.add(k);favourites.push(k);}save();render();window.dispatchEvent(new Event("ashika-library-changed"));}
function stopEngines(){if(nativeFallbackTimer){clearTimeout(nativeFallbackTimer);nativeFallbackTimer=null;}if(retryTimer){clearTimeout(retryTimer);retryTimer=null;}if(hls){try{hls.destroy();}catch(e){}hls=null;}if(dash){try{dash.reset();}catch(e){}dash=null;}try{video.pause();}catch(e){}video.removeAttribute("src");try{video.load();}catch(e){}}
function setStatus(s){$("playback-status").textContent=s||"";}
function scheduleRecovery(index,reason){if(!settings.autoRetry||index===null||index<0||retryCount>=Math.max(0,Number(settings.maxRetries)||0)){setStatus(reason||"Playback failed. Retry manually or choose another channel.");return;}const attempt=++retryCount;setStatus("Connection lost. Reconnecting ("+attempt+"/"+settings.maxRetries+")…");if(retryTimer)clearTimeout(retryTimer);retryTimer=setTimeout(()=>{retryTimer=null;play(index,true);},Math.min(12000,1500*Math.pow(2,attempt-1)));}
function current(){return channels[activeChannel]||null;}
function changeChannel(step){if(!channels.length)return;const next=activeChannel===null?(step>0?0:channels.length-1):(activeChannel+step+channels.length)%channels.length;play(next);}
function setSleepTimer(minutes){if(sleepTimer){clearTimeout(sleepTimer);sleepTimer=null;}const m=Number(minutes)||0;if(!m){setStatus("Sleep timer is off.");return;}setStatus("Sleep timer set for "+m+" minutes.");sleepTimer=setTimeout(()=>{sleepTimer=null;activeChannel=null;stopEngines();$("sleep-timer").value="0";video.muted=false;$("mute-btn").textContent="🔊 Mute";$("current-title").textContent="Sleep timer ended";$("current-group").textContent="Playback stopped automatically";$("player-placeholder").classList.remove("hidden");setStatus("Sleep timer ended.");render();},m*60000);}
function toggleFullscreen(){try{if(document.fullscreenElement){document.exitFullscreen();}else if($("player-wrap").requestFullscreen){$("player-wrap").requestFullscreen();}else if(video.webkitEnterFullscreen){video.webkitEnterFullscreen();}else setStatus("Fullscreen is not supported by this TV browser.");}catch(e){setStatus("Could not enter fullscreen.");}}
function play(index,isRetry,preserveGroup){const c=channels[index];if(!c)return;if(settings.parentalPin&&settings.protectedGroup&&c.group===settings.protectedGroup&&!isRetry){const entered=window.prompt("Parental PIN required to watch "+c.title);if(entered!==settings.parentalPin){setStatus("Parental PIN incorrect. Playback blocked.");return;}}if(!isRetry)retryCount=0;activeChannel=index;if(!preserveGroup)activeGroup="All";remember(c);stopEngines();resetTrackControls();setStatus("Connecting to "+c.title+"…");const url=c.url.split("?")[0].toLowerCase();if(/\.mpd$/.test(url)&&window.dashjs){dash=dashjs.MediaPlayer().create();dash.updateSettings({streaming:{buffer:{stableBufferTime:12,bufferTimeAtTopQuality:18},abr:{autoSwitchBitrate:{video:true}}}});dash.initialize(video,c.url,true);dash.on(dashjs.MediaPlayer.events.ERROR,(_,data)=>{const detail=data&&data.error?data.error.message:"DASH stream error";scheduleRecovery(index,"DASH playback error: "+detail);});}else if(/\.m3u8?$/.test(url)&&(/web0s|webos/i.test(navigator.userAgent)||video.canPlayType("application/vnd.apple.mpegurl")!=="") ){video.preload="auto";video.src=c.url;try{video.load();}catch(e){}const nativePlay=video.play();if(nativePlay&&nativePlay.then)nativePlay.then(()=>setStatus("")).catch(()=>setStatus("TV could not start this stream. Trying another playback method…"));nativeFallbackTimer=setTimeout(()=>{nativeFallbackTimer=null;if(activeChannel!==index||video.videoWidth>0)return;if(video.readyState>=2){setStatus("Audio is available, but the stream has no compatible video frames. Try an H.264 video stream.");return;}if(!window.Hls||!Hls.isSupported())return;setStatus("Native video did not start. Trying HLS compatibility mode…");try{video.pause();video.removeAttribute("src");hlsMediaRecovered=false;hls=new Hls({enableWorker:false,lowLatencyMode:false,backBufferLength:8,maxBufferLength:18,maxMaxBufferLength:30,capLevelToPlayerSize:true,manifestLoadingTimeOut:25000,levelLoadingTimeOut:25000});hls.on(Hls.Events.MANIFEST_PARSED,()=>{populateTrackControls();video.play().then(()=>setStatus("")).catch(()=>setStatus("Press Play to start playback."));});hls.on(Hls.Events.ERROR,(_,d)=>{if(d.fatal)scheduleRecovery(index,"HLS compatibility playback failed: "+(d.details||"unsupported stream"));});hls.loadSource(c.url);hls.attachMedia(video);}catch(err){setStatus("TV cannot decode this stream format. Try a channel with H.264 video.");}},12000);}else if(/\.m3u8?$/.test(url)&&window.Hls&&Hls.isSupported()){hlsMediaRecovered=false;hls=new Hls({enableWorker:true,lowLatencyMode:false,backBufferLength:8,maxBufferLength:16,maxMaxBufferLength:24,capLevelToPlayerSize:true,manifestLoadingTimeOut:20000,levelLoadingTimeOut:20000});hls.on(Hls.Events.MANIFEST_PARSED,()=>populateTrackControls());hls.on(Hls.Events.LEVELS_UPDATED,()=>populateTrackControls());hls.on(Hls.Events.AUDIO_TRACKS_UPDATED,()=>populateTrackControls());hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED,()=>populateTrackControls());hls.on(Hls.Events.ERROR,(_,d)=>{if(!d.fatal)return;if(d.type===Hls.ErrorTypes.MEDIA_ERROR&&!hlsMediaRecovered){hlsMediaRecovered=true;setStatus("Recovering video decoder…");try{hls.recoverMediaError();return;}catch(e){}}if(d.type===Hls.ErrorTypes.NETWORK_ERROR){try{hls.startLoad();}catch(e){}}if(settings.autoplayNext&&channels.length>1){retryCount=0;play((index+1)%channels.length);}else scheduleRecovery(index,"HLS stream error: "+(d.details||"unavailable"));});hls.on(Hls.Events.MANIFEST_PARSED,()=>{setStatus("");video.play().catch(()=>setStatus("Press Play to start playback."));});hls.loadSource(c.url);hls.attachMedia(video);}else{video.src=c.url;const nativePlay=video.play();if(nativePlay&&nativePlay.then)nativePlay.then(()=>setStatus("")).catch(()=>setStatus("Playback unavailable. Press Play or check the stream URL."));} $("player-placeholder").classList.add("hidden");$("current-title").textContent=c.title;$("current-group").textContent=(c.group||"Other")+" · "+((activePlaylist()?activePlaylist().name:"")||"Playlist");updateProgram();render();}
function activePlaylist(){return playlists.find(p=>p.id===activePlaylistId)||null;}
function render(){
 const list=$("channel-list"),savedScrollTop=list?list.scrollTop:0;
 const focusedIndex=document.activeElement&&document.activeElement.classList&&document.activeElement.classList.contains("channel")?document.activeElement.getAttribute("data-index"):null;
 const q=$("search").value.toLowerCase();
 const groups=["All"],seenGroups=Object.create(null);
 for(let i=0;i<channels.length;i++){const g=channels[i].group||"Other";if(!seenGroups[g]){seenGroups[g]=true;groups.push(g);}}
 $("groups").innerHTML=groups.map(g=>'<button class="group-chip '+(g===activeGroup?"active":"")+'" data-group="'+esc(g)+'">'+esc(g)+'</button>').join("");
 const visible=[];
 for(let i=0;i<channels.length;i++){const c=channels[i],key=favKey(c);if(activeGroup!=="All"&&(c.group||"Other")!==activeGroup)continue;if(filter==="fav"&&!favouriteSet.has(key))continue;if(filter==="recent"&&recent.indexOf(key)===-1)continue;if(q&&(c.searchTitle||c.title.toLowerCase()).indexOf(q)===-1)continue;visible.push(i);}
 const sort=$("sort-select").value;
 if(sort==="az")visible.sort((a,b)=>channels[a].title.localeCompare(channels[b].title));
 if(sort==="za")visible.sort((a,b)=>channels[b].title.localeCompare(channels[a].title));
 if(filter==="recent")visible.sort((a,b)=>recent.indexOf(favKey(channels[a]))-recent.indexOf(favKey(channels[b])));
 const shown=visible.slice(0,visibleLimit);
 list.innerHTML=visible.length?shown.map(i=>{const c=channels[i];return '<button class="channel '+(activeChannel===i?"active":"")+'" data-index="'+i+'">'+(c.logo?'<img class="channel-logo" loading="lazy" decoding="async" referrerpolicy="no-referrer" src="'+esc(c.logo)+'" onerror="this.style.display=\'none\'">':'<span class="channel-logo">'+esc((c.title[0]||"T").toUpperCase())+'</span>')+'<span class="channel-info"><strong>'+esc(c.title)+'</strong><small>'+esc(c.group||"Other")+'</small></span><span class="fav">'+(favouriteSet.has(favKey(c))?"★":"☆")+'</span></button>';}).join("")+(visible.length>visibleLimit?'<button id="load-more-channels" class="load-more">Show more channels ('+(visible.length-visibleLimit)+' remaining)</button>':''):'<div class="empty">'+(filter==="fav"?"No favourite channels yet.":"No matching channels found.")+'</div>';
 list.scrollTop=savedScrollTop;
 if(focusedIndex!==null){const restore=list.querySelector('.channel[data-index="'+focusedIndex+'"]');if(restore)restore.focus();list.scrollTop=savedScrollTop;}
 $("channel-count").textContent=channels.length+" CHANNELS";
 $("list-subtitle").textContent=channels.length?channels.length+" channels loaded":"Your playlist";
 $("footer-playlist").textContent=(activePlaylist()?activePlaylist().name:"")||"No playlist selected";
 $("fav-current").textContent=current()&&favouriteSet.has(favKey(current()))?"★ Favourited":"☆ Favourite";
}
function loadPlaylist(p){activePlaylistId=p.id;channels=parseM3U(p.content||"");appendCustomChannels();activeChannel=null;activeGroup="All";filter="all";visibleLimit=120;$("search").value="";save();render();$("current-title").textContent="No channel selected";$("current-group").textContent="Choose a channel from the list";$("player-placeholder").classList.remove("hidden");}
async function refreshOne(p,silent){if(!p.url)return false;try{const r=await fetch(p.url,{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);const content=await r.text(),parsed=parseM3U(content);if(!parsed.length)throw Error("Invalid playlist");p.content=content;p.updated=Date.now();if(p.id===activePlaylistId){channels=parsed;appendCustomChannels();visibleLimit=120;render();}return true;}catch(e){if(!silent)setStatus("Playlist refresh failed: "+e.message);return false;}}
async function refreshAll(silent){let ok=0;for(const p of playlists)if(p.url&&await refreshOne(p,true))ok++;if(!silent)setStatus(ok?"Updated "+ok+" playlist(s).":"No online playlists could be refreshed.");save();}
function scheduleRefresh(){if(refreshTimer)clearInterval(refreshTimer);refreshTimer=null;if(settings.refresh>0)refreshTimer=setInterval(()=>refreshAll(true),settings.refresh*60000);}
const SERVER_LOOKUP_ENDPOINT="https://dokoplay.xyz/server_lookup.php";
function extractLookupStreams(data){
 const output=[],seen=new Set();
 const playableKey=/^(url|stream|stream_url|play_url|video_url|source|source_url|file|hls|m3u8|playlist|manifest)$/i;
 function visit(value,parent){
  if(!value)return;
  if(Array.isArray(value)){value.forEach(v=>visit(v,parent));return;}
  if(typeof value!=="object")return;
  const title=value.name||value.channel_name||value.title||value.channel||value.tvg_name||parent.title||"Premium channel";
  const group=value.group||value.category||value.group_title||parent.group||"Premium";
  Object.keys(value).forEach(key=>{
   const v=value[key];
   if(typeof v==="string"&&/^https?:\/\//i.test(v)){
    if(playableKey.test(key)||/\.(m3u8?|mpd|mp4)(?:[?#]|$)/i.test(v)){
     if(!seen.has(v)){seen.add(v);output.push({title:String(title),group:String(group),url:v});}
    }
   }else if(v&&typeof v==="object")visit(v,{title:String(title),group:String(group)});
  });
 }
 visit(data,{title:"Premium channel",group:"Premium"});
 return output;
}
async function lookupServerChannels(){
 const idValue=$("server-channel-id").value.trim();
 const status=$("server-lookup-status");
 if(!idValue){status.textContent="Enter a channel ID first.";return;}
 const endpoint=SERVER_LOOKUP_ENDPOINT+"?channel_id="+encodeURIComponent(idValue);
 status.textContent="Contacting DokoPlay server…";
 try{
  const response=await fetch(endpoint,{method:"GET",cache:"no-store",credentials:"omit"});
  if(!response.ok)throw Error("Server returned HTTP "+response.status);
  const body=await response.text();
  let streams=[];
  if(/^\s*#EXTM3U/m.test(body))streams=parseM3U(body).map(c=>({title:c.title,group:c.group,url:c.url}));
  else{
   let payload;
   try{payload=JSON.parse(body);}catch(e){
    const direct=body.trim();
    if(/^https?:\/\//i.test(direct))streams=[{title:"Premium channel",group:"Premium",url:direct}];
    else throw Error("Response is not valid JSON or M3U");
   }
   if(!streams.length)streams=extractLookupStreams(payload);
  }
  if(!streams.length)throw Error("Server responded but did not provide playable stream URLs");
  const lines=["#EXTM3U"];
  streams.forEach((c,i)=>{
   const title=String(c.title||("Premium channel "+(i+1))).replace(/[\r\n,]/g," ").trim();
   const group=String(c.group||"Premium").replace(/[\r\n"]/g," ").trim();
   lines.push('#EXTINF:-1 group-title="'+group+'",'+title);
   lines.push(c.url);
  });
  const content=lines.join("\n");
  const playlist={id:id(),name:"DokoPlay lookup · "+idValue,url:"",content,updated:Date.now()};
  const duplicate=playlists.find(p=>p.name===playlist.name);
  if(duplicate){duplicate.content=content;duplicate.updated=playlist.updated;loadPlaylist(duplicate);}
  else{playlists.push(playlist);save();loadPlaylist(playlist);}
  save();status.textContent="Imported "+streams.length+" real stream URL(s) returned by the server.";
  setStatus("DokoPlay lookup imported "+streams.length+" channel(s).");
 }catch(error){
  status.textContent="Lookup failed: "+(error&&error.message?error.message:String(error))+". No channel links were invented; the endpoint may be offline or block browser CORS.";
 }
}

async function timedFetch(url,ms){
 const controller=window.AbortController?new AbortController():null;
 let timer=null;
 try{
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{if(controller)controller.abort();reject(new Error("Timed out after "+Math.round(ms/1000)+"s"));},ms);});
  const request=fetch(url,{method:"GET",cache:"no-store",credentials:"omit",signal:controller?controller.signal:undefined});
  return await Promise.race([request,timeout]);
 }finally{if(timer)clearTimeout(timer);}
}
async function testEndpoint(label,url){
 const started=Date.now();
 try{
  const response=await timedFetch(url,9000);
  return {label:label,ok:response.ok,status:"HTTP "+response.status+" · "+(Date.now()-started)+" ms",detail:response.ok?"Server returned an HTTP response.":"Server is reachable but returned an HTTP error."};
 }catch(error){
  const msg=error&&error.name==="AbortError"?"Request timed out":(error&&error.message?error.message:String(error));
  const cors=/failed to fetch|networkerror|load failed/i.test(msg);
  return {label:label,ok:false,status:cors?"Network/CORS blocked":msg,detail:cors?"Browser could not read the response; this does not prove the host is offline.":"No response received from this browser."};
 }
}
async function probePlayable(url){
 return new Promise(resolve=>{
  const probe=document.createElement("video");
  let finished=false,timer=null;
  const done=(ok,detail)=>{if(finished)return;finished=true;if(timer)clearTimeout(timer);probe.oncanplay=null;probe.onloadedmetadata=null;probe.onerror=null;try{probe.pause();probe.removeAttribute("src");probe.load();}catch(e){}resolve({ok,detail});};
  probe.muted=true;probe.playsInline=true;probe.setAttribute("playsinline","");probe.preload="auto";
  probe.oncanplay=()=>done(true,"Media can play");
  probe.onloadedmetadata=()=>{if(probe.videoWidth>0||probe.duration>0)done(true,"Metadata loaded");};
  probe.onerror=()=>done(false,"Media error "+(probe.error?probe.error.code:"unknown"));
  timer=setTimeout(()=>done(false,"Timed out / unsupported format"),12000);
  try{probe.src=url;probe.load();const p=probe.play();if(p&&p.catch)p.catch(()=>{});}catch(e){done(false,e.message||"Could not load stream");}
 });
}
async function testAshikaServers(){
 const output=$("server-test-output"),button=$("server-test-btn");
 button.disabled=true;output.textContent="Testing server endpoints…";
 const results=[];
 const roots=[
  ["DokoPlay","https://dokoplay.xyz/"],
  ["NewEmbedPlay","https://newembedplay.xyz/"],
  ["RTS TV","https://rtstv.xyz/"]
 ];
 for(const item of roots)results.push(await testEndpoint(item[0],item[1]));
 output.textContent=results.map(x=>(x.ok?"✓ ":"✕ ")+x.label+": "+x.status+" — "+x.detail).join("\n")+"\n\nTesting DokoPlay lookup API…";
 let apiStreams=[];
 try{
  const response=await timedFetch(SERVER_LOOKUP_ENDPOINT+"?channel_id="+encodeURIComponent(($("server-channel-id").value.trim()||"premium")),12000);
  const body=await response.text();
  if(!response.ok)throw Error("HTTP "+response.status);
  if(/^\s*#EXTM3U/m.test(body))apiStreams=parseM3U(body);
  else{
   let data;
   try{data=JSON.parse(body);}catch(e){if(/^https?:\/\//i.test(body.trim()))apiStreams=[{title:"Premium channel",url:body.trim()}];else throw Error("Response is not JSON or M3U");}
   if(!apiStreams.length)apiStreams=extractLookupStreams(data);
  }
  results.push({label:"DokoPlay lookup API",ok:apiStreams.length>0,status:"HTTP "+response.status+" · "+apiStreams.length+" stream URL(s)",detail:apiStreams.length?"Real stream URLs were returned.":"API responded but no stream URLs were found."});
 }catch(error){
  const msg=error&&error.message?error.message:String(error);
  results.push({label:"DokoPlay lookup API",ok:false,status:/failed to fetch|networkerror|load failed/i.test(msg)?"Network/CORS blocked":msg,detail:"No playlist imported during this test."});
 }
 output.textContent=results.map(x=>(x.ok?"✓ ":"✕ ")+x.label+": "+x.status+" — "+x.detail).join("\n");
 if(apiStreams.length){
  output.textContent+="\n\nTesting up to 5 returned streams…";
  const checks=[];
  for(const c of apiStreams.slice(0,5)){
   const r=await probePlayable(c.url);
   checks.push((r.ok?"✓ ":"✕ ")+(c.title||"Channel")+": "+r.detail);
  }
  output.textContent+="\n"+checks.join("\n");
 }else if(channels.length){
  output.textContent+="\n\nNo lookup streams returned. Testing up to 5 channels in the current playlist…";
  const checks=[];
  for(const c of channels.slice(0,5)){
   const r=await probePlayable(c.url);
   checks.push((r.ok?"✓ ":"✕ ")+c.title+": "+r.detail);
  }
  output.textContent+="\n"+checks.join("\n");
 }else{
  output.textContent+="\n\nNo stream URLs available to test. Add a playlist or get valid URLs from the lookup API.";
 }
 output.textContent+="\n\nNote: browser CORS restrictions can block endpoint checks even when a media URL may still play.";
 button.disabled=false;
}

async function addPlaylist(){const file=$("playlist-file").files[0],url=$("playlist-url").value.trim(),name=$("playlist-name").value.trim();$("playlist-error").textContent="";try{let content;if(file)content=await readFileText(file);else if(url){const r=await fetch(url);if(!r.ok)throw Error("HTTP "+r.status);content=await r.text();}else throw Error("Enter a playlist URL or choose a file.");const parsed=parseM3U(content);if(!parsed.length)throw Error("No channels found. Please check the M3U file.");const p={id:id(),name:name||(file?file.name:"")||"Playlist "+(playlists.length+1),url:url||"",content,updated:Date.now()};playlists.push(p);save();loadPlaylist(p);$("playlist-dialog").close();$("playlist-name").value="";$("playlist-url").value="";$("playlist-file").value="";}catch(e){$("playlist-error").textContent=e.message||"Could not load playlist. Check CORS access.";}}
function savePlaylistLibrary(){try{localStorage.setItem(STORE,JSON.stringify({playlists,activePlaylistId,settings,favourites:getFavourites(),recent}));$("playlist-save-status").textContent="✓ All playlists saved on this TV.";return true;}catch(e){$("playlist-save-status").textContent="Save failed: TV storage may be full.";return false;}}
function manager(){const root=$("playlist-manager");root.innerHTML=playlists.length?playlists.map(p=>'<div class="playlist-entry"><div class="entry-name"><strong>'+esc(p.name)+(p.id===activePlaylistId?" · ACTIVE":"")+'</strong><small>'+esc(p.url||"Imported file")+' · '+parseM3U(p.content).length+' channels</small></div><button class="mini-btn" data-use="'+p.id+'">Open</button><button class="mini-btn" data-rename="'+p.id+'">Rename</button><button class="mini-btn" data-refresh="'+p.id+'">↻</button><button class="mini-btn danger" data-delete="'+p.id+'">Remove</button></div>').join(""):'<div class="empty">No saved playlists. Add one to get started.</div>';$("playlist-save-status").textContent=playlists.length?playlists.length+" playlist(s) in your library.":"Your playlist library is empty.";root.querySelectorAll("[data-use]").forEach(b=>b.onclick=()=>{const p=playlists.find(x=>x.id===b.dataset.use);if(p){loadPlaylist(p);$("manage-dialog").close();}});root.querySelectorAll("[data-rename]").forEach(b=>b.onclick=()=>{const p=playlists.find(x=>x.id===b.dataset.rename);if(!p)return;const name=window.prompt("Enter a new playlist name:",p.name);if(name&&name.trim()){p.name=name.trim();save();manager();render();}});root.querySelectorAll("[data-refresh]").forEach(b=>b.onclick=async()=>{const p=playlists.find(x=>x.id===b.dataset.refresh);if(p){const ok=await refreshOne(p,false);if(ok){save();manager();}}});root.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>{const p=playlists.find(x=>x.id===b.dataset.delete);if(!p||!window.confirm('Remove "'+p.name+'" from this TV?'))return;playlists=playlists.filter(x=>x.id!==b.dataset.delete);if(activePlaylistId===b.dataset.delete){stopEngines();activePlaylistId=null;channels=[];activeChannel=null;$("current-title").textContent="No channel selected";$("current-group").textContent="Choose a channel from the list";$("player-placeholder").classList.remove("hidden");}save();manager();render();});}
function parseXmltv(xml){const doc=new DOMParser().parseFromString(xml,"application/xml");if(doc.querySelector("parsererror"))throw Error("Invalid XMLTV file");return Array.from(doc.querySelectorAll("programme")).map(n=>({channel:n.getAttribute("channel"),start:n.getAttribute("start"),stop:n.getAttribute("stop"),title:(n.querySelector("title")?n.querySelector("title").textContent:"")||"Untitled",desc:(n.querySelector("desc")?n.querySelector("desc").textContent:"")||""}));}
function xmlDate(s){if(!s)return null;const m=s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/);if(!m)return null;const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0)));if(m[7]){const off=(+m[7].slice(1,3)*60+ +m[7].slice(3))*(m[7][0]==="+"?1:-1);d.setUTCMinutes(d.getUTCMinutes()-off);}return d;}
function indexEPG(list){const by=Object.create(null);for(let i=0;i<list.length;i++){const p=list[i],start=xmlDate(p.start),stop=xmlDate(p.stop);if(!Number.isFinite(p._start))p._start=start?start.getTime():0;if(!Number.isFinite(p._stop))p._stop=stop?stop.getTime():0;if(!p.channel)continue;(by[p.channel]||(by[p.channel]=[])).push(p);}Object.keys(by).forEach(k=>by[k].sort((a,b)=>a._start-b._start));epgByChannel=by;}
async function loadEPG(){if(!settings.epgUrl){$("guide-list").innerHTML='<div class="empty">Set an XMLTV URL in Settings to load programme listings.</div>';return;}$("guide-list").innerHTML='<div class="empty">Loading TV Guide…</div>';try{const r=await fetch(settings.epgUrl,{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);const parsed=parseXmltv(await r.text());if(!parsed.length)throw Error("No programme entries found");epg=parsed;indexEPG(epg);epgLoadedAt=Date.now();try{localStorage.setItem("ashika.live.tv.epg.cache",JSON.stringify({url:settings.epgUrl,loadedAt:epgLoadedAt,programmes:epg}));}catch(e){}renderGuide();updateProgram();}catch(e){if(!epg.length){try{const cached=JSON.parse(localStorage.getItem("ashika.live.tv.epg.cache")||"null");if(cached&&cached.url===settings.epgUrl&&Array.isArray(cached.programmes)){epg=cached.programmes;indexEPG(epg);epgLoadedAt=Number(cached.loadedAt)||0;}}catch(ignore){}}if(epg.length){renderGuide();updateProgram();$("guide-date").textContent+=" · cached";$("guide-list").insertAdjacentHTML("afterbegin",'<div class="empty">Showing saved guide data · Last update: '+(epgLoadedAt?new Date(epgLoadedAt).toLocaleString():"unknown")+"</div>");}else $("guide-list").innerHTML='<div class="empty">Could not load guide: '+esc(e.message)+'<br>Check the URL and CORS access.</div>';}}
function renderGuide(){const now=Date.now(),wanted=Object.create(null),names=Object.create(null),items=[];for(let i=0;i<channels.length;i++){const c=channels[i];if(c.tvgId){wanted[c.tvgId]=true;names[c.tvgId]=c.title;}}for(let i=0;i<epg.length;i++){const p=epg[i];if(wanted[p.channel]&&p._stop>now&&p._start<now+12*3600000)items.push(p);}items.sort((a,b)=>a._start-b._start);const shown=items.slice(0,120);$("guide-date").textContent=new Date().toLocaleDateString();$("guide-list").innerHTML=shown.length?shown.map(p=>'<div class="guide-row"><div class="guide-time">'+(p._start?new Date(p._start).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"--:--")+' – '+(p._stop?new Date(p._stop).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"")+'</div><div><strong>'+esc(p.title)+'</strong><small>'+esc(names[p.channel]||p.channel)+' · '+esc(p.desc)+'</small></div></div>').join(""):'<div class="empty">No upcoming programmes matched this playlist.<br>Check that tvg-id values match your XMLTV channel IDs.</div>';}
function updateProgram(){
 const c=current(),now=Date.now();
 if(!c||!c.tvgId){$("current-program").textContent="";$("next-program").textContent="";$("program-progress").style.width="0%";return;}
 const items=epgByChannel[c.tvgId]||[];
 const live=items.find(x=>x._start<=now&&x._stop>now),next=items.find(x=>x._start>now);
 $("current-program").textContent=live?"NOW · "+live.title:"No current programme data";
 $("next-program").textContent=next?"NEXT · "+new Date(next._start).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+" · "+next.title:"";
 $("program-progress").style.width=live?Math.max(0,Math.min(100,(now-live._start)/(live._stop-live._start)*100))+"%":"0%";
}
function showChannelInfo(){
 const c=current();if(!c){setStatus("Select a channel first.");return;}
 let host="Unknown";try{host=new URL(c.url).hostname;}catch(e){}
 $("info-title").textContent=c.title||"Channel information";
 $("info-group").textContent=c.group||"Other";
 $("info-id").textContent=c.tvgId||"Not provided";
 $("info-source").textContent=host;
 $("info-url").textContent=c.url;
 $("info-logo").src=c.logo||"";$("info-logo").style.display=c.logo?"block":"none";
 $("channel-info-dialog").showModal();
}
function updateChannelStats(){if(video.videoWidth>0&&video.videoHeight>0){$("video-stats").textContent=video.videoWidth+"×"+video.videoHeight;}else if(video.readyState>=1){$("video-stats").textContent="Audio only / no video track";}else{$("video-stats").textContent="Waiting for video";}}
function saveSettings(){settings={refresh:Number($("refresh-interval").value)||0,epgUrl:$("epg-url").value.trim(),autoplayNext:$("autoplay-next").checked,autoRetry:$("auto-retry").checked,maxRetries:Number($("max-retries").value)||0,parentalPin:$("parental-pin").value.trim(),protectedGroup:$("protected-group").value.trim()};save();scheduleRefresh();$("settings-dialog").close();setStatus("Settings saved.");}
function resetTrackControls(){$("quality-select").innerHTML='<option value="-1">Auto</option>';$("audio-select").innerHTML='<option value="-1">Default</option>';$("subtitle-select").innerHTML='<option value="-1">Off</option>';}
function populateTrackControls(){if(!hls)return;const q=$("quality-select"),a=$("audio-select"),st=$("subtitle-select");q.innerHTML='<option value="-1">Auto</option>';hls.levels.forEach((lv,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=(lv.height?lv.height+"p":Math.round((lv.bitrate||0)/1000)+" kbps");q.appendChild(o);});q.value=String(hls.currentLevel);a.innerHTML='<option value="-1">Default</option>';hls.audioTracks.forEach((t,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=t.name||t.lang||("Audio "+(i+1));a.appendChild(o);});a.value=String(hls.audioTrack);st.innerHTML='<option value="-1">Off</option>';hls.subtitleTracks.forEach((t,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=t.name||t.lang||("Subtitle "+(i+1));st.appendChild(o);});st.value=String(hls.subtitleTrack);}
function exportBackup(){const data={format:"ashika-live-tv-backup",version:1,createdAt:new Date().toISOString(),playlists:playlists,activePlaylistId:activePlaylistId,settings:settings,favourites:getFavourites(),recent:recent};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="ashika-live-tv-backup.json";document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),1000);$("backup-status").textContent="Backup exported. Keep the JSON file somewhere safe.";}
function readFileText(file){return new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(String(reader.result||""));};reader.onerror=function(){reject(reader.error||new Error("Could not read file"));};reader.readAsText(file);});}
async function restoreBackup(file){try{const data=JSON.parse(await file.text());if(data.format!=="ashika-live-tv-backup"||!Array.isArray(data.playlists))throw Error("This is not a valid Ashika backup.");if(!data.playlists.every(p=>p&&typeof p.id==="string"&&typeof p.content==="string"))throw Error("Backup playlist data is invalid.");playlists=data.playlists;activePlaylistId=data.activePlaylistId||null;settings=Object.assign({refresh:0,epgUrl:"",autoplayNext:false,autoRetry:true,maxRetries:3,parentalPin:"",protectedGroup:""},data.settings||{});recent=Array.isArray(data.recent)?data.recent:[];favourites=Array.isArray(data.favourites)?data.favourites:[];favouriteSet=new Set(favourites);localStorage.setItem(STORE,JSON.stringify({playlists,activePlaylistId,settings,favourites:favourites,recent:recent}));$("refresh-interval").value=String(settings.refresh||0);$("epg-url").value=settings.epgUrl||"";$("autoplay-next").checked=!!settings.autoplayNext;$("auto-retry").checked=settings.autoRetry!==false;$("max-retries").value=String((settings.maxRetries===undefined?3:settings.maxRetries));$("parental-pin").value=settings.parentalPin||"";$("protected-group").value=settings.protectedGroup||"";scheduleRefresh();const p=activePlaylist();channels=p?parseM3U(p.content):[];activeChannel=null;render();$("backup-status").textContent="Backup restored successfully.";}catch(e){$("backup-status").textContent=e.message||"Could not restore backup.";}}
function runDiagnostics(){const rows=["Network: "+(navigator.onLine?"Online":"Offline"),"Browser: "+navigator.userAgent,"Screen: "+screen.width+"×"+screen.height,"Channels: "+channels.length,"Playlists: "+playlists.length,"Active playlist: "+((activePlaylist()?activePlaylist().name:"None")),"Storage: "+(function(){try{localStorage.setItem("__ashika_test","1");localStorage.removeItem("__ashika_test");return "Available";}catch(e){return "Unavailable";}})(),"HLS engine: "+(window.Hls?"Loaded":"Unavailable"),"DASH engine: "+(window.dashjs?"Loaded":"Unavailable"),"Native HLS: "+(video.canPlayType("application/vnd.apple.mpegurl")||"Not reported"),"Video: "+(video.videoWidth?video.videoWidth+"×"+video.videoHeight:(video.readyState>=1?"No video track / audio-only":"No video metadata")),"Ready state: "+video.readyState,"Network state: "+video.networkState,"Media error: "+(video.error?("code "+video.error.code):"none"),"Current source: "+(video.currentSrc||"none"),"Playback: "+(video.paused?"Paused":"Playing")];$("diagnostics-output").textContent=rows.join("\n");}
function tick(){$("clock").textContent=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});updateProgram();}
function remoteFocusable(){return Array.from(document.querySelectorAll('button:not([disabled]),select:not([disabled]),input:not([disabled]),[tabindex="0"]')).filter(el=>{if(el.classList&&el.classList.contains("channel"))return false;if(el.closest("dialog")&&!el.closest("dialog").open)return false;const r=el.getBoundingClientRect(),st=getComputedStyle(el);return r.width>0&&r.height>0&&st.visibility!=="hidden"&&st.display!=="none";});}
function focusAndReveal(el){if(!el)return;el.focus();if(el.classList&&el.classList.contains("channel")){const list=$("channel-list"),r=el.getBoundingClientRect(),lr=list.getBoundingClientRect();if(r.bottom>lr.bottom)list.scrollTop+=r.bottom-lr.bottom;else if(r.top<lr.top)list.scrollTop-=lr.top-r.top;}}
function focusFirst(selector){const el=document.querySelector(selector);if(el)focusAndReveal(el);return el;}
function focusLast(selector){const items=document.querySelectorAll(selector),el=items.length?items[items.length-1]:null;if(el)focusAndReveal(el);return el;}
function focusSibling(row,active,selector,step){if(!row)return false;const items=Array.from(row.querySelectorAll(selector));const i=items.indexOf(active);if(i<0)return false;const next=items[i+step];if(next){focusAndReveal(next);return true;}return false;}
function handleRemoteKey(e){
 const code=e.keyCode||e.which||0;let key=e.key||"";
 if(code===37)key="ArrowLeft";else if(code===38)key="ArrowUp";else if(code===39)key="ArrowRight";else if(code===40)key="ArrowDown";else if(code===13)key="Enter";else if(code===461||code===8||key==="BrowserBack"||key==="GoBack")key="Back";else if(code===33)key="PageUp";else if(code===34)key="PageDown";
 const active=document.activeElement||document.body,tag=active.tagName;
 if(key==="Back"){const openDialog=document.querySelector("dialog[open]");if(openDialog){e.preventDefault();e.stopPropagation();openDialog.close();return;}if(document.fullscreenElement){e.preventDefault();e.stopPropagation();document.exitFullscreen();return;}return;}
 if(["INPUT","TEXTAREA"].includes(tag)){if(key==="ArrowLeft"||key==="ArrowRight")return;}
 if(tag==="SELECT"&&(key==="ArrowUp"||key==="ArrowDown"||key==="ArrowLeft"||key==="ArrowRight"))return;
 if(key==="ChannelDown"||key==="PageDown"){e.preventDefault();e.stopPropagation();changeChannel(1);return;}
 if(key==="ChannelUp"||key==="PageUp"){e.preventDefault();e.stopPropagation();changeChannel(-1);return;}
 if(key==="Enter"||key===" "){if(active&&active!==document.body&&active.matches("button,[role=button],.channel,[tabindex='0']")){e.preventDefault();e.stopPropagation();active.click();}return;}
 if(key==="f"||key==="F"){e.preventDefault();toggleFullscreen();return;}
 if(key==="m"||key==="M"){e.preventDefault();video.muted=!video.muted;$("mute-btn").textContent=video.muted?"🔇 Unmute":"🔊 Mute";return;}
 if(!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(key))return;
 e.preventDefault();e.stopPropagation();
 const list=$("channel-list"),buttons=Array.from(list.querySelectorAll(".channel")),inList=!!(active.closest&&active.closest("#channel-list")),inSidebar=!!(active.closest&&active.closest(".sidebar"));
 if(inList&&(key==="ArrowUp"||key==="ArrowDown")){
  let i=buttons.indexOf(active);
  if(i<0)i=key==="ArrowDown"?-1:buttons.length;
  if(key==="ArrowDown"&&i===buttons.length-1){
   const more=list.querySelector("#load-more-channels");
   if(more){const nextIndex=Number(buttons[i].getAttribute("data-index"))+1;visibleLimit+=250;render();focusAndReveal(list.querySelector('.channel[data-index="'+nextIndex+'"]'));}
   return;
  }
  i=key==="ArrowDown"?Math.min(i+1,buttons.length-1):Math.max(i-1,0);
  if(buttons[i])focusAndReveal(buttons[i]);
  return;
 }
 if(inList&&key==="ArrowLeft"){const groups=Array.from($("groups").querySelectorAll(".group-chip"));focusAndReveal(groups.length?groups[groups.length-1]:$("sort-select"));return;}
 if(inList&&key==="ArrowRight"){focusFirst(".player-actions button");return;}
 if(inSidebar){
  const filterRow=active.closest&&active.closest(".filter-row"),groupRow=active.closest&&active.closest(".groups");
  if((key==="ArrowLeft"||key==="ArrowRight")&&filterRow){focusSibling(filterRow,active,".filter-chip",key==="ArrowRight"?1:-1);return;}
  if((key==="ArrowLeft"||key==="ArrowRight")&&groupRow){focusSibling(groupRow,active,".group-chip",key==="ArrowRight"?1:-1);return;}
  if(key==="ArrowRight"){focusFirst("#channel-list .channel");return;}
  if(key==="ArrowLeft"){focusFirst(".player-actions button");return;}
  if(key==="ArrowDown"){
   if(active.closest(".sidebar-head"))focusFirst(".filter-row .filter-chip");
   else if(filterRow)focusFirst("#search");
   else if(active.id==="search")focusFirst("#sort-select");
   else if(active.closest(".sort-row"))focusFirst(".groups .group-chip");
   else if(groupRow)focusFirst("#channel-list .channel");
   else if(active.closest(".sidebar-footer"))focusLast("#channel-list .channel");
   else focusFirst("#channel-list .channel");
   return;
  }
  if(key==="ArrowUp"){
   if(active.closest(".sidebar-footer"))focusLast("#channel-list .channel");
   else if(groupRow)focusFirst("#sort-select");
   else if(active.closest(".sort-row"))focusFirst("#search");
   else if(active.id==="search")focusFirst(".filter-row .filter-chip:last-child");
   else if(filterRow)focusFirst(".sidebar-head #refresh-btn");
   else if(inList)focusFirst(".groups .group-chip:last-child");
   return;
  }
 }
 if(!inSidebar&&key==="ArrowRight"){focusFirst(".filter-row .filter-chip");return;}
 if(active===document.body||active===document.documentElement){if(key==="ArrowDown"||key==="ArrowRight")focusFirst("#channel-list .channel");return;}
 const candidates=remoteFocusable().filter(el=>el!==active&&el.closest(".watch-area"));
 const ar=active.getBoundingClientRect();
 if(!ar||!ar.width||!ar.height){if(candidates.length)focusAndReveal(candidates[0]);return;}
 const ax=ar.left+ar.width/2,ay=ar.top+ar.height/2;let best=null,bestScore=Infinity;
 for(const el of candidates){const r=el.getBoundingClientRect(),dx=r.left+r.width/2-ax,dy=r.top+r.height/2-ay;let primary,cross;
  if(key==="ArrowLeft"){if(dx>=-2)continue;primary=-dx;cross=Math.abs(dy);}
  else if(key==="ArrowRight"){if(dx<=2)continue;primary=dx;cross=Math.abs(dy);}
  else if(key==="ArrowUp"){if(dy>=-2)continue;primary=-dy;cross=Math.abs(dx);}
  else{if(dy<=2)continue;primary=dy;cross=Math.abs(dx);}
  const score=primary+cross*1.8;if(score<bestScore){bestScore=score;best=el;}
 }
 if(best)focusAndReveal(best);
}
function bind(){ $("network-status").textContent="● "+(navigator.onLine?"Online":"Offline");$("network-status").classList.toggle("offline",!navigator.onLine);$("open-playlist").onclick=()=>$("playlist-dialog").showModal();$("manager-add").onclick=()=>{$("manage-dialog").close();$("playlist-dialog").showModal();};$("settings-btn").onclick=()=>$("settings-dialog").showModal();$("manage-btn").onclick=()=>{manager();$("manage-dialog").showModal();};$("save-playlists").onclick=savePlaylistLibrary;$("guide-btn").onclick=()=>{$("guide-dialog").showModal();loadEPG();};$("load-guide").onclick=loadEPG;$("import-btn").onclick=addPlaylist;$("refresh-btn").onclick=()=>refreshAll(false);$("save-settings").onclick=saveSettings;$("server-lookup-btn").onclick=lookupServerChannels;$("server-test-btn").onclick=testAshikaServers;$("diagnostics-btn").onclick=runDiagnostics;$("prev-channel").onclick=()=>changeChannel(-1);$("next-channel").onclick=()=>changeChannel(1);$("fullscreen-btn").onclick=toggleFullscreen;$("mute-btn").onclick=()=>{video.muted=!video.muted;$("mute-btn").textContent=video.muted?"🔇 Unmute":"🔊 Mute";};video.addEventListener("volumechange",()=>{if($("volume-select"))$("volume-select").value=String(video.muted?0:Math.round(video.volume*100));});$("sleep-timer").onchange=()=>setSleepTimer($("sleep-timer").value);$("speed-select").onchange=()=>$("player").playbackRate=Number($("speed-select").value)||1;$("volume-select").onchange=()=>{video.volume=Math.max(0,Math.min(1,Number($("volume-select").value)/100));video.muted=video.volume===0;$("mute-btn").textContent=video.muted?"🔇 Unmute":"🔊 Mute";};$("skip-back").onclick=()=>{if(Number.isFinite(video.currentTime))video.currentTime=Math.max(0,video.currentTime-10);};$("skip-forward").onclick=()=>{if(Number.isFinite(video.duration))video.currentTime=Math.min(video.duration,video.currentTime+10);};$("search").oninput=()=>{visibleLimit=250;if(searchTimer)clearTimeout(searchTimer);searchTimer=setTimeout(()=>{searchTimer=null;render();},110);};$("sort-select").onchange=render;$("retry-btn").onclick=()=>{if(activeChannel!==null)play(activeChannel);};$("fit-btn").onclick=()=>{video.style.objectFit=video.style.objectFit==="cover"?"contain":"cover";$("fit-btn").textContent=video.style.objectFit==="cover"?"▣ Fill":"▣ Fit";};$("quality-select").onchange=()=>{if(hls)hls.currentLevel=Number($("quality-select").value);};$("audio-select").onchange=()=>{if(hls)hls.audioTrack=Number($("audio-select").value);};$("subtitle-select").onchange=()=>{if(hls)hls.subtitleTrack=Number($("subtitle-select").value);};$("backup-btn").onclick=()=>{$("backup-status").textContent="";$("backup-dialog").showModal();};$("export-backup").onclick=exportBackup;$("backup-file").onchange=()=>{const file=$("backup-file").files[0];if(file)restoreBackup(file);};$("fav-current").onclick=()=>{if(current())toggleFav(current());};$("channel-info-btn").onclick=showChannelInfo;window.addEventListener("online",()=>{$("network-status").textContent="● Online";$("network-status").classList.remove("offline");if(activeChannel!==null&&video.error)scheduleRecovery(activeChannel,"Internet restored. Reconnecting…");if(settings.epgUrl&&epg.length===0)loadEPG();});window.addEventListener("offline",()=>{$("network-status").textContent="● Offline";$("network-status").classList.add("offline");});video.addEventListener("loadedmetadata",updateChannelStats);video.addEventListener("loadeddata",updateChannelStats);video.addEventListener("waiting",()=>{if(activeChannel!==null)setStatus("Buffering video…");});video.addEventListener("stalled",()=>{if(activeChannel!==null)setStatus("Stream stalled. Waiting for data…");});video.addEventListener("playing",updateChannelStats);$("load-demo").onclick=()=>{const p={id:id(),name:"Sample playlist",url:"",content:sample,updated:Date.now()};playlists.push(p);loadPlaylist(p);};$("stop-btn").onclick=()=>{stopEngines();activeChannel=null;$("current-title").textContent="Playback stopped";$("current-group").textContent="Choose another channel";$("player-placeholder").classList.remove("hidden");setStatus("");render();};document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).close());document.querySelectorAll(".filter-chip").forEach(b=>b.onclick=()=>{filter=b.dataset.filter;visibleLimit=250;document.querySelectorAll(".filter-chip").forEach(x=>x.classList.toggle("active",x===b));render();});$("groups").onclick=e=>{const b=e.target.closest("[data-group]");if(b){activeGroup=b.dataset.group;visibleLimit=250;render();}};$("channel-list").onclick=e=>{const more=e.target.closest("#load-more-channels");if(more){visibleLimit+=250;render();return;}const b=e.target.closest(".channel");if(b)play(Number(b.dataset.index),false,true);};$("playlist-file").onchange=()=>{if($("playlist-file").files[0])$("playlist-url").value="";};video.addEventListener("playing",()=>{if(video.videoWidth>0&&video.videoHeight>0){if(nativeFallbackTimer){clearTimeout(nativeFallbackTimer);nativeFallbackTimer=null;}setStatus("");}else if(nativeFallbackTimer){setStatus("Audio is playing; waiting for the video track…");}updateChannelStats();});video.addEventListener("error",()=>{if(activeChannel!==null)scheduleRecovery(activeChannel,"Playback failed. Stream may be offline or unsupported.");});document.addEventListener("keydown",handleRemoteKey,true);}
const DEFAULT_PLAYLISTS=[
 {name:"Bangladesh IPTV",url:"https://raw.githubusercontent.com/Shadmanislam/bdiptv/master/BD%20IPTV.m3u"},
 {name:"FreeHunter HDTV",url:"https://raw.githubusercontent.com/ahan443/FreeHunter/refs/heads/main/HDTV.m3u"},
 {name:"Toffee BD",url:"https://raw.githubusercontent.com/srhady/toffee-bd/refs/heads/main/toffee_playlist.m3u"}
];
function ensureDefaultPlaylist(){
 DEFAULT_PLAYLISTS.forEach(function(source){
  if(!playlists.some(function(p){return p.url===source.url;})){
   playlists.push({id:id(),name:source.name,url:source.url,content:"",updated:0});
  }
 });
 var selected=activePlaylist();
 if(!selected||!parseM3U(selected.content||"").length){
  var first=playlists.find(function(p){return DEFAULT_PLAYLISTS.some(function(d){return d.url===p.url;});});
  if(first){activePlaylistId=first.id;channels=parseM3U(first.content||"");}
  render();
 }
 save();
 var pending=playlists.filter(function(p){return !!p.url&&!parseM3U(p.content||"").length;});
 if(pending.length){
  setStatus("Loading "+pending.length+" playlist source(s)…");
  Promise.all(pending.map(function(p){return refreshOne(p,true).then(function(ok){return {playlist:p,ok:ok};});})).then(function(results){
   var loaded=results.filter(function(x){return x.ok;});
   var active=activePlaylist();
   if(active&&parseM3U(active.content||"").length){channels=parseM3U(active.content);appendCustomChannels();render();}
   else if(loaded.length){activePlaylistId=loaded[0].playlist.id;channels=parseM3U(loaded[0].playlist.content);appendCustomChannels();activeChannel=null;render();}
   save();
   var count=loaded.length;
   setStatus(count?"Loaded "+count+" default playlist source(s). Open Manage Playlists to switch sources.":"Playlists added, but could not refresh. Check internet/CORS and use Refresh.");
  });
 }else if(selected&&parseM3U(selected.content||"").length){channels=parseM3U(selected.content);appendCustomChannels();render();}
}
function init(){try{let raw=localStorage.getItem(STORE);if(!raw){raw=localStorage.getItem(LEGACY_STORE);if(raw)localStorage.setItem(STORE,raw);}const s=JSON.parse(raw||"{}");playlists=Array.isArray(s.playlists)?s.playlists:[];activePlaylistId=s.activePlaylistId||null;settings=Object.assign(settings,s.settings||{});recent=Array.isArray(s.recent)?s.recent:[];try{const savedRecent=JSON.parse(localStorage.getItem(RECENT_STORE)||"null");if(Array.isArray(savedRecent))recent=savedRecent;}catch(ignore){}favourites=Array.isArray(s.favourites)?s.favourites:[];favouriteSet=new Set(favourites);}catch(e){}$("refresh-interval").value=String(settings.refresh||0);$("epg-url").value=settings.epgUrl||"";$("autoplay-next").checked=!!settings.autoplayNext;$("auto-retry").checked=settings.autoRetry!==false;$("max-retries").value=String((settings.maxRetries===undefined?3:settings.maxRetries));$("parental-pin").value=settings.parentalPin||"";$("protected-group").value=settings.protectedGroup||"";bind();window.addEventListener("pagehide",save);document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")save();});try{customChannels=JSON.parse(localStorage.getItem("ashika.tv.custom.channels.v1")||"[]");if(!Array.isArray(customChannels))customChannels=[];}catch(e){customChannels=[];}const p=activePlaylist();if(p){channels=parseM3U(p.content||"");appendCustomChannels();}render();scheduleRefresh();tick();ensureDefaultPlaylist();setInterval(tick,30000);}
window.AshikaTV={
 getSnapshot:function(){return {channels:channels.slice(),playlists:playlists.slice(),favorites:favourites.slice(),recent:recent.slice(),current:current(),settings:Object.assign({},settings)};},
 getVideo:function(){return video;},
 setStatus:function(message){setStatus(message);},
 playChannel:function(url){var i=channels.findIndex(function(c){return c.url===url;});if(i>=0){play(i);return true;}return false;},
 setLibraryState:function(favs,recents){favourites=Array.isArray(favs)?favs.slice():[];favouriteSet=new Set(favourites);recent=Array.isArray(recents)?recents.slice():[];save();render();},
 toggleFavorite:function(url){var c=channels.find(function(x){return x.url===url;});if(c)toggleFav(c);},
 addCustomChannel:function(channel){if(!channel||!/^https?:\/\//i.test(String(channel.url||"")))return false;var item={title:String(channel.title||"Custom Channel").trim(),url:String(channel.url).trim(),group:String(channel.group||"Custom").trim(),logo:String(channel.logo||"").trim(),tvgId:String(channel.tvgId||"").trim()};if(!item.title)return false;customChannels=customChannels.filter(function(x){return x.url!==item.url;});customChannels.push(item);saveCustomChannels();channels=activePlaylist()?parseM3U(activePlaylist().content||""):[];appendCustomChannels();render();return true;},
 removeCustomChannel:function(url){customChannels=customChannels.filter(function(x){return x.url!==url;});saveCustomChannels();channels=activePlaylist()?parseM3U(activePlaylist().content||""):[];appendCustomChannels();render();},
 getCustomChannels:function(){return customChannels.slice();},
 addPlaylist:function(name,url){var clean=String(url||"").trim();if(!/^https?:\/\//i.test(clean))return Promise.reject(new Error("Enter a valid HTTP/HTTPS playlist URL."));return fetch(clean,{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.text();}).then(function(content){if(!parseM3U(content).length)throw new Error("No playable channels found.");var p={id:id(),name:String(name||"Playlist "+(playlists.length+1)),url:clean,content:content,updated:Date.now()};playlists.push(p);save();if(!activePlaylist())loadPlaylist(p);return parseM3U(content).length;});},
 importCompanion:function(endpoint){return fetch(String(endpoint||"").trim(),{cache:"no-store",headers:{Accept:"application/json"}}).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();}).then(function(data){if(!data||!Array.isArray(data.channels))throw new Error("Companion JSON must contain a channels array.");var count=0;data.channels.forEach(function(c){if(c&&/^https?:\/\//i.test(String(c.url||""))&&c.name){if(window.AshikaTV.addCustomChannel({title:c.name,url:c.url,group:c.group||"Other",logo:c.logo||""}))count++;}});return count;});}
};
try{init();}catch(err){try{setStatus("Application startup error: "+(err&&err.message?err.message:String(err)));}catch(ignore){}if(window.console&&console.error)console.error("Ashika Live TV startup error",err);}
})();