import { readings } from './readings.js';
const $ = s => document.querySelector(s);
const key = 'still-journal-v1';
const fieldNames = ['observation','interpretation','reflection','application','prayer','question','tags'];
const labels = {observation:'觀察',interpretation:'理解／查考',reflection:'個人心得／領受',application:'今天的小行動',prayer:'我的禱告',question:'未解問題',tags:'主題標籤'};
const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const today = dateKey();
let entries = [], storageAvailable = true, loadError = false, dirty = false;
try {
 const stored = JSON.parse(localStorage.getItem(key) || '[]');
 if (!validEntries(stored)) throw new Error('Invalid backup');
 entries = stored;
} catch { loadError = true; storageAvailable = false; }
const dayIndex = Math.floor(Date.UTC(...today.split('-').map((v,i)=>i===1?Number(v)-1:Number(v)))/86400000);
let selected = readings.find(r=>r.id===new URL(location.href).searchParams.get('reading')) || readings[dayIndex % readings.length];
let toastTimer;
function toast(message) { $('#toast').textContent=message; $('#toast').style.display='block'; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').style.display='none',4500); }
function validEntries(data) {
 return Array.isArray(data) && data.length <= 10000 && data.every(e=>e && typeof e==='object' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && readings.some(r=>r.id===e.readingId) && ['started','completed'].includes(e.status) && fieldNames.every(f=>typeof e[f]==='string' && e[f].length<=100000) && Array.isArray(e.marks) && e.marks.length<=1000 && e.marks.every(m=>typeof m==='string' && m.length<=100000));
}
function persist(next) {
 if(!storageAvailable) { toast('無法使用本機儲存，尚未儲存。請先匯出備份，並檢查瀏覽器設定。'); return false; }
 try {localStorage.setItem(key,JSON.stringify(next));entries=next;return true;} catch {toast('儲存失敗，可能已超過瀏覽器容量。請先匯出備份。');return false;}
}
function current() { return entries.find(e=>e.date===today && e.readingId===selected.id); }
function countDays() { return new Set(entries.map(e=>e.date)).size; }
function baseEntry() {return current() || {date:today,readingId:selected.id,status:'started',marks:[],...Object.fromEntries(fieldNames.map(f=>[f,'']))};}
function collect() {return {...baseEntry(),...Object.fromEntries(fieldNames.map(f=>[f,$('#journal-form').elements[f].value]))};}
function storeEntry(entry) {
 const next=entries.filter(e=>!(e.date===entry.date&&e.readingId===entry.readingId));next.push(entry);
 if(!persist(next)) return false;dirty=false; updateMeta();renderMarks();return true;
}
function save(complete=false) { const entry=collect();if(complete)entry.status='completed';if(storeEntry(entry))toast(complete?'今天的讀經已完成，也已儲存。':'今天的日記已儲存。'); }
function updateMeta() {$('#day-label').textContent=`Day ${current()?countDays():countDays()+1}`;$('#session-state').textContent=dirty?'有尚未儲存的內容':current()?.status==='completed'?'✓ 今日已完成':current()?'已儲存 · 進行中':'尚未記錄';}
function renderMarks() {
 $('#marks').replaceChildren();
 for(const mark of current()?.marks||[]) {const div=document.createElement('div');div.className='mark-item';const text=document.createElement('span');text.textContent=`⭐ ${mark}`;const button=document.createElement('button');button.className='text-button';button.textContent='移除';button.setAttribute('aria-label',`移除標記：${mark}`);button.onclick=()=>{const e=collect();e.marks=e.marks.filter(m=>m!==mark);if(storeEntry(e))toast('已移除標記。');};div.append(text,button);$('#marks').append(div);}
}
function renderReading() {
 const r=selected;$('#theme-tag').textContent=r.tag;$('#passage').textContent=r.ref;$('#reading-title').textContent=r.theme;$('#summary').textContent=r.summary;$('#context').textContent=r.context;$('#interpretation').textContent=r.interpretation;$('#prayer').textContent=r.prayer;
 $('#bible-link').href=`https://www.bible.com/zh-TW/bible/40/${r.verse}.CNV`;
 $('#questions').replaceChildren(...r.questions.map(q=>{const li=document.createElement('li');li.textContent=q;return li;}));
 $('#reading-select').value=r.id;
 for(const f of fieldNames) $('#journal-form').elements[f].value=current()?.[f]||'';
 dirty=false;updateMeta();renderMarks();
}
function showView(view) {
 if(view!=='today'&&dirty) { if(!storeEntry(collect()))return; }
 document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!==view);
 document.querySelectorAll('.nav').forEach(e=>e.classList.toggle('active',e.dataset.view===view));
 if(view==='journal')renderEntries();if(view==='progress')renderStats();
}
function renderEntries() {
 const search=$('#search').value.trim().toLocaleLowerCase();
 const visible=entries.filter(e=>[readings.find(r=>r.id===e.readingId).ref,e.date,...fieldNames.map(f=>e[f]),...e.marks].join(' ').toLocaleLowerCase().includes(search)).sort((a,b)=>b.date.localeCompare(a.date));
 const root=$('#entries');root.replaceChildren();
 if(!visible.length){const p=document.createElement('p');p.className='empty';p.textContent=search?'還沒有符合的筆記，試試其他關鍵字。':'第一篇日記，從今天開始。到「每日靈糧」寫下你的第一句話。';root.append(p);}
 for(const e of visible) {
  const article=document.createElement('article');article.className='entry';
  const meta=document.createElement('p');meta.className='entry-meta';meta.textContent=`${e.date} · ${e.status==='completed'?'✓ 已完成':'進行中'}`;
  const heading=document.createElement('h2');heading.textContent=readings.find(r=>r.id===e.readingId).ref;article.append(meta,heading);
  for(const f of fieldNames)if(e[f]){const title=document.createElement('h3');title.textContent=labels[f];const text=document.createElement('p');text.textContent=e[f];article.append(title,text);}
  for(const mark of e.marks){const p=document.createElement('p');p.textContent=`⭐ ${mark}`;article.append(p);}
  const remove=document.createElement('button');remove.className='text-button';remove.textContent='刪除這篇日記';remove.onclick=()=>{if(confirm('確定刪除這篇日記？建議先匯出備份。')){if(persist(entries.filter(x=>x!==e))){renderEntries();renderReading();toast('已刪除日記。');}}};article.append(remove);root.append(article);
 }
}
function renderStats() {
 const completed=entries.filter(e=>e.status==='completed'),days=new Set(completed.map(e=>e.date));
 const cursor=new Date(`${today}T12:00:00`);if(!days.has(today))cursor.setDate(cursor.getDate()-1);let streak=0;
 while(days.has(dateKey(cursor))){streak++;cursor.setDate(cursor.getDate()-1);}
 const stats=[[days.size,'完成讀經天數'],[streak,'目前連續天數'],[entries.reduce((sum,e)=>sum+e.marks.length,0),'珍藏的 Mark'],[new Set(completed.filter(e=>e.date.startsWith(today.slice(0,7))).map(e=>e.date)).size,'本月完成天數']];
 $('#stats').replaceChildren(...stats.map(([n,label])=>{const div=document.createElement('div');div.className='stat';const strong=document.createElement('strong');strong.textContent=n;const span=document.createElement('span');span.textContent=label;div.append(strong,span);return div;}));
}
function command() {
 const input=$('#command'),text=input.value.trim();if(!text)return;
 if(/^搜尋\s*/.test(text)){if(dirty&&!storeEntry(collect()))return;$('#search').value=text.replace(/^搜尋\s*/,'');showView('journal');input.value='';return;}
 if(/^(今天結束|over for today)$/i.test(text)){save(true);input.value='';return;}
 const mark=text.match(/^mark(?:\s+([\s\S]+))?$/i);const entry=collect();
 if(mark){const content=mark[1]||window.getSelection()?.toString().trim();if(!content){toast('請輸入 mark 加上你想保留的話，或先選取頁面上的文字。');return;}entry.marks=[...new Set([...entry.marks,content])];}
 else entry.question=[entry.question,text].filter(Boolean).join('\n');
 if(storeEntry(entry)){if(!mark)$('#journal-form').elements.question.value=entry.question;input.value='';toast(mark?'已儲存這個 Mark。':'問題已存入日記，等待你繼續查考。');}
}
$('#today-date').textContent=new Intl.DateTimeFormat('zh-TW',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date());
$('#reading-select').replaceChildren(...readings.map(r=>{const o=document.createElement('option');o.value=r.id;o.textContent=`${r.ref} · ${r.tag}`;return o;}));
$('#reading-select').onchange=()=>{if(dirty&&!storeEntry(collect())){$('#reading-select').value=selected.id;return;}selected=readings.find(r=>r.id===$('#reading-select').value);const url=new URL(location.href);url.searchParams.set('reading',selected.id);history.replaceState(null,'',url);renderReading();};
$('#journal-form').onsubmit=e=>{e.preventDefault();save();};$('#journal-form').oninput=()=>{dirty=true;updateMeta();};$('#complete').onclick=()=>save(true);
$('#send-command').onclick=command;$('#command').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();command();}};
 document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>showView(b.dataset.view));$('#search').oninput=renderEntries;
