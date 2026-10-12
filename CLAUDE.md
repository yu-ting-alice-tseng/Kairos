@AGENTS.md

## Git 規則

- 一律直接在 `main` 工作、commit、push，不開分支、不開 PR。
- 推送前一定先 `git pull --rebase origin main`。
- 若 session 強制使用 `claude/…` 分支，完成後要自動 fast-forward 合併回 `main` 並推送：

  ```bash
  git push -u origin <分支>
  git checkout main && git pull --rebase origin main
  git merge --ff-only <分支> && git push origin main
  ```

- 推送到 `main` 會觸發 Vercel 正式環境部署（建置時會對正式資料庫執行 `scripts/migrate.mjs`），推送前要確認程式可以建置。
- 本機 Windows 有自動同步（`auto-sync.bat`），只會 commit 和 pull，不會自動推送；使用者用 `push-now.bat` 手動發布。
