import {test,expect} from '@playwright/test';
async function copyFullShare(page) {
 await page.getByRole('button',{name:'分享讀經頁'}).click();
 await expect(page.getByRole('button',{name:'複製完整連結'})).toBeEnabled();
 await page.getByRole('button',{name:'複製完整連結'}).click();
 const url=await page.evaluate(()=>navigator.clipboard.readText());
 await page.locator('#close-share').click();
 return url;
}

test('journal saves, persists, marks, completes, searches and creates a full share snapshot',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.goto('/?reading=matthew-6');
 await page.getByLabel('個人心得／領受').fill('今天練習把焦慮交給神 <script>alert(1)</script>');
 await page.getByRole('button',{name:'儲存今天的日記'}).click();
 await expect(page.locator('#session-state')).toContainText('已儲存');
 await page.reload();
 await expect(page.getByLabel('個人心得／領受')).toHaveValue('今天練習把焦慮交給神 <script>alert(1)</script>');
 await page.locator('#command').fill('mark 先照顧今天的小事');await page.locator('#send-command').click();
 await expect(page.locator('#marks')).toContainText('先照顧今天的小事');
 await page.getByRole('button',{name:'✓ 今天結束'}).click();
 await page.getByRole('button',{name:'讀經足跡',exact:true}).click();
 await expect(page.locator('.stat').first()).toContainText('1');
 await page.getByRole('button',{name:'我的日記',exact:true}).click();
 await page.locator('#search').fill('焦慮');await expect(page.locator('.entry')).toHaveCount(1);
 await page.locator('#search').fill('不存在的字');await expect(page.locator('.entry')).toHaveCount(0);
 const clipboard=await copyFullShare(page);
 expect(clipboard).toContain('reading=matthew-6#shared=');
 const other=await context.browser().newContext();const otherPage=await other.newPage();await otherPage.goto('http://127.0.0.1:5173/?reading=matthew-6');await expect(otherPage.getByLabel('個人心得／領受')).toHaveValue('');await other.close();
});
test('export/import restores notes and malformed backup is rejected',async({page})=>{
 await page.goto('/?reading=psalm-23');await page.getByLabel('我的禱告').fill('求你今天陪伴我');await page.getByRole('button',{name:'儲存今天的日記'}).click();
 await page.getByRole('button',{name:'我的日記',exact:true}).click();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'匯出備份'}).click();const download=await downloadPromise;const path=await download.path();
 await page.evaluate(()=>localStorage.clear());await page.reload();await page.getByRole('button',{name:'我的日記',exact:true}).click();await page.locator('#import').setInputFiles(path);await expect(page.locator('.entry')).toContainText('求你今天陪伴我');
 await page.locator('#import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":1,"entries":[{}]}')});await expect(page.locator('#toast')).toContainText('匯入失敗');await expect(page.locator('.entry')).toHaveCount(1);
});
test('mobile layout, passage switch and questions work',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.locator('#reading-select').selectOption('james-1');await expect(page.locator('#passage')).toHaveText('雅各書 1:19–27');
 await page.locator('#command').fill('如何在工作中實踐？');await page.locator('#send-command').click();await expect(page.getByLabel('還想問的問題')).toHaveValue('如何在工作中實踐？');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});

test('blocked storage never reports a successful save',async({page})=>{
 await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('blocked','QuotaExceededError');};});
 await page.goto('/');await page.getByLabel('個人心得／領受').fill('不應該被假稱已儲存');await page.getByRole('button',{name:'儲存今天的日記'}).click();await expect(page.locator('#toast')).toContainText('儲存失敗');await expect(page.locator('#session-state')).toHaveText('有尚未儲存的內容');
});

