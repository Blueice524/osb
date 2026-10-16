import {test,expect} from '@playwright/test';
test('journal saves, persists, marks, completes and searches without leaking in share URL',async({page,context})=>{
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
 await page.getByRole('button',{name:'分享讀經頁'}).click();
 const clipboard=await page.evaluate(()=>navigator.clipboard.readText());
 expect(clipboard).toContain('reading=matthew-6');expect(clipboard).not.toContain('焦慮');
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

test('legacy journal records remain readable, personal links share only the selected chapter, mobile fits',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.addInitScript(()=>{if(!localStorage.getItem('still-journal-v1'))localStorage.setItem('still-journal-v1',JSON.stringify([{date:'2026-01-01',readingId:'matthew-6',status:'completed',marks:['舊標記'],observation:'舊觀察',interpretation:'',reflection:'舊心得',application:'',prayer:'',question:'',tags:''}]));});
 await page.setViewportSize({width:390,height:844});await page.goto('/?reading=personal-GEN-50');await expect(page.locator('#personal-passage')).toHaveText('創世記 50 章');
 await page.getByLabel('個人心得／領受').fill('私人內容不進入分享');await page.getByRole('button',{name:'儲存當日進度與筆記'}).click();
 await page.getByRole('button',{name:'分享讀經頁'}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('reading=personal-GEN-50');expect(await page.evaluate(()=>navigator.clipboard.readText())).not.toContain('私人');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/personal-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'我的日記',exact:true}).click();await page.locator('#search').fill('2026-01-01');await expect(page.locator('.entry')).toContainText('舊心得');await expect(page.locator('.entry')).toContainText('舊標記');
});

test('failed save prevents changing personal progress and keeps the unsaved reflection',async({page})=>{
 await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('blocked','QuotaExceededError');};});
 await page.goto('/?reading=personal-GEN-1');await page.getByLabel('個人心得／領受').fill('這段未儲存的文字需要保留');await page.locator('#book-select').selectOption('EXO');
 await expect(page.locator('#book-select')).toHaveValue('GEN');await expect(page.locator('#personal-passage')).toHaveText('創世記 1 章');await expect(page.getByLabel('個人心得／領受')).toHaveValue('這段未儲存的文字需要保留');await expect(page.locator('#session-state')).toContainText('尚未儲存');await expect(page.locator('#toast')).toContainText('儲存失敗');
});
