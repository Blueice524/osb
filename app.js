import { readings } from './readings.js';
import { readingBackground, validFHLSourceURL } from './chapter-backgrounds.js';
import { snapshotLink, readSnapshot, snapshotDocument } from './share.js';
import { books, personalReading } from './bible.js';
import {apiBase, serviceConfigLoaded, loadStudyConfig, queryStudy} from './study-service.js';
import {studySources, allowedStudyURL, validSources, validBackground, validDiscussion} from './sources.js';
const resolveReading = id => readings.find(r=>r.id===id) || personalReading(id);
const $ = s => document.querySelector(s);
const key = 'still-journal-v1';
const fieldNames = ['observation','interpretation','reflection','application','prayer','question','tags'];
const discussionErrors = new Map();
const requests=new Map(),unsavedReplies=new Map();
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
let backgroundReady=Promise.resolve();
function toast(message) { $('#toast').textContent=message; $('#toast').style.display='block'; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').style.display='none',4500); }
function validEntries(data) {
 return Array.isArray(data) && data.length <= 10000 && data.every(e=>e && typeof e==='object' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && typeof e.readingId==='string' && !!resolveReading(e.readingId) && ['started','completed'].includes(e.status) && fieldNames.every(f=>typeof e[f]==='string' && e[f].length<=100000) && Array.isArray(e.marks) && e.marks.length<=1000 && e.marks.every(m=>typeof m==='string' && m.length<=100000) && validDiscussion(e.discussion) && (e.background===undefined||validBackground(e.background)));
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
 if(selected.background)entry.background=selected.background;
 if(entry.discussion)entry.discussion=entry.discussion.map(turn=>{turn={...turn,...(unsavedReplies.get(turn.id)||{})};const draft=[...document.querySelectorAll('#discussion-thread textarea')].find(input=>input.dataset.turnId===turn.id);return draft?{...turn,answer:draft.value}:turn;});
 return entry;
}
function storeEntry(entry) {
 const next=entries.filter(e=>!(e.date===entry.date&&e.readingId===entry.readingId));next.push(entry);
 if(!persist(next)) return false;for(const turn of entry.discussion||[])unsavedReplies.delete(turn.id);dirty=false; updateMeta();renderMarks();renderDiscussion();return true;
}
function save(complete=false) { const entry=collect();if(complete)entry.status='completed';if(storeEntry(entry))toast(complete?'今天的讀經已完成，也已儲存。':'今天的日記已儲存。'); }
function updateMeta() {$('#day-label').textContent=`Day ${current()?countDays():countDays()+1}`;$('#session-state').textContent=dirty?'有尚未儲存的內容':current()?.status==='completed'?'✓ 今日已完成':current()?'已儲存 · 進行中':'尚未記錄';}
function renderMarks() {
 $('#marks').replaceChildren();
 for(const mark of current()?.marks||[]) {const div=document.createElement('div');div.className='mark-item';const text=document.createElement('span');text.textContent=`⭐ ${mark}`;const button=document.createElement('button');button.className='text-button';button.textContent='移除';button.setAttribute('aria-label',`移除標記：${mark}`);button.onclick=()=>{const e=collect();e.marks=e.marks.filter(m=>m!==mark);if(storeEntry(e))toast('已移除標記。');};div.append(text,button);$('#marks').append(div);}
}
function renderReading() {
 const r=selected;$('#theme-tag').textContent=r.tag;$('#passage').textContent=r.ref;$('#reading-title').textContent=r.theme;$('#summary').textContent=r.summary;$('#interpretation').textContent=r.interpretation;$('#prayer').textContent=r.prayer;
 $('#bible-link').href=`https://www.bible.com/zh-TW/bible/40/${r.verse}.CNV`;
 $('#questions').replaceChildren(...r.questions.map(q=>{const li=document.createElement('li');li.textContent=q;return li;}));
 $('#reading-select').value=dailySelected.id;
 const personal=activeView==='personal';
 const savedBackground=current()?.background||r.background;
 if(savedBackground){r.background=savedBackground;r.context=savedBackground.paragraphs.join('\n\n');r.contextSources=savedBackground.sources;}else{r.context='';r.contextSource='';r.contextURL='';r.contextSources=[];}
 renderContext(r.context,'','',r.contextSources);
 $('#context-status').hidden=true;
 backgroundReady=loadBackground(r);
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
 dirty=false;updateMeta();renderMarks();renderDiscussion();
}
function sourceLinks(sources){
 const container=document.createElement('div');container.className='source-links';
 for(const source of sources){if(!allowedStudyURL(source.url))continue;const link=document.createElement('a');link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=source.title;container.append(link);}
 return container;
}
function renderContext(text,source='',sourceURL='',sources=[]) {
 $('#context').replaceChildren(...text.split(/\n\n+/).filter(Boolean).map(paragraph=>{const p=document.createElement('p');p.textContent=paragraph;return p;}));
 $('#context-source').replaceChildren();$('#context-source').hidden=!sources.length&&!source;
 if(sources.length){$('#context-source').append(document.createTextNode('引用出處：'),sourceLinks(sources));}else $('#context-source').textContent=source?`資料來源：${source}`:'';
 $('#context-reference').hidden=false;
 $('#context-reference').replaceChildren(document.createTextNode('查詢範圍：'),sourceLinks(studySources));
}
async function loadBackground(reading) {
 const id=reading.id;$('#context-status').textContent='正在查找指定來源並整理本章背景…';$('#context-status').hidden=false;
 try {
  const background=await readingBackground(id);
  if(selected.id!==id||!['today','personal'].includes(activeView))return;
  selected.background=background;selected.context=background.paragraphs.join('\n\n');selected.contextSources=background.sources;
  renderContext(selected.context,'','',background.sources);$('#context-status').hidden=true;
  const existing=current();if(existing){const updated={...existing,background};if(!persist(entries.map(e=>entryKey(e)===entryKey(existing)?updated:e)))toast('背景已顯示，但尚未儲存成功。');}
 }catch(error){
  if(selected.id!==id||!['today','personal'].includes(activeView))return;
  if(!selected.background){selected.context='';selected.contextSources=[];renderContext('');}
  $('#context-status').textContent=error.message;$('#context-status').hidden=false;
 }
}
function discussionTurn(turn,editable=false) {
 const article=document.createElement('article');article.className='discussion-turn';
 const q=document.createElement('p');q.className='discussion-question';q.textContent=`你：${turn.question}`;article.append(q);
 const answer=document.createElement('p');answer.className='discussion-answer';
 answer.textContent=turn.status==='answered'?`${turn.origin==='web'?'查考回覆':'既有貼回的回覆'}：\n${turn.answer}`:turn.status==='pending'?(requests.has(entryKey(baseEntry()))?'正在查找資料並整理回覆…':'上次查詢尚未完成，可再次詢問。'):turn.status==='error'?'此次查考未取得回答，問題已保存，可再次詢問。':'既有問題尚未取得回覆。';
 article.append(answer);if(turn.sources?.length)article.append(sourceLinks(turn.sources));
 if(editable&&turn.status==='opened'){
  const label=document.createElement('label');label.className='reply-label';label.textContent='貼上 GPT 回覆';
  const input=document.createElement('textarea');input.placeholder='把原 GPT 的回答貼在這裡，再儲存到本段經文。';input.maxLength=100000;input.value=turn.answer;input.dataset.turnId=turn.id;
  label.append(input);article.append(label);
  const button=document.createElement('button');button.type='button';button.className='button save-gpt-reply';button.textContent='儲存回覆';
  button.onclick=()=>{const value=input.value.trim();if(!value){toast('請先貼上 GPT 回覆。');return;}const entry=collect();entry.discussion=(entry.discussion||[]).map(t=>t.id===turn.id?{...t,answer:value,status:'answered'}:t);if(storeEntry(entry))toast('回覆已保存在本段經文，可於日記中搜尋。');};article.append(button);
 }
 return article;
}
function renderDiscussion() {
 const identity=entryKey(baseEntry()),busy=requests.has(identity);
 $('#ask-question').disabled=!serviceConfigLoaded||busy;$('#ask-question').textContent=busy?'查考中…':'詢問';
 $('#discussion-status').textContent=discussionErrors.get(identity)||'';
 $('#discussion-notice').textContent=!serviceConfigLoaded?'正在確認查考服務…':apiBase?'問題與本段先前討論會傳送至 AI 查考服務，依指定公開來源整理並附出處；其他心得與禱告不會傳送。':'自動查考服務尚未連接；你仍可保留問題。';
 const drafts=new Map([...document.querySelectorAll('#discussion-thread textarea')].map(input=>[input.dataset.turnId,input.value]));
 $('#discussion-thread').replaceChildren(...(current()?.discussion||[]).map(turn=>discussionTurn({...turn,...(unsavedReplies.get(turn.id)||{}),...(turn.status==='opened'&&drafts.has(turn.id)?{answer:drafts.get(turn.id)}:{})},true)));
}
async function askQuestion() {
 const question=$('#journal-form').elements.question.value.trim();
 if(!question){toast('請先填入想探討的問題。');$('#journal-form').elements.question.focus();return;}
 if(question.length>6000){toast('請將問題縮短至 6,000 字以內。');return;}
 const entry=collect(),identity=entryKey(entry);
 if(requests.has(identity))return;
 if((entry.discussion?.length||0)>=100){toast('本段討論已達 100 則，請先匯出備份後另開新紀錄。');return;}
 const history=(entry.discussion||[]).filter(t=>t.status==='answered').slice(-6).map(t=>({question:t.question.slice(0,1000),answer:t.answer.slice(0,2000)}));
 const turn={id:crypto.randomUUID(),question,answer:'',status:'pending',origin:'web',sources:[],createdAt:new Date().toISOString()};
 entry.discussion=[...(entry.discussion||[]),turn];if(!storeEntry(entry))return;
 discussionErrors.delete(identity);const controller=new AbortController();requests.set(identity,controller);renderDiscussion();
 let result;
 try{const answer=await queryStudy({mode:'question',readingId:entry.readingId,question,history},controller.signal);result={answer:answer.paragraphs.join('\n\n'),sources:answer.sources,status:'answered'};}
 catch(error){result={answer:'',sources:[],status:'error'};discussionErrors.set(identity,error.message);}
 finally{requests.delete(identity);}
 const existing=entries.find(e=>entryKey(e)===identity);
 if(existing?.discussion?.some(t=>t.id===turn.id)){
  const updated={...existing,discussion:existing.discussion.map(t=>t.id===turn.id?{...t,...result}:t)};
  if(!persist(entries.map(e=>entryKey(e)===identity?updated:e))){unsavedReplies.set(turn.id,result);discussionErrors.set(identity,'回覆已顯示，但尚未儲存成功，請保留此頁並檢查瀏覽器容量。');}
 }
 if(entryKey(baseEntry())===identity){renderDiscussion();updateMeta();}if(activeView==='journal')renderEntries();
}
function showView(view) {
 if(location.hash.startsWith('#shared=')){const url=new URL(location.href);url.hash='';history.replaceState(null,'',url);$('#share').hidden=false;}
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
  const remove=document.createElement('button');remove.className='text-button';remove.textContent='刪除這篇日記';remove.onclick=()=>{if(confirm('確定刪除這篇日記？建議先匯出備份。')){if(persist(entries.filter(x=>x!==e))){requests.get(entryKey(e))?.abort();for(const turn of e.discussion||[])unsavedReplies.delete(turn.id);renderEntries();renderReading();toast('已刪除日記。');}}};article.append(remove);root.append(article);
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
let shareSnapshot=null,shareURL='',shareGeneration=0;
$('#share').onclick=async()=>{
 if(['today','personal'].includes(activeView)){let pending;do{pending=backgroundReady;await pending;}while(['today','personal'].includes(activeView)&&pending!==backgroundReady);}
 const generation=++shareGeneration;
 shareSnapshot={version:1,reading:{...selected},entry:collect(),day:current()?countDays():countDays()+1,commandDraft:$('#command').value,gptPrompt:''};
 shareURL='';$('#share-url').value='';$('#share-url-label').hidden=true;$('#copy-share').disabled=true;$('#send-share').hidden=true;$('#share-state').textContent='正在準備完整內容…';$('#share-dialog').showModal();
 try {
  const url=validSharedSnapshot(shareSnapshot)?await snapshotLink(shareSnapshot,location.href):null;if(generation!==shareGeneration)return;
  if(!url){$('#share-state').textContent='內容較多，完整連結可能被通訊軟體截斷。請使用「下載完整頁面」分享，所有內容都會保留。';return;}
  shareURL=url;$('#share-url').value=url;$('#share-url-label').hidden=false;$('#copy-share').disabled=false;$('#send-share').hidden=typeof navigator.share!=='function';$('#share-state').textContent='完整內容已準備好，請確認願意分享上述所有欄位後複製或傳送。';
 }catch{$('#share-state').textContent='目前無法產生連結，請使用「下載完整頁面」，仍會包含所有欄位。';}
};
$('#close-share').onclick=()=>$('#share-dialog').close();
$('#copy-share').onclick=async()=>{try{await navigator.clipboard.writeText(shareURL);$('#share-state').textContent='完整讀經連結已複製，包含目前頁面的全部筆記與問答。';}catch{$('#share-state').textContent='無法自動複製，請選取上方完整連結手動複製。';$('#share-url').focus();$('#share-url').select();}};
$('#send-share').onclick=async()=>{try{await navigator.share({title:`靜讀｜${shareSnapshot.reading.ref}`,url:shareURL});}catch(error){if(error.name!=='AbortError')$('#share-state').textContent='無法開啟系統分享，請改用複製連結或下載完整頁面。';}};
$('#download-share').onclick=()=>{
 if(!shareSnapshot)return;
 const blob=new Blob([snapshotDocument(shareSnapshot)],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=`still-shared-${shareSnapshot.entry.date}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('#share-state').textContent='完整頁面已下載，可將 HTML 檔案傳給朋友，使用瀏覽器開啟。';
};
function validSharedSnapshot(snapshot) {
 const r=snapshot?.reading;
 return snapshot?.version===1 && Number.isInteger(snapshot.day) && snapshot.day>=1 && snapshot.day<=10001 && validEntries([snapshot.entry]) && r?.id===snapshot.entry.readingId && ['ref','theme','tag','summary','context','interpretation','prayer','verse'].every(field=>typeof r[field]==='string'&&r[field].length<=100000) && r.verse===resolveReading(r.id).verse && (r.contextSources===undefined||validSources(r.contextSources)) && (r.contextURL===undefined || r.contextURL==='' || validFHLSourceURL(r.contextURL)) && (r.contextSource===undefined || (typeof r.contextSource==='string'&&r.contextSource.length<=1200)) && Array.isArray(r.questions) && r.questions.length===2 && r.questions.every(q=>typeof q==='string'&&q.length<=100000) && ['commandDraft','gptPrompt'].every(field=>typeof snapshot[field]==='string'&&snapshot[field].length<=100000);
}
async function openSharedSnapshot() {
 if(!location.hash.startsWith('#shared='))return;
 document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!=='shared');document.querySelectorAll('.nav').forEach(e=>e.classList.remove('active'));$('#share').hidden=true;
 try {
  const snapshot=await readSnapshot(location.hash);if(!validSharedSnapshot(snapshot))throw new Error('invalid snapshot');
  $('#shared-meta').textContent=`${snapshot.entry.date} · Day ${snapshot.day} · ${snapshot.entry.status==='completed'?'已完成':'進行中'} · ${personalReading(snapshot.entry.readingId)?'個人讀經進度':'每日靈糧'}`;
  // Parse only our own escaped, script-free document and adopt its content.
  const documentSnapshot=new DOMParser().parseFromString(snapshotDocument(snapshot),'text/html');
  $('#shared-content').replaceChildren(...[...documentSnapshot.querySelector('.columns').children].map(node=>document.importNode(node,true)));
 }catch{$('#shared-meta').textContent='無法開啟這份分享：連結可能不完整、內容過大或瀏覽器不支援。請向分享者索取完整頁面檔案。';$('#shared-content').replaceChildren();}
}
$('#exit-shared').onclick=()=>{const url=new URL(location.href);url.hash='';history.replaceState(null,'',url);$('#share').hidden=false;showView(personalReading(selected.id)?'personal':'today');};
$('#export').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),entries},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`still-journal-${today}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已產生備份檔案，請妥善保存。');};
$('#import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>10*1024*1024)throw new Error();const data=JSON.parse(await file.text());if(data.version!==1||!validEntries(data.entries))throw new Error();const existing=new Set(entries.map(x=>`${x.date}/${x.readingId}`));const additions=data.entries.filter(x=>!existing.has(`${x.date}/${x.readingId}`));const unique=new Map(additions.map(x=>[`${x.date}/${x.readingId}`,{date:x.date,readingId:x.readingId,status:x.status,marks:[...x.marks],...(x.background?{background:x.background}:{}),...(x.discussion?{discussion:x.discussion.map(turn=>({id:turn.id,question:turn.question,answer:turn.answer,status:turn.status,createdAt:turn.createdAt,...(turn.origin?{origin:turn.origin}:{}),...(turn.sources?{sources:turn.sources}:{}),}))}:{}),...Object.fromEntries(fieldNames.map(f=>[f,x[f]]))}]));if(persist([...entries,...unique.values()])){renderEntries();renderReading();toast(`已匯入 ${unique.size} 篇日記，現有同日同經文的筆記保留原樣。`);}}catch{toast('匯入失敗：請選擇有效的靜讀 JSON 備份（上限 10 MB）。');}e.target.value='';};
$('#about').onclick=()=>$('#about-dialog').showModal();$('#close-about').onclick=()=>$('#about-dialog').close();window.addEventListener('beforeunload',e=>{if(dirty||unsavedReplies.size){e.preventDefault();e.returnValue='';}});
if(location.hash.startsWith('#shared='))openSharedSnapshot();else showView(activeView);loadStudyConfig().then(renderDiscussion);if(loadError)toast('現有筆記無法讀取或瀏覽器不允許儲存。為保護資料，已停止寫入；請檢查瀏覽器儲存設定。');
