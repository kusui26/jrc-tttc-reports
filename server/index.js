// server/index.js
const express = require("express");
const path = require("path");
const app = express();

const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(PUBLIC_DIR, "data");
const APP_DIR = path.join(PUBLIC_DIR, "app");

// /data は常に最新（キャッシュ不可）＋ fallthrough: false で 404 を返す
app.use("/data",
    (req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); },
    express.static(DATA_DIR, { fallthrough: false })
);

// フロント（Vue ビルド物）
app.use(express.static(APP_DIR, { maxAge: "1d", etag: true }));

// 最後に SPA フォールバック（※ /data には届かない）
app.use((_req, res) => {
    res.sendFile(path.join(APP_DIR, "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server http://localhost:${port}`));