$('#share').onclick=async()=>{const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('reading',selected.id);try{if(navigator.share)await navigator.share({title:`PB｜${selected.ref}`,url:url.href});else{await navigator.clipboard.writeText(url.href);toast('讀經連結已複製，不含你的私人筆記。');}}catch(e){if(e.name!=='AbortError')prompt('複製讀經連結（不含筆記）：',url.href);}};
$('#export').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),entries},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`pb-journal-${today}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已產生備份檔案，請妥善保存。');};
$('#import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>10*1024*1024)throw new Error();const data=JSON.parse(await file.text());if(data.version!==1||!validEntries(data.entries))throw new Error();const existing=new Set(entries.map(x=>`${x.date}/${x.readingId}`));const additions=data.entries.filter(x=>!existing.has(`${x.date}/${x.readingId}`));const unique=new Map(additions.map(x=>[`${x.date}/${x.readingId}`,{date:x.date,readingId:x.readingId,status:x.status,marks:[...x.marks],...Object.fromEntries(fieldNames.map(f=>[f,x[f]]))}]));if(persist([...entries,...unique.values()])){renderEntries();renderReading();toast(`已匯入 ${unique.size} 篇日記，現有同日同經文的筆記保留原樣。`);}}catch{toast('匯入失敗：請選擇有效的 PB JSON 備份（上限 10 MB）。');}e.target.value='';};
$('#about').onclick=()=>$('#about-dialog').showModal();$('#close-about').onclick=()=>$('#about-dialog').close();window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
renderReading();if(loadError)toast('現有筆記無法讀取或瀏覽器不允許儲存。為保護資料，已停止寫入；請檢查瀏覽器儲存設定。');
