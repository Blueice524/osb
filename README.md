# 靜讀

繁體中文讀經網站：每日靈糧、個人讀經進度、私人筆記、完整分享，以及附出處的自動背景與問答。

## 目前功能

- 新舊約 66 卷、1,189 章可選；每日靈糧保留 7 篇既有主題卡片。
- 兩頁背景依目前經文搜尋指定來源，整合一至兩段繁體中文摘要，下方附實際引用出處。
- 「還想問的問題」按「詢問」後直接在下方顯示回答與出處，支援同段追問；問題、回答、來源與背景摘要跟隨日記保存。
- 觀察、理解、心得、行動、禱告、問題、標籤、Mark 分別記錄；可搜尋、完成進度、統計、JSON 備份／匯入。
- 完整分享目前頁面的所有欄位與草稿；空白保持空白，不輸出 placeholder 或「未填寫」。朋友唯讀查看，不會覆寫自己的日記。過長時下載完整 HTML 頁面。

自動查考需要另外部署後端及 API 金鑰；程式推送到 GitHub Pages 並不代表此服務已啟用。目前沒有可用金鑰／部署憑證，真實外站查詢尚未完成驗證。未連線、沒有足夠來源或查詢失敗時，畫面會如實說明，不產生替代答案。

## 指定來源

- https://www.youtube.com/@CrossExamined
- https://bestcommentaries.com/
- https://www.studylight.org/
- https://www.tgcchinese.org/
- https://www.ccbiblestudy.org/index-T.htm
- https://www.churchinmarlboro.org/Biblestudy//Index.htm

後端先使用 OpenAI Responses 的 web_search（限定上述網域）取得實際引用，再以核准來源整合摘要。回覆必須有實際搜尋紀錄與引用，並通過來源白名單；否則回傳不足資料。來源搜尋不能保證所有頁面或字幕都可被搜尋引擎存取，也不代表每次都能查遍六站。

Best Commentaries 的書評目錄不能單獨支持章節解釋。YouTube watch 引用會查核 oEmbed 作者是否為 @CrossExamined，無法確認作者時不採用。只有標題而沒有文字／字幕內容的影片不能當作經文背景證據。AI 摘要仍須對照原文查核。

## 開發與測試

Node.js 24。使用現有 checkout，不需建立 worktree。

```bash
cd /workspace/osb
npm ci --cache /tmp/osb-npm-cache
npm run dev
npm run build
npm test
npm run test:server
```

瀏覽器測試使用 `/usr/bin/chromium`，或設定 `CHROMIUM_PATH`。AI 供應商測試使用明確標示的測試回覆，不是即時來源實測。

## 啟用自動查考

GitHub Pages 只能提供靜態檔，無法執行帶金鑰的查詢。已提供 `render.yaml`，可在 Render 以 Blueprint 匯入此儲存庫，部署 Node 後端；也可在支援 Node.js 24 的伺服器執行 `npm ci && npm run build && npm start`。

後端環境變數：

| 名稱 | 用途 |
| --- | --- |
| `STUDY_API_KEY` | 必填，OpenAI API 金鑰，僅在後端安全設定，API 用量另外計費 |
| `STUDY_MODEL` | 預設 `gpt-4.1`，須支援 Responses web_search 及 structured outputs |
| `STUDY_ALLOWED_ORIGINS` | 可選，逗號分隔的前端 origin；預設允許 `https://blueice524.github.io` 與本機開發，Render 原站會自動加入 |
| `STUDY_HOURLY_LIMIT` | 預設每個伺服器實例每小時 60 次未快取查考，最多 2 次並行 |
| `PORT` | 預設 8080，平台可覆寫 |

後端會提供 `/api/study`、`/api/health`、網站靜態檔及含 `/api` 的 `study-service.json`。`/api/health` 在未設定金鑰時回覆 503；只表示金鑰有無設定，不會代替實際供應商查詢測試。Render 的 `/` 健康檢查只驗證伺服器存活。

若繼續使用原 GitHub Pages 網址，請把部署後的公開 API 基底填入 `public/study-service.json`：`{"apiBase":"https://你的後端網址/api"}`，再推送發布。此檔只放公開 URL，禁止放金鑰。也可直接使用後端提供的完整網站，但網址變更會改變瀏覽器儲存來源，需要先匯出／匯入原有日記。

`npm start` 使用 Node 24 的 `--use-env-proxy`，以支援雲端環境現有 HTTPS proxy。雲端環境草稿中的金鑰／網域設定不會自動部署 Render，也不會將金鑰複製到正式伺服器；正式部署須在該平台安全設定金鑰。不要把金鑰貼在聊天、提交進 Git 或寫進前端。

目前只採匿名公開服務、單一實例內的流量上限及背景 24 小時快取；多實例擴充時需換成共用限流與快取。CORS 不是使用者認證，API 不依賴瀏覽器端秘密。

## 資料、隱私與分享

日記存在目前瀏覽器 localStorage。同裝置同瀏覽器會共用，清除資料／無痕視窗結束／換裝置可能失去存取，請定期備份。沒有登入、雲端日記同步或直接讀取原 GPT 私人知識庫的功能。

自動背景只傳經文；詢問會傳本段經文、問題及最近六段已回答討論（歷史答案會縮短為追問脈絡），其他心得與禱告不會傳送。後端不保存使用者問題、不記錄請求內文，OpenAI 請求設為 `store:false`；供應商仍依其服務政策處理傳送資料。舊版手動貼回的問答可繼續讀取與備份。

分享對話框會說明目前全部欄位與草稿的公開範圍。連結把快照放在 URL fragment，編碼不是加密，取得連結的人都能讀取、轉傳，副本無法撤回。後續編輯不會同步。連結上限 8,000 字元、解壓縮上限 120,000 bytes；過大時下載完整、跳脫使用者文字且無腳本的 HTML 檔案，不刪減內容。匯出與分享可能包含私密資料，請勿把日記檔案提交到 GitHub。

## GitHub Pages

Settings → Pages → Source: GitHub Actions。推送 main 自動發布；也可執行 Actions → Deploy 靜讀 to GitHub Pages → Run workflow。以實際工作流程的結果為準，程式已推送不代表部署成功。
