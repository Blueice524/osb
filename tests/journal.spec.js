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

for (const [view,reading,passage] of [['daily','matthew-6','馬太福音 6:25–34'],['personal','personal-GEN-1','創世記 1 章']]) {
 test(`${view} GPT handoff copies only relevant context, saves replies, searches and restores backups`,async({page,context})=>{
  const target='https://chatgpt.com/g/g-study-test';
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await page.route('**/gpt-config.json',route=>route.fulfill({json:{gpt_url:target}}));
  await context.route('https://chatgpt.com/**',route=>route.fulfill({body:'Test GPT destination'}));
  await page.goto(`/?reading=${reading}`);
  await page.getByLabel('個人心得／領受').fill('不要把這段私人心得傳給GPT');await page.getByLabel('我的禱告').fill('私人的禱告');
  await page.getByLabel('還想問的問題').fill('如何理解這章的上下文？');
  const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'詢問',exact:true}).click();const popup=await popupPromise;await popup.waitForLoadState();expect(popup.url()).toBe(target);await popup.close();
  await expect(page.locator('#discussion-status')).toContainText('問題已複製');
  let prompt=await page.evaluate(()=>navigator.clipboard.readText());expect(prompt).toContain(passage);expect(prompt).toContain('如何理解這章的上下文');expect(prompt).not.toContain('私人心得');expect(prompt).not.toContain('私人的禱告');
  await page.getByLabel('貼上 GPT 回覆').fill('先看文體與上下文，不要脫離段落。<script>alert(1)</script>');await page.getByRole('button',{name:'儲存回覆'}).click();
  await page.reload();await expect(page.locator('#discussion-thread')).toContainText('先看文體與上下文');
  await page.getByLabel('還想問的問題').fill('那應該怎樣應用？');const secondPopup=page.waitForEvent('popup');await page.getByRole('button',{name:'詢問',exact:true}).click();await (await secondPopup).close();
  await expect(page.locator('#discussion-status')).toContainText('問題已複製');prompt=await page.evaluate(()=>navigator.clipboard.readText());expect(prompt).toContain('先看文體與上下文');expect(prompt).toContain('那應該怎樣應用');
  await page.getByLabel('貼上 GPT 回覆').fill('尚未確認的回覆草稿');await page.getByRole('button',{name:'我的日記',exact:true}).click();
  await page.locator('#search').fill('文體與上下文');await expect(page.locator('.entry')).toHaveCount(1);await expect(page.locator('.entry')).toContainText('GPT 回覆（由你貼回）');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'匯出備份'}).click();const path=await (await downloadPromise).path();
  await page.evaluate(()=>localStorage.clear());await page.reload();await page.getByRole('button',{name:'我的日記',exact:true}).click();await page.locator('#import').setInputFiles(path);await page.locator('#search').fill('文體與上下文');await expect(page.locator('.entry')).toContainText('先看文體與上下文');
  await page.getByRole('button',{name:view==='daily'?'每日靈糧':'個人讀經進度',exact:true}).click();await expect(page.getByLabel('貼上 GPT 回覆')).toHaveValue('尚未確認的回覆草稿');
 });
}
test('plugin identifiers use an explicitly manual ChatGPT handoff rather than a fabricated GPT URL',async({page})=>{
 await page.route('**/gpt-config.json',route=>route.fulfill({json:{gpt_url:'plugin://gpt-f875f4e5f25b9633318d3546b0abdb7c@openai-curated-remote'}}));
 await page.goto('/');await expect(page.locator('#discussion-notice')).toContainText('自行選用');await expect(page.getByRole('button',{name:'詢問',exact:true})).toBeEnabled();await expect(page.locator('#gpt-direct-link')).toHaveAttribute('href','https://chatgpt.com/');
 await page.getByLabel('還想問的問題').fill('未連接仍可存下這個問題');await page.getByRole('button',{name:'儲存今天的日記'}).click();await page.reload();await expect(page.getByLabel('還想問的問題')).toHaveValue('未連接仍可存下這個問題');
});

test('manual handoff shows the prompt when clipboard access is denied',async({page,context})=>{
 await page.route('**/gpt-config.json',route=>route.fulfill({json:{gpt_url:''}}));
 await context.route('https://chatgpt.com/**',route=>route.fulfill({body:'Test ChatGPT destination'}));
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('denied');}}});});
 await page.goto('/?reading=personal-REV-22');await page.getByLabel('還想問的問題').fill('這一章如何帶出盼望？');
 const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'詢問',exact:true}).click();const popup=await popupPromise;await popup.waitForLoadState();expect(popup.url()).toBe('https://chatgpt.com/');await popup.close();
 await expect(page.locator('#discussion-status')).toContainText('請手動複製');await expect(page.locator('#gpt-prompt')).toHaveValue(/啟示錄 22 章/);await expect(page.locator('#gpt-prompt')).toHaveValue(/這一章如何帶出盼望/);
 await page.reload();await expect(page.locator('#discussion-thread')).toContainText('這一章如何帶出盼望');
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

