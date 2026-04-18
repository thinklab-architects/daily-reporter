# 一灣苑工程日報產生器

選單式輸入介面，零錯字產出標準格式的每日進度報告。

## 功能
- 日期選擇器（自動填星期）
- 回報者、天氣下拉
- 區段（♦️）+ 工項（🔹）+ 備註（💢）可動態增減
- 工種分類：人力 / 機具 / 材料（可自訂）
- 即時預覽 → 複製 / 下載 TXT / 下載 JSON / 本機草稿

**Live**: https://thinklab-architects.github.io/daily-reporter/

## 本地測試

```bash
python -m http.server 8000
# 打開 http://localhost:8000
```

或任何其他靜態伺服器（`npx serve`、VS Code Live Server 等）。

## 部署

已設定 `.github/workflows/deploy.yml`，push 到 `main` 會自動部署到 GitHub Pages。
首次上線前需在 Repo Settings → Pages → Source 選 **GitHub Actions**。

## 詞彙表

下拉選項來源：`vocabulary.json`。要新增工種/區域/天氣組合直接編輯即可，不需改程式。
