import { readings } from './readings.js';
import { books, personalReading } from './bible.js';
import { gptURL, configLoaded, loadGPTConfig, validDiscussion, discussionPrompt } from './gpt-bridge.js';
const resolveReading = id => readings.find(r=>r.id===id) || personalReading(id);
const $ = s => document.querySelector(s);
const key = 'still-journal-v1';
const fieldNames = ['observation','interpretation','reflection','application','prayer','question','tags'];
const discussionErrors = new Map();
const entryKey = entry => `${entry.date}/${entry.readingId}`;
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
const linkedReading = resolveReading(new URL(location.href).searchParams.get('reading') || '');
let dailySelected = linkedReading && !personalReading(linkedReading.id) ? linkedReading : readings[dayIndex % readings.length];
let personalSelected = personalReading(linkedReading?.id || '') || personalReading([...entries].reverse().find(e=>personalReading(e.readingId))?.readingId || 'personal-GEN-1');
let activeView = personalReading(linkedReading?.id || '') ? 'personal' : 'today';
let selected = activeView === 'personal' ? personalSelected : dailySelected;
let toastTimer;
function toast(message) { $('#toast').textContent=message; $('#toast').style.display='block'; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').style.display='none',4500); }
function validEntries(data) {
 return Array.isArray(data) && data.length <= 10000 && data.every(e=>e && typeof e==='object' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && typeof e.readingId==='string' && !!resolveReading(e.readingId) && ['started','completed'].includes(e.status) && fieldNames.every(f=>typeof e[f]==='string' && e[f].length<=100000) && Array.isArray(e.marks) && e.marks.length<=1000 && e.marks.every(m=>typeof m==='string' && m.length<=100000) && validDiscussion(e.discussion));
}
function persist(next) {
 if(!storageAvailable) { toast('無法使用本機儲存，尚未儲存。請先匯出備份，並檢查瀏覽器設定。'); return false; }
 try {localStorage.setItem(key,JSON.stringify(next));entries=next;return true;} catch {toast('儲存失敗，可能已超過瀏覽器容量。請先匯出備份。');return false;}
}
function current() { return entries.find(e=>e.date===today && e.readingId===selected.id); }
function countDays() { return new Set(entries.map(e=>e.date)).size; }
function baseEntry() {return current() || {date:today,readingId:selected.id,status:'started',marks:[],...Object.fromEntries(fieldNames.map(f=>[f,'']))};}
function collect() {
 const entry={...baseEntry(),...Object.fromEntries(fieldNames.map(f=>[f,$('#journal-form').elements[f].value]))};
 if(entry.discussion)entry.discussion=entry.discussion.map(turn=>{const draft=[...document.querySelectorAll('#discussion-thread textarea')].find(input=>input.dataset.turnId===turn.id);return draft?{...turn,answer:draft.value}:turn;});
 return entry;
}
function storeEntry(entry) {
 const next=entries.filter(e=>!(e.date===entry.date&&e.readingId===entry.readingId));next.push(entry);
 if(!persist(next)) return false;dirty=false; updateMeta();renderMarks();renderDiscussion();return true;
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
 $('#reading-select').value=dailySelected.id;
 const personal=activeView==='personal';
 $('#personal-picker').hidden=!personal;
 $('.verse-card').hidden=personal;
 $('.selection').hidden=personal;
 if(personal){
  $('#book-select').value=r.bookId;
  renderChapters(r.bookId,r.chapter);
  $('#personal-date').textContent=today;
  $('#personal-passage').textContent=r.ref;
  $('#personal-bible-link').href=`https://www.bible.com/zh-TW/bible/40/${r.verse}.CNV`;
 }
 for(const f of fieldNames) $('#journal-form').elements[f].value=current()?.[f]||'';
 dirty=false;updateMeta();renderMarks();$('#gpt-handoff').hidden=true;renderDiscussion();
}
function discussionTurn(turn,editable=false) {
 const article=document.createElement('article');article.className='discussion-turn';
 const q=document.createElement('p');q.className='discussion-question';q.textContent=`你：${turn.question}`;article.append(q);
 const answer=document.createElement('p');answer.className='discussion-answer';
 answer.textContent=turn.status==='answered'?`GPT 回覆（由你貼回）：\n${turn.answer}`:'問題已保存；請到 ChatGPT 選用外掛並貼上詢問，再把回覆貼回這裡。';
 article.append(answer);
 if(editable&&turn.status!=='answered'){
  const label=document.createElement('label');label.className='reply-label';label.textContent='貼上 GPT 回覆';
  const input=document.createElement('textarea');input.placeholder='把原 GPT 的回答貼在這裡，再儲存到本段經文。';input.maxLength=100000;input.value=turn.answer;input.dataset.turnId=turn.id;
  label.append(input);article.append(label);
  const button=document.createElement('button');button.type='button';button.className='button save-gpt-reply';button.textContent='儲存回覆';
  button.onclick=()=>{const value=input.value.trim();if(!value){toast('請先貼上 GPT 回覆。');return;}const entry=collect();entry.discussion=(entry.discussion||[]).map(t=>t.id===turn.id?{...t,answer:value,status:'answered'}:t);if(storeEntry(entry))toast('GPT 回覆已保存在本段經文，可於日記中搜尋。');};article.append(button);
 }
 return article;
}
function renderDiscussion() {
 const identity=entryKey(baseEntry());
 $('#ask-question').disabled=!configLoaded;
 $('#discussion-status').textContent=discussionErrors.get(identity)||'';
 $('#discussion-notice').textContent=!configLoaded?'正在確認原 GPT 連結…':gptURL?'按「詢問」會複製目前經文、問題及本段已貼回的討論，並開啟原 GPT。請在新分頁貼上送出；回覆需手動貼回，其他心得與禱告不會複製。':'按「詢問」會複製經文與問題並開啟 ChatGPT。請自行選用「每日經文與查經參考」外掛後貼上送出，並將回答貼回保存；網站不會自動啟用外掛或讀取回答。';
 $('#discussion-thread').replaceChildren(...(current()?.discussion||[]).map(turn=>discussionTurn(turn,true)));
 $('#gpt-direct-link').hidden=false;$('#gpt-direct-link').href=gptURL||'https://chatgpt.com/';$('#gpt-direct-link').textContent=gptURL?'開啟原 GPT ↗':'開啟 ChatGPT（需自行選用外掛）↗';
}
async function askQuestion() {
 const question=$('#journal-form').elements.question.value.trim();
 if(!question){toast('請先填入想探討的問題。');$('#journal-form').elements.question.focus();return;}
 if(question.length>6000){toast('請將問題縮短至 6,000 字以內。');return;}
 const entry=collect(),identity=entryKey(entry);
 if((entry.discussion?.length||0)>=100){toast('本段討論已達 100 則，請先匯出備份後另開新紀錄。');return;}
 const prompt=discussionPrompt(selected.ref,question,(entry.discussion||[]).filter(t=>t.status==='answered'));
 const turn={id:crypto.randomUUID(),question,answer:'',status:'opened',createdAt:new Date().toISOString()};
 entry.discussion=[...(entry.discussion||[]),turn];
 if(!storeEntry(entry))return;
 $('#gpt-prompt').value=prompt;$('#gpt-handoff').hidden=false;
 // Open synchronously from the click, before awaiting clipboard permissions.
 window.open(gptURL||'https://chatgpt.com/','_blank','noopener,noreferrer');
 try {await navigator.clipboard.writeText(prompt);discussionErrors.set(identity,gptURL?'問題已複製。請在 GPT 新分頁貼上送出。':'問題已複製。請在 ChatGPT 自行選用外掛後貼上送出；若沒有新分頁，使用下方連結開啟。');}
 catch {discussionErrors.set(identity,'無法自動複製，請手動複製下方文字，再到 ChatGPT 選用外掛後貼上送出。');}
 if(entryKey(baseEntry())===identity)renderDiscussion();
}
function showView(view) {
 if(dirty && !storeEntry(collect()))return;
 const readingView=view==='today'||view==='personal';
 activeView=view;
 document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!==(readingView?'today':view));
 document.querySelectorAll('.nav').forEach(e=>e.classList.toggle('active',e.dataset.view===view));
 if(readingView){selected=view==='personal'?personalSelected:dailySelected;renderReading();const url=new URL(location.href);url.searchParams.set('reading',selected.id);history.replaceState(null,'',url);}
 if(view==='journal')renderEntries();if(view==='progress')renderStats();
}
function renderChapters(bookId,chapter=1) {
 const book=books.find(b=>b.id===bookId);
 $('#chapter-select').replaceChildren(...Array.from({length:book.chapters},(_,i)=>{const o=document.createElement('option');o.value=i+1;o.textContent=`第 ${i+1} ${bookId==='PSA'?'篇':'章'}`;return o;}));
 $('#chapter-select').value=chapter;
}
function changePersonal(bookId,chapter) {
 if(dirty&&!storeEntry(collect())){$('#book-select').value=selected.bookId;renderChapters(selected.bookId,selected.chapter);return;}
 personalSelected=personalReading(`personal-${bookId}-${chapter}`);selected=personalSelected;
 renderReading();
 // Selecting a chapter is itself a progress record, even before a reflection is written.
 if(storeEntry(collect()))toast(`已保留當日進度：${selected.ref}`);
 const url=new URL(location.href);url.searchParams.set('reading',selected.id);history.replaceState(null,'',url);
}
function renderEntries() {
 const search=$('#search').value.trim().toLocaleLowerCase();
 const visible=entries.filter(e=>[resolveReading(e.readingId).ref,e.date,...fieldNames.map(f=>e[f]),...e.marks,...(e.discussion||[]).flatMap(turn=>[turn.question,turn.answer])].join(' ').toLocaleLowerCase().includes(search)).sort((a,b)=>b.date.localeCompare(a.date));
 const root=$('#entries');root.replaceChildren();
 if(!visible.length){const p=document.createElement('p');p.className='empty';p.textContent=search?'還沒有符合的筆記，試試其他關鍵字。':'第一篇日記，從今天開始。到「每日靈糧」寫下你的第一句話。';root.append(p);}
 for(const e of visible) {
  const article=document.createElement('article');article.className='entry';
  const meta=document.createElement('p');meta.className='entry-meta';meta.textContent=`${e.date} · ${personalReading(e.readingId)?'個人讀經進度':'每日靈糧'} · ${e.status==='completed'?'✓ 已完成':'進行中'}`;
  const heading=document.createElement('h2');heading.textContent=resolveReading(e.readingId).ref;article.append(meta,heading);
  for(const f of fieldNames)if(e[f]){const title=document.createElement('h3');title.textContent=labels[f];const text=document.createElement('p');text.textContent=e[f];article.append(title,text);}
  for(const mark of e.marks){const p=document.createElement('p');p.textContent=`⭐ ${mark}`;article.append(p);}
  if(e.discussion?.length){const heading=document.createElement('h3');heading.textContent='經文探討紀錄';article.append(heading);for(const turn of e.discussion)article.append(discussionTurn(turn));}
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
$('#reading-select').onchange=()=>{if(dirty&&!storeEntry(collect())){$('#reading-select').value=selected.id;return;}dailySelected=readings.find(r=>r.id===$('#reading-select').value);selected=dailySelected;const url=new URL(location.href);url.searchParams.set('reading',selected.id);history.replaceState(null,'',url);renderReading();};
for(const testament of ['舊約','新約']) {
 const group=document.createElement('optgroup');group.label=testament;
 for(const book of books.filter(b=>b.testament===testament)){const option=document.createElement('option');option.value=book.id;option.textContent=`${book.name}（${book.chapters} ${book.id==='PSA'?'篇':'章'}）`;group.append(option);}
 $('#book-select').append(group);
}
$('#book-select').onchange=()=>changePersonal($('#book-select').value,1);
$('#chapter-select').onchange=()=>changePersonal($('#book-select').value,Number($('#chapter-select').value));
$('#save-personal').onclick=()=>save();
$('#ask-question').onclick=askQuestion;
$('#journal-form').onsubmit=e=>{e.preventDefault();save();};$('#journal-form').oninput=()=>{dirty=true;updateMeta();};$('#complete').onclick=()=>save(true);
$('#send-command').onclick=command;$('#command').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();command();}};
 document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>showView(b.dataset.view));$('#search').oninput=renderEntries;
