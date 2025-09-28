// server/index.js
const express = require("express");
const path = require("path");
const app = express();

const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(PUBLIC_DIR, "data");
const APP_DIR = path.join(PUBLIC_DIR, "app");

// /data は常に最新（キャッシュ不可）
app.use(
    "/data",
    (req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); },
    express.static(DATA_DIR, { fallthrough: false })
);

// フロント（ビルド成果物）
// ※ HTML は no-store、その他(assets等)は1日キャッシュ
app.use(express.static(APP_DIR, {
    etag: true,
    maxAge: "1d",
    setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-store");
        }
    }
}));

// SPA フォールバック（任意パス → index.html）も no-store
app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(APP_DIR, "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server http://localhost:${port}`));