test('personal reading covers the full canon and preserves separate progress and journal fields',async({page})=>{
 await page.goto('/?reading=matthew-6');
 await expect(page.locator('.site-header .brand')).toHaveText('✳ 靜讀');
 await expect(page.locator('nav .nav').nth(1)).toHaveText('個人讀經進度');
 await page.getByLabel('個人心得／領受').fill('每日靈糧的心得');
 await page.getByRole('button',{name:'個人讀經進度',exact:true}).click();
 await expect(page.locator('#personal-picker')).toBeVisible();await expect(page.locator('.verse-card')).toBeHidden();
 await expect(page.locator('#book-select option')).toHaveCount(66);
 await page.locator('#book-select').selectOption('PSA');await expect(page.locator('#chapter-select option')).toHaveCount(150);
 await page.locator('#chapter-select').selectOption('150');await expect(page.locator('#personal-passage')).toHaveText('詩篇 150 篇');
 await page.getByLabel('觀察',{exact:true}).fill('我觀察到讚美的邀請');
 await page.getByLabel('理解／查考',{exact:true}).fill('需要留意詩歌文體');
 await page.getByLabel('個人心得／領受').fill('在音樂中回應');
 await page.getByLabel('今天的小行動').fill('今天練習感恩');
 await page.getByLabel('我的禱告').fill('願我記得讚美');
 await page.getByLabel('還想問的問題').fill('這篇在詩集中的位置？');
 await page.getByLabel('主題標籤').fill('讚美、感恩');
 await page.locator('#command').fill('mark 凡有氣息的');await page.locator('#send-command').click();
 await page.getByRole('button',{name:'✓ 今天結束'}).click();
 await page.locator('#book-select').selectOption('JUD');await expect(page.locator('#chapter-select option')).toHaveCount(1);
 await page.locator('#book-select').selectOption('REV');await expect(page.locator('#chapter-select option')).toHaveCount(22);
 await page.locator('#chapter-select').selectOption('22');await page.getByLabel('個人心得／領受').fill('最後一章的心得');
 await page.getByRole('button',{name:'每日靈糧',exact:true}).click();await expect(page.getByLabel('個人心得／領受')).toHaveValue('每日靈糧的心得');
 await page.getByRole('button',{name:'個人讀經進度',exact:true}).click();await expect(page.getByLabel('個人心得／領受')).toHaveValue('最後一章的心得');
 await page.reload();await expect(page.locator('#personal-passage')).toHaveText('啟示錄 22 章');await expect(page.getByLabel('個人心得／領受')).toHaveValue('最後一章的心得');
 await page.getByRole('button',{name:'我的日記',exact:true}).click();await page.locator('#search').fill('詩篇 150');await expect(page.locator('.entry')).toHaveCount(1);
 for(const text of ['我觀察到讚美的邀請','需要留意詩歌文體','在音樂中回應','今天練習感恩','願我記得讚美','這篇在詩集中的位置？','讚美、感恩','凡有氣息的','已完成','個人讀經進度'])await expect(page.locator('.entry')).toContainText(text);
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'匯出備份'}).click();const download=await downloadPromise;const path=await download.path();
 await page.evaluate(()=>localStorage.clear());await page.reload();await page.getByRole('button',{name:'我的日記',exact:true}).click();await page.locator('#import').setInputFiles(path);await page.locator('#search').fill('詩篇 150');await expect(page.locator('.entry')).toContainText('我觀察到讚美的邀請');
});

test('legacy journal records remain readable, personal sharing and mobile layout work',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.addInitScript(()=>{if(!localStorage.getItem('still-journal-v1'))localStorage.setItem('still-journal-v1',JSON.stringify([{date:'2026-01-01',readingId:'matthew-6',status:'completed',marks:['舊標記'],observation:'舊觀察',interpretation:'',reflection:'舊心得',application:'',prayer:'',question:'',tags:''}]));});
 await page.setViewportSize({width:390,height:844});await page.goto('/?reading=personal-GEN-50');await expect(page.locator('#personal-passage')).toHaveText('創世記 50 章');
 await page.getByLabel('個人心得／領受').fill('私人內容不進入分享');await page.getByRole('button',{name:'儲存當日進度與筆記'}).click();
 expect(await copyFullShare(page)).toContain('reading=personal-GEN-50#shared=');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/personal-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'我的日記',exact:true}).click();await page.locator('#search').fill('2026-01-01');await expect(page.locator('.entry')).toContainText('舊心得');await expect(page.locator('.entry')).toContainText('舊標記');
});

test('failed save prevents changing personal progress and keeps the unsaved reflection',async({page})=>{
 await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('blocked','QuotaExceededError');};});
 await page.goto('/?reading=personal-GEN-1');await page.getByLabel('個人心得／領受').fill('這段未儲存的文字需要保留');await page.locator('#book-select').selectOption('EXO');
 await expect(page.locator('#book-select')).toHaveValue('GEN');await expect(page.locator('#personal-passage')).toHaveText('創世記 1 章');await expect(page.getByLabel('個人心得／領受')).toHaveValue('這段未儲存的文字需要保留');await expect(page.locator('#session-state')).toContainText('尚未儲存');await expect(page.locator('#toast')).toContainText('儲存失敗');
});