$('#share').onclick=async()=>{const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('reading',selected.id);try{if(navigator.share)await navigator.share({title:`靜讀｜${selected.ref}`,url:url.href});else{await navigator.clipboard.writeText(url.href);toast('讀經連結已複製，不含你的私人筆記。');}}catch(e){if(e.name!=='AbortError')prompt('複製讀經連結（不含筆記）：',url.href);}};
$('#export').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),entries},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`still-journal-${today}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已產生備份檔案，請妥善保存。');};
$('#import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>10*1024*1024)throw new Error();const data=JSON.parse(await file.text());if(data.version!==1||!validEntries(data.entries))throw new Error();const existing=new Set(entries.map(x=>`${x.date}/${x.readingId}`));const additions=data.entries.filter(x=>!existing.has(`${x.date}/${x.readingId}`));const unique=new Map(additions.map(x=>[`${x.date}/${x.readingId}`,{date:x.date,readingId:x.readingId,status:x.status,marks:[...x.marks],...(x.discussion?{discussion:x.discussion.map(turn=>({id:turn.id,question:turn.question,answer:turn.answer,status:turn.status,createdAt:turn.createdAt}))}:{}),...Object.fromEntries(fieldNames.map(f=>[f,x[f]]))}]));if(persist([...entries,...unique.values()])){renderEntries();renderReading();toast(`已匯入 ${unique.size} 篇日記，現有同日同經文的筆記保留原樣。`);}}catch{toast('匯入失敗：請選擇有效的靜讀 JSON 備份（上限 10 MB）。');}e.target.value='';};
$('#about').onclick=()=>$('#about-dialog').showModal();$('#close-about').onclick=()=>$('#about-dialog').close();window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
showView(activeView);loadGPTConfig().then(renderDiscussion);if(loadError)toast('現有筆記無法讀取或瀏覽器不允許儲存。為保護資料，已停止寫入；請檢查瀏覽器儲存設定。');