test('personal chapter backgrounds show only the selected chapter, one or two sourced paragraphs, and share the summary',async({page,context,browser})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.route('**/chapter-backgrounds.json',route=>route.fulfill({json:{version:1,chapters:{'GEN.1':{paragraphs:['測試資料：創世記第一章背景摘要。','測試資料：第一章的文學脈絡。'],source:'測試背景資料，第 1 頁'},'GEN.2':{paragraphs:['測試資料：創世記第二章獨立背景。'],source:'測試背景資料，第 2 頁'}}}}));
 await page.goto('/?reading=personal-GEN-1');await expect(page.locator('#context p')).toHaveCount(2);await expect(page.locator('#context')).toContainText('第一章的文學脈絡');await expect(page.locator('#context-source')).toHaveText('資料來源：測試背景資料，第 1 頁');
 await page.getByLabel('個人心得／領受').fill('背景載入不應該改動這段心得');
 await page.locator('#chapter-select').selectOption('2');await expect(page.locator('#context p')).toHaveCount(1);await expect(page.locator('#context')).toHaveText('測試資料：創世記第二章獨立背景。');await expect(page.locator('#context')).not.toContainText('第一章');
 const link=await copyFullShare(page);const friend=await browser.newPage();await friend.goto(link);await expect(friend.locator('#shared-content')).toContainText('創世記第二章獨立背景');await expect(friend.locator('#shared-content')).toContainText('測試背景資料，第 2 頁');await friend.close();
 await page.locator('#chapter-select').selectOption('3');await expect(page.locator('#context')).toBeEmpty();await expect(page.locator('#context-source')).toBeHidden();await expect(page.locator('#context-status')).toHaveText('本章背景資料尚未提供。');
 await page.getByRole('button',{name:'每日靈糧',exact:true}).click();await expect(page.locator('#context')).not.toBeEmpty();await expect(page.locator('#context-status')).toBeHidden();
});

test('delayed background loading preserves notes and never inserts an earlier chapter into the latest selection',async({page})=>{
 let release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/chapter-backgrounds.json',async route=>{await gate;await route.fulfill({json:{version:1,chapters:{'GEN.1':{paragraphs:['第一章背景'],source:'測試來源'},'GEN.2':{paragraphs:['第二章背景'],source:'測試來源'}}}});});
 await page.goto('/?reading=personal-GEN-1');await expect(page.locator('#context-status')).toContainText('查找');await page.getByLabel('個人心得／領受').fill('等待時輸入的第一章心得');await page.locator('#chapter-select').selectOption('2');await page.getByLabel('個人心得／領受').fill('等待時輸入的第二章心得');release();
 await expect(page.locator('#context')).toHaveText('第二章背景');await expect(page.getByLabel('個人心得／領受')).toHaveValue('等待時輸入的第二章心得');
 await page.locator('#chapter-select').selectOption('1');await expect(page.getByLabel('個人心得／領受')).toHaveValue('等待時輸入的第一章心得');await expect(page.locator('#context')).toHaveText('第一章背景');
});

test('unavailable or invalid background data never masquerades as chapter commentary',async({page})=>{
 await page.route('**/chapter-backgrounds.json',route=>route.fulfill({json:{version:1,chapters:{'GEN.1':{paragraphs:['一','二','三'],source:'測試來源'}}}}));
 await page.goto('/?reading=personal-GEN-1');await expect(page.locator('#context')).toBeEmpty();await expect(page.locator('#context-status')).toContainText('暫時無法載入');await expect(page.locator('#context-source')).toBeHidden();
});

test('personal backgrounds provide the requested FHL source link and preserve it in shares',async({page,context,browser})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 const sourceURL='https://bible.fhl.net/index.html';
 await page.route('**/chapter-backgrounds.json',route=>route.fulfill({json:{version:1,chapters:{'GEN.1':{paragraphs:['僅供測試的背景摘要，不是信望愛原文。'],source:'測試用來源標註',sourceURL}}}}));
 await page.goto('/?reading=personal-GEN-1');await expect(page.locator('#context')).toContainText('僅供測試');await expect(page.locator('#context-source-link')).toHaveAttribute('href',sourceURL);await expect(page.locator('#context-source-link')).toHaveText('出處：信望愛聖經工具 · 閱讀原文 ↗');
 const link=await copyFullShare(page);const friend=await browser.newPage();await friend.goto(link);await expect(friend.locator('#shared-content a').filter({hasText:'出處：信望愛聖經工具'})).toHaveAttribute('href',sourceURL);await friend.close();
 await page.locator('#chapter-select').selectOption('2');await expect(page.locator('#context')).toBeEmpty();await expect(page.locator('#context-source-link')).toHaveText('參考網站：信望愛聖經工具 ↗');
});