for(const reading of ['matthew-6','personal-PSA-150']) {
 test(`full snapshot shares every field, drafts and discussion for ${reading} without overwriting the recipient`,async({page,context,browser})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);await page.goto(`/?reading=${reading}`);
  await page.evaluate(readingId=>{
   const d=new Date(),date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
   const record={date,readingId,status:'completed',marks:['珍藏的一句話'],observation:'觀察欄完整分享',interpretation:'理解欄完整分享',reflection:'心得欄完整分享',application:'行動欄完整分享',prayer:'禱告欄完整分享',question:'問題欄完整分享',tags:'標籤完整分享',discussion:[{id:'answered-turn',question:'已回答的問題',answer:'分享的回答 <img src=x onerror=alert(1)>',status:'answered',createdAt:new Date().toISOString()},{id:'draft-turn',question:'還在想的問題',answer:'先前草稿',status:'opened',createdAt:new Date().toISOString()}]};
   localStorage.setItem('still-journal-v1',JSON.stringify([record,{...record,date:'2020-01-01',reflection:'其他日期不在這份分享中'}]));
  },reading);
  await page.reload();await page.getByLabel('觀察',{exact:true}).fill('尚未按儲存的觀察');await page.getByLabel('貼上 GPT 回覆').fill('尚未按儲存的回答草稿');await page.locator('#command').fill('尚未送出的自然輸入');
  const link=await copyFullShare(page);expect(link.length).toBeLessThanOrEqual(8000);
  const recipient=await browser.newContext();const friend=await recipient.newPage();
  await friend.goto('http://127.0.0.1:5173/');await friend.getByLabel('個人心得／領受').fill('接收者原本的私人筆記');await friend.getByRole('button',{name:'儲存今天的日記'}).click();const before=await friend.evaluate(()=>localStorage.getItem('still-journal-v1'));
  await friend.goto(link);await expect(friend.locator('#shared')).toBeVisible();
  for(const text of ['尚未按儲存的觀察','理解欄完整分享','心得欄完整分享','行動欄完整分享','禱告欄完整分享','問題欄完整分享','標籤完整分享','珍藏的一句話','已回答的問題','分享的回答 <img src=x onerror=alert(1)>','還在想的問題','尚未按儲存的回答草稿','尚未送出的自然輸入','經文背景','留給今天的兩個問題','禱告引導'])await expect(friend.locator('#shared-content')).toContainText(text);
  await expect(friend.locator('#shared-meta')).toContainText('已完成');await expect(friend.locator('#shared-content')).not.toContainText('其他日期不在這份分享中');expect(await friend.locator('#shared-content img').count()).toBe(0);
  expect(await friend.evaluate(()=>localStorage.getItem('still-journal-v1'))).toBe(before);
  await friend.reload();await expect(friend.locator('#shared-content')).toContainText('心得欄完整分享');
  await friend.locator('#exit-shared').click();await expect(friend.locator('#shared')).toBeHidden();expect(await friend.evaluate(()=>localStorage.getItem('still-journal-v1'))).toBe(before);await recipient.close();
  // Sharing a draft must not silently save or replace the author's local entry.
  const author=JSON.parse(await page.evaluate(()=>localStorage.getItem('still-journal-v1')));expect(author.find(e=>e.date!=='2020-01-01').observation).toBe('觀察欄完整分享');
 });
}

test('oversized sharing preserves every field in a standalone HTML document',async({page,context,browser})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await page.goto('/?reading=matthew-6');
 const longText='完整內容'.repeat(15000)+'最後一行也必須保留';await page.getByLabel('觀察',{exact:true}).fill(longText);await page.getByLabel('我的禱告').fill('完整禱告不得遺漏');
 await page.getByRole('button',{name:'分享讀經頁'}).click();await expect(page.locator('#share-state')).toContainText('內容較多');await expect(page.locator('#copy-share')).toBeDisabled();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'下載完整頁面'}).click();const path=await (await pending).path();
 const fs=await import('node:fs/promises');const html=await fs.readFile(path,'utf8');expect(html).toContain(longText);expect(html).toContain('完整禱告不得遺漏');expect(html).toContain('經文背景');
 const reader=await browser.newPage();await reader.setContent(html);await expect(reader.locator('body')).toContainText('最後一行也必須保留');await expect(reader.locator('script')).toHaveCount(0);await reader.close();
});

