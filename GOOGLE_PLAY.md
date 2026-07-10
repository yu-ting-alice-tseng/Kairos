# Kairos 上架 Google Play 指南

Kairos 以 TWA（Trusted Web Activity）形式上架：Play 商店裡的 App 其實是一層原生殼，
內容直接載入 `https://kairos-alicetseng-project.vercel.app`。
網站部署即更新，**App 本身不需要重新送審**（除非換網域或改 App 設定）。

> ⚠️ App 會永久綁定上面這個網域。未來若換成自訂網域，需要重新打包、重新送審。

---

## 第 0 步：程式端準備（已完成 ✅）

以下都已在 repo 裡，push 部署後生效：

- `public/manifest.json` — 含 `id`、`scope`、圖示、shortcuts
- `public/sw.js` + `src/components/providers/PWARegister.tsx` — service worker（離線 fallback）
- `public/offline.html` — 離線頁
- `public/.well-known/assetlinks.json` — 數位資產連結（**指紋待填**，見第 3 步）

## 第 1 步：註冊 Google Play 開發者帳號

1. 前往 https://play.google.com/console 註冊（一次性 US$25，需信用卡＋身分驗證，1–2 天審核）
2. 帳號類型選「個人」即可

> 📌 **新個人帳號的隱藏門檻**：正式上架前，Google 要求先進行**封閉測試**——
> 邀請約 12–20 位測試者、持續 14 天後，才能申請正式發布權限。
> 找朋友同學幫忙掛測試名單即可，實務上是最花時間的一步。

## 第 2 步：用 PWABuilder 打包

1. 開 https://www.pwabuilder.com ，輸入 `https://kairos-alicetseng-project.vercel.app`
2. 等它跑完檢測（manifest / service worker 應該都是綠燈）
3. 點 **Package for Stores → Android**，設定：
   - **Package ID**: `app.vercel.kairos_alicetseng_project.twa`（要跟 assetlinks.json 一致）
   - **App name**: `Kairos — 墨時`
   - **Signing key**: 選「New」讓 PWABuilder 產生，**下載的 zip 裡的 signing key 檔案要永久備份**（遺失就無法更新 App）
4. 下載 zip，裡面有 `.aab`（上傳 Play 用）和 `assetlinks.json`

## 第 3 步：填入簽章指紋

1. 在 Play Console 建立應用程式並上傳 `.aab` 後，到
   **Play Console → 你的應用 → Setup → App signing**，
   複製 **App signing key certificate** 的 **SHA-256 fingerprint**
2. 貼到本 repo `public/.well-known/assetlinks.json` 的
   `sha256_cert_fingerprints` 陣列（取代 `REPLACE_WITH_...` 佔位字串）。
   若 PWABuilder 的 zip 裡也有一組指紋，兩組都放進陣列最保險：
   ```json
   "sha256_cert_fingerprints": ["AA:BB:...", "CC:DD:..."]
   ```
3. Push 部署後驗證：
   https://kairos-alicetseng-project.vercel.app/.well-known/assetlinks.json 要能打開
4. 沒做對的症狀：App 打開時上方出現瀏覽器網址列

## 第 4 步：Play Console 商店資訊

必填項目：

- 應用程式名稱、簡短說明（80 字）、完整說明（4000 字）
- 圖示 512×512、主題圖片 1024×500
- 至少 2 張手機截圖（手機開 Kairos 截圖即可）
- 隱私權政策網址：`https://kairos-alicetseng-project.vercel.app/privacy` ✅（已有）
- 內容分級問卷、資料安全表單（Kairos 收集：email、姓名、日曆資料 — 據實申報）

## 第 5 步：測試 → 上架

1. 建立**封閉測試**版本，上傳 `.aab`，邀請測試者（email 名單）
2. 滿 14 天後申請正式發布權限
3. 通過後把版本推到 **Production**，審核通常 1–7 天

## 之後的維護

- 網站功能更新：照常 push → Vercel 部署，App 自動看到新版，**不用動 Play**
- 需要重新上傳 `.aab` 的情況：換網域、換 App 名稱/圖示、Google 要求提高 target SDK（約一年一次，用 PWABuilder 重打包即可）
