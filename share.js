export const MAX_LINK_LENGTH = 8000;
const MAX_SNAPSHOT_BYTES = 120000;
function base64url(bytes) {
 let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export async function snapshotLink(snapshot,href) {
 const raw=new TextEncoder().encode(JSON.stringify(snapshot));
 if(raw.length>MAX_SNAPSHOT_BYTES)return null;
 let encoded;
 if(typeof CompressionStream==='function'){
  const stream=new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'));
  encoded='g1.'+base64url(new Uint8Array(await new Response(stream).arrayBuffer()));
 }else encoded='j1.'+base64url(raw);
 const url=new URL(href);url.search='';url.searchParams.set('reading',snapshot.entry.readingId);url.hash='shared='+encoded;
 return url.href.length<=MAX_LINK_LENGTH?url.href:null;
}
export async function readSnapshot(hash) {
 if(!hash.startsWith('#shared='))return null;
 if(hash.length>MAX_LINK_LENGTH)throw new Error('分享連結太長，可能已被截斷，請向分享者索取完整頁面檔案。');
 const value=hash.slice(8),match=/^(g1|j1)\.([A-Za-z0-9_-]+)$/.exec(value);
 if(!match)throw new Error('分享連結格式不正確，請確認連結是否完整。');
 const binary=atob(match[2].replace(/-/g,'+').replace(/_/g,'/'));
 let stream=new Blob([Uint8Array.from(binary,c=>c.charCodeAt(0))]).stream();
 if(match[1]==='g1'){
  if(typeof DecompressionStream!=='function')throw new Error('此瀏覽器無法開啟壓縮分享，請更新瀏覽器或向分享者索取完整頁面檔案。');
  stream=stream.pipeThrough(new DecompressionStream('gzip'));
 }
 const reader=stream.getReader(),chunks=[];let length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX_SNAPSHOT_BYTES){await reader.cancel();throw new Error('分享資料過大，請向分享者索取完整頁面檔案。');}chunks.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function snapshotDocument(snapshot) {
 const {reading:r,entry:e}=snapshot;
 const block=(title,value)=>`<section><h3>${escapeHTML(title)}</h3><p>${escapeHTML(value??'')}</p></section>`;
 const labels={observation:'觀察',interpretation:'理解／查考',reflection:'個人心得／領受',application:'今天的小行動',prayer:'我的禱告',question:'還想問的問題',tags:'主題標籤'};
 const discussion=(e.discussion||[]).map(t=>block('詢問',t.question)+block(t.status==='answered'?'GPT 回覆（由分享者貼回）':'GPT 回覆草稿（尚未確認）',t.answer)).join('');
 return `<!doctype html><html lang="zh-Hant"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>靜讀｜${escapeHTML(r.ref)}</title><style>body{font:16px/1.9 system-ui,sans-serif;color:#293b32;background:#f7f7f2;max-width:1000px;margin:auto;padding:30px}h1,h2,h3{font-family:serif}p{white-space:pre-wrap;overflow-wrap:anywhere}section{background:#fff;border:1px solid #dde3d8;border-radius:8px;margin:16px 0;padding:18px}small{color:#647163}li{white-space:pre-wrap}.columns{display:grid;grid-template-columns:1fr 1fr;gap:24px}@media(max-width:700px){.columns{display:block}}@media print{body{background:white;padding:0}section{break-inside:avoid}}</style></head><body><h1>✳ 靜讀 · 分享讀經頁</h1><p>${escapeHTML(e.date)} · Day ${snapshot.day} · ${e.status==='completed'?'已完成':'進行中'} · ${e.readingId.startsWith('personal-')?'個人讀經進度':'每日靈糧'}</p><small>這是分享者建立的內容快照。取得此檔案的人可閱讀其中所有筆記與問答。</small><div class="columns"><div><h2>${escapeHTML(r.ref)}</h2>${block('主題',r.theme)}${block('經文摘要',r.summary)}${block('主題分類',r.tag)}${block('經文背景',r.context)}${r.contextSource?block('背景資料來源',r.contextSource):''}${block('理解與查考',r.interpretation)}<section><h3>留給今天的兩個問題</h3><ol>${r.questions.map(q=>`<li>${escapeHTML(q)}</li>`).join('')}</ol></section>${block('禱告引導',r.prayer)}<p>完整經文：<a href="https://www.bible.com/zh-TW/bible/40/${escapeHTML(r.verse)}.CNV" target="_blank" rel="noopener noreferrer">YouVersion 繁體新譯本</a></p><p><a href="https://www.youtube.com/@streamofpraise" target="_blank" rel="noopener noreferrer">讚美之泉官方頻道</a></p></div><div><h2>分享者的筆記</h2>${Object.entries(labels).map(([field,label])=>block(label,e[field])).join('')}${block('Mark',(e.marks||[]).map(m=>'⭐ '+m).join('\n'))}${discussion||block('經文探討紀錄','')}${snapshot.commandDraft?block('自然輸入草稿（尚未送出）',snapshot.commandDraft):''}${snapshot.gptPrompt?block('準備貼到 GPT 的文字',snapshot.gptPrompt):''}</div></div></body></html>`;
}
