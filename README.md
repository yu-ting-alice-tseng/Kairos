This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Windows 自動同步

本機修改檔案後，約 60 秒會自動 commit，並每 30 分鐘從 GitHub 拉回新的 commit（例如在 Claude 雲端 session 做的修改）。**不會自動推送**：推送到 `main` 等於讓 Vercel 部署到正式網站，所以發布要手動進行。

- **安裝**：雙擊 `install-auto-sync.bat` 一次即可。它會建立排程工作「Kairos Auto Sync」，登入時自動在背景啟動，不會出現視窗。若顯示錯誤，請按右鍵選「以系統管理員身分執行」。
- **發布**：雙擊 `push-now.bat`，會先 commit、pull，再推送到 `main`，Vercel 隨後自動部署。還沒推送的 commit 只存在本機，請記得定期發布。請 Claude 修改之前也建議先發布一次，避免 Claude 在舊版本上工作。
- **Log**：`auto-sync.log`（在 repo 根目錄，不會被 commit）。
- **移除**：雙擊 `uninstall-auto-sync.bat`，會刪除排程工作並結束背景監控程式。
- **出現 `bad object refs/desktop.ini`**：雙擊 `fix-git-desktop-ini.bat`。
- **衝突**：若遠端和本機改到同幾行，同步會自動還原並停止，記錄在 log 中，需要手動解決。

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
