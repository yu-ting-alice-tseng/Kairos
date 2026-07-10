// Kairos — iPhone 主畫面小工具（Scriptable）
//
// 使用方式：
// 1. App Store 安裝免費的 Scriptable
// 2. 在 Scriptable 新增腳本，貼上這整個檔案
// 3. 把下面的 WIDGET_URL 換成你在 Kairos /widget 頁面複製的「API 網址」
// 4. 主畫面長按 → 加入小工具 → Scriptable → Script 選這個腳本
//
// 小工具每次刷新時會自動抓最新任務（iOS 約每 15–30 分鐘刷新一次）。

const WIDGET_URL = "PASTE_YOUR_API_URL_HERE"

// ── Kairos 品牌色 ──
const PAPER = new Color("#fbeacb")
const INK = new Color("#2a1f12")
const INK_LIGHT = new Color("#3d2e1a")
const BRAND = new Color("#ab3326")
const GOLD = new Color("#8a6b3e")

async function fetchData() {
  const req = new Request(WIDGET_URL)
  return await req.loadJSON()
}

function formatTime(iso, tz) {
  const d = new Date(iso)
  return d.toLocaleTimeString("zh-TW", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false })
}

async function buildWidget() {
  const widget = new ListWidget()
  widget.backgroundColor = PAPER
  widget.setPadding(14, 14, 12, 14)

  if (WIDGET_URL.includes("PASTE_YOUR")) {
    const warn = widget.addText("請先在腳本裡填入你的 API 網址（到 Kairos 的 /widget 頁面複製）")
    warn.font = Font.systemFont(12)
    warn.textColor = BRAND
    return widget
  }

  let data
  try {
    data = await fetchData()
  } catch (e) {
    const err = widget.addText("Kairos 連線失敗")
    err.font = Font.systemFont(12)
    err.textColor = BRAND
    return widget
  }

  // 標題列：今日任務 + 完成進度
  const header = widget.addStack()
  header.centerAlignContent()
  const title = header.addText("今日任務")
  title.font = Font.boldSystemFont(14)
  title.textColor = INK
  header.addSpacer()
  const progress = header.addText(`${data.completedCount}/${data.totalCount}`)
  progress.font = Font.mediumSystemFont(12)
  progress.textColor = GOLD

  widget.addSpacer(6)

  const family = config.widgetFamily || "medium"
  const maxRows = family === "large" ? 9 : family === "medium" ? 4 : 3

  if (data.tasks.length === 0) {
    widget.addSpacer()
    const empty = widget.addText("今天沒有待辦任務 🎉")
    empty.font = Font.systemFont(12)
    empty.textColor = INK_LIGHT
    empty.centerAlignText()
    widget.addSpacer()
  } else {
    for (const task of data.tasks.slice(0, maxRows)) {
      const row = widget.addStack()
      row.centerAlignContent()
      row.spacing = 6

      const chipText = task.scheduledStart
        ? formatTime(task.scheduledStart, data.timezone)
        : task.overdue ? "逾期" : task.deadline ? "今天" : "·"
      const chip = row.addText(chipText)
      chip.font = Font.mediumSystemFont(10)
      chip.textColor = task.overdue ? BRAND : GOLD

      const label = row.addText(task.title)
      label.font = Font.systemFont(12)
      label.textColor = INK
      label.lineLimit = 1
      row.addSpacer()

      widget.addSpacer(4)
    }
    if (data.tasks.length > maxRows) {
      const more = widget.addText(`… 還有 ${data.tasks.length - maxRows} 項`)
      more.font = Font.systemFont(10)
      more.textColor = GOLD
    }
  }

  widget.addSpacer()
  const footer = widget.addText("Kairos · 墨時")
  footer.font = Font.systemFont(9)
  footer.textColor = GOLD
  footer.rightAlignText()

  // 點小工具打開 Kairos
  widget.url = WIDGET_URL.split("/api/")[0] + "/today"
  // 提示 iOS 15 分鐘後可刷新
  widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000)

  return widget
}

const widget = await buildWidget()
if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  await widget.presentMedium()
}
Script.complete()