test('invalid shared payloads do not write to the recipient journal',async({page})=>{
 await page.goto('/#shared=g1.invalid');await expect(page.locator('#shared')).toBeVisible();await expect(page.locator('#shared-meta')).toContainText('無法開啟這份分享');expect(await page.evaluate(()=>localStorage.getItem('still-journal-v1'))).toBeNull();
 await page.locator('#exit-shared').click();await expect(page.getByLabel('個人心得／領受')).toBeVisible();
});

for(const reading of ['matthew-6','personal-GEN-1']) {
 test(`blank fields remain empty in shared links and downloaded pages for ${reading}`,async({page,context,browser})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);await page.goto(`/?reading=${reading}`);
  await page.getByLabel('個人心得／領受').fill('這是我自己填寫的心得');await page.getByLabel('主題標籤').fill('（未填寫）');
  const link=await copyFullShare(page);const friend=await browser.newPage();await friend.goto(link);await expect(friend.locator('#shared')).toBeVisible();
  const right=friend.locator('#shared-content > div').nth(1);
  const blankLabels=['觀察','理解／查考','今天的小行動','我的禱告','還想問的問題','Mark','經文探討紀錄'];
  for(const label of blankLabels){const section=right.locator('section').filter({has:friend.getByRole('heading',{name:label,exact:true})});await expect(section.locator('p')).toHaveText('');}
  await expect(right).toContainText('這是我自己填寫的心得');
  await expect(right.locator('section').filter({has:friend.getByRole('heading',{name:'主題標籤',exact:true})}).locator('p')).toHaveText('（未填寫）');
  for(const hint of ['經文裡，哪個細節讓你停下來？','你如何理解這段經文？','用自己的話，和神說說。'])await expect(right).not.toContainText(hint);
  await page.getByRole('button',{name:'分享讀經頁'}).click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'下載完整頁面'}).click();const path=await (await pending).path();
  const fs=await import('node:fs/promises');const html=await fs.readFile(path,'utf8');await friend.setContent(html);
  for(const label of blankLabels)await expect(friend.locator('.columns > div').nth(1).locator('section').filter({has:friend.getByRole('heading',{name:label,exact:true})}).locator('p')).toHaveText('');
  await friend.close();
 });
}


