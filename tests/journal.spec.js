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
