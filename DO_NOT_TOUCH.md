# ⚠️ 高風險區域 — 改動前必讀

以下檔案和設定直接影響**登入、資料庫、API 安全性**。
除非任務明確是「修改登入 / 資料庫 / 認證邏輯」，否則**不要碰**。

---

## 🔐 認證核心（NextAuth）

| 檔案 | 說明 |
|------|------|
| `src/lib/auth.ts` | NextAuth 設定主檔：providers、adapter、callbacks、cookie 策略。改錯會直接導致登入失敗。 |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth route handler，不要動。 |
| `src/app/api/auth/demo/route.ts` | Demo 登入邏輯，改動需同步測試 demo 帳號功能。 |
| `src/app/auth/signin/page.tsx` | 登入頁面，內有 server action 呼叫 `signIn()`，改 UI 時不要動 form action。 |
| `src/app/auth/error/page.tsx` | 錯誤頁面，只改 UI 不改邏輯。 |

### 已知脆弱點
- `auth.ts` 的 `checks: ['state']` 是刻意設定，移除會導致 PKCE cookie 錯誤（Vercel 環境問題）
- `trustHost: true` 必須保留，否則 Vercel 部署會拒絕 host
- `session.strategy: 'jwt'` 不要改成 `database`，會破壞現有 session

---

## 🗄️ 資料庫（Prisma）

| 檔案 / 資料夾 | 說明 |
|------|------|
| `prisma/schema.prisma` | 資料庫結構定義。改動需執行 migration，且必須同步更新 Vercel 的資料庫。 |
| `src/lib/prisma.ts` | Prisma client 初始化，不要動。 |
| `src/generated/prisma/` | 自動產生的 Prisma 類型，**不要手動編輯**，執行 `prisma generate` 更新。 |

---

## 🌐 環境變數（Vercel）

以下變數**缺一不可**，且值必須正確：

| 變數 | 說明 |
|------|------|
| `AUTH_SECRET` | NextAuth JWT 簽名密鑰。改掉會讓所有現有 session 失效，所有人被登出。 |
| `AUTH_URL` | 必須設為正式網域（例如 `https://kairos-alicetseng-project.vercel.app`），不能是 preview URL。 |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `DATABASE_URL` | 資料庫連線字串，改動等於換資料庫 |
| `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` | Notion OAuth，改動會斷開 Notion 登入 |

> **Google Cloud Console** 的 Authorized redirect URIs 也必須包含：
> `https://kairos-alicetseng-project.vercel.app/api/auth/callback/google`

---

## 🔒 API 安全層

| 檔案 | 說明 |
|------|------|
| `src/lib/actions.ts` | Server actions，內有 `auth()` 身份驗證，改動時確認不要移除驗證邏輯。 |
| `src/app/api/*/route.ts` | 所有 API routes 開頭都有 session 驗證，改 API 時不要移除 `auth()` 呼叫。 |

---

## 📦 不要手動改的自動產生檔案

- `src/generated/` — 由 `prisma generate` 產生
- `.next/` — 由 `next build` 產生
- `package-lock.json` / `pnpm-lock.yaml` — 由套件管理器維護

---

## ✅ 安全改動的地方

這些地方可以自由改，不影響登入和資料：

- `src/app/(pages)/` — 頁面 UI
- `src/components/` — UI 元件
- `src/stores/useAppStore.ts` — 前端狀態（不涉及 DB）
- `src/app/globals.css` / Tailwind 樣式
- `public/` — 靜態資源