const citedSource={title:'Test-only StudyLight commentary',url:'https://www.studylight.org/commentaries/eng/test/genesis-1.html'};
const answerResult=paragraphs=>({paragraphs,sources:[citedSource],fetchedAt:new Date().toISOString()});
async function serviceFixture(page,handler){await page.route('**/study-service.json',route=>route.fulfill({json:{apiBase:'/api'}}));await page.route('**/api/study',handler);}
for(const reading of ['matthew-6','personal-GEN-1']){
 test(`automatic research answers below the question, preserves sources, exports and shares for ${reading}`,async({page,context,browser})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);const requests=[];
  await serviceFixture(page,route=>{const body=route.request().postDataJSON();requests.push(body);return route.fulfill({json:answerResult(body.mode==='background'?['測試背景第一段。','測試背景第二段。']:['測試查考答案：先了解上下文，再辨別應用。<script>alert(1)</script>'])});});
  await page.goto(`/?reading=${reading}`);await expect(page.locator('#context p')).toHaveCount(2);await expect(page.locator('#context-source a')).toHaveAttribute('href',citedSource.url);await expect(page.locator('#context-reference a')).toHaveCount(6);
  await page.getByLabel('個人心得／領受').fill('不傳送的個人心得');await page.getByLabel('我的禱告').fill('不傳送的私人禱告');await page.getByLabel('還想問的問題').fill('這章的上下文如何影響理解？');await page.getByRole('button',{name:'詢問',exact:true}).click();
  await expect(page.locator('#discussion-thread')).toContainText('測試查考答案');await expect(page.locator('#discussion-thread a')).toHaveAttribute('href',citedSource.url);expect(requests.find(r=>r.mode==='question').readingId).toBe(reading);expect(JSON.stringify(requests)).not.toContain('不傳送的');
  await page.reload();await expect(page.locator('#discussion-thread')).toContainText('測試查考答案');
  await page.getByLabel('還想問的問題').fill('那要如何具體實踐？');await page.getByRole('button',{name:'詢問',exact:true}).click();await expect(page.locator('.discussion-turn')).toHaveCount(2);await expect(page.getByRole('button',{name:'詢問',exact:true})).toBeEnabled();expect(requests.filter(r=>r.mode==='question').at(-1).history[0].answer).toContain('測試查考答案');
  const record=JSON.parse(await page.evaluate(()=>localStorage.getItem('still-journal-v1'))).find(e=>e.readingId===reading);expect(record.discussion[0].sources[0].url).toBe(citedSource.url);expect(record.background.paragraphs).toHaveLength(2);
  const link=await copyFullShare(page);const friend=await browser.newPage();await friend.goto(link);await expect(friend.locator('#shared-content')).toContainText('測試查考答案');await expect(friend.locator('#shared-content a').filter({hasText:citedSource.title}).first()).toHaveAttribute('href',citedSource.url);await friend.close();
  await page.getByRole('button',{name:'我的日記',exact:true}).click();await page.locator('#search').fill('測試查考答案');await expect(page.locator('.entry')).toHaveCount(1);
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'匯出備份'}).click();const path=await (await pending).path();await page.evaluate(()=>localStorage.clear());await page.reload();await page.getByRole('button',{name:'我的日記',exact:true}).click();await page.locator('#import').setInputFiles(path);await expect(page.locator('.entry')).toContainText('測試查考答案');const restored=JSON.parse(await page.evaluate(()=>localStorage.getItem('still-journal-v1')));expect(restored[0].discussion[0].sources[0].url).toBe(citedSource.url);
 });
}

test('changing chapters during research never mixes background, answers, or new unsaved notes',async({page})=>{
 let release;const gate=new Promise(resolve=>release=resolve);
 await serviceFixture(page,async route=>{const body=route.request().postDataJSON();if(body.readingId==='personal-GEN-1')await gate;return route.fulfill({json:answerResult([body.mode==='background'?`${body.readingId} 的測試背景`:`${body.readingId} 的測試回答`])});});
 await page.goto('/?reading=personal-GEN-1');await page.getByLabel('個人心得／領受').fill('第一章心得');await page.getByLabel('還想問的問題').fill('第一章的問題');await page.getByRole('button',{name:'詢問',exact:true}).click();await expect(page.getByRole('button',{name:'查考中…'})).toBeDisabled();
 await page.locator('#chapter-select').selectOption('2');await page.getByLabel('個人心得／領受').fill('第二章尚未儲存的心得');release();await expect(page.locator('#context')).toHaveText('personal-GEN-2 的測試背景');await expect(page.locator('#discussion-thread')).not.toContainText('第一章');await expect(page.getByLabel('個人心得／領受')).toHaveValue('第二章尚未儲存的心得');
 await page.locator('#chapter-select').selectOption('1');await expect(page.locator('#discussion-thread')).toContainText('personal-GEN-1 的測試回答');await expect(page.getByLabel('個人心得／領受')).toHaveValue('第一章心得');
});

test('missing service, provider failures and uncited output do not become invented answers',async({page})=>{
 await page.goto('/?reading=personal-GEN-1');await expect(page.locator('#context-status')).toContainText('尚未連接');await page.getByLabel('還想問的問題').fill('仍需保留的疑問');await page.getByRole('button',{name:'詢問',exact:true}).click();await expect(page.locator('#discussion-status')).toContainText('尚未連接');await expect(page.locator('#discussion-thread')).toContainText('仍需保留的疑問');await expect(page.locator('#discussion-thread')).not.toContainText('查考回覆');
 await serviceFixture(page,route=>route.fulfill({json:{paragraphs:['沒有來源的假答案'],sources:[],fetchedAt:new Date().toISOString()}}));await page.reload();await page.getByRole('button',{name:'詢問',exact:true}).click();await expect(page.locator('#discussion-status')).toContainText('缺少有效內容或出處');await expect(page.locator('#discussion-thread')).not.toContainText('沒有來源的假答案');
});
