// tttc/generate.mjs
import fs from "fs-extra";
import { csvParse } from "d3-dsv";

const CONFIG_PATH = "tttc/configs/scatter_config.json";
const OUT_ROOT = "server/public/data";

const asNum = (v, fb = null) => (Number.isFinite(Number(v)) ? Number(v) : fb);

// Tableau 10（見やすい定性パレット）
const PALETTE = [
    "#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F",
    "#EDC948", "#B07AA1", "#FF9DA7", "#9C755F", "#BAB0AC"
];
const NOISE_GRAY = "#9AA1A7";
const NOISE_RATIO_GRAY_MAX = 0.05;

async function buildOneDataset({ key, input_csv }, cfg) {
    const outDir = `${OUT_ROOT}/${key}`;
    const csvText = await fs.readFile(input_csv, "utf-8");
    const rows = csvParse(csvText);
    const c = cfg.columns;

    const data = rows.map(r => ({
        id: String(r[c.id] ?? ""),
        text_display: String(r[c.text_display] ?? ""),
        text_raw: String(r[c.text_raw] ?? ""),
        date: String(r[c.date] ?? ""),
        url: String(r[c.url] ?? ""),
        cluster_id: r[c.cluster_id] === undefined ? null : Number(r[c.cluster_id]),
        cluster_label: String(r[c.cluster_label] ?? ""),
        cluster_summary: String(r[c.cluster_summary] ?? ""),
        x: asNum(r[c.x]),
        y: asNum(r[c.y])
    })).filter(d => d.id && Number.isFinite(d.x) && Number.isFinite(d.y));

    // 集計（サイズ順）
    const cmap = new Map();
    for (const d of data) {
        const keyId = d.cluster_id ?? -1;
        const e = cmap.get(keyId) || {
            cluster_id: keyId,
            cluster_label: d.cluster_label || (keyId === -1 ? "ノイズ" : `クラスター ${keyId}`),
            size: 0, examples: []
        };
        e.size++;
        if (e.examples.length < 5 && d.text_display) e.examples.push(d.text_display);
        cmap.set(keyId, e);
    }
    const clusters = [...cmap.values()].sort((a, b) => b.size - a.size);

    // 色（大きい -1 には色、閾値未満の -1 はグレー）
    const total = data.length;
    let pIndex = 0;
    for (const cl of clusters) {
        const isNoise = cl.cluster_id === -1;
        const ratio = cl.size / total;
        if (isNoise && ratio < NOISE_RATIO_GRAY_MAX) cl.color = NOISE_GRAY;
        else { cl.color = PALETTE[pIndex % PALETTE.length]; pIndex++; }
    }

    const meta = {
        title: cfg.ui?.title || "TTTC Reports",
        subtitle: cfg.ui?.subtitle || "",
        rows_total: data.length,
        clusters_total: clusters.length,
        dataset_key: key,
        generated_at: new Date().toISOString()
    };

    await fs.ensureDir(outDir);
    await fs.writeJson(`${outDir}/data.json`, data);
    await fs.writeJson(`${outDir}/clusters.json`, clusters);
    await fs.writeJson(`${outDir}/meta.json`, meta);

    console.log(`[OK] ${key}: ${data.length} rows, ${clusters.length} clusters -> ${outDir}`);
}

(async () => {
    const cfg = JSON.parse(await fs.readFile(CONFIG_PATH, "utf-8"));

    // 後方互換：datasets が無ければ単一入力として jan 扱い
    const datasets = Array.isArray(cfg.datasets) && cfg.datasets.length
        ? cfg.datasets
        : [{ key: "jan", input_csv: cfg.input_csv }];

    // 入力チェック
    for (const ds of datasets) {
        if (!ds.key || !ds.input_csv) {
            throw new Error(`Invalid dataset entry: ${JSON.stringify(ds)}`);
        }
        if (!(await fs.pathExists(ds.input_csv))) {
            throw new Error(`CSV not found: ${ds.input_csv}`);
        }
    }

    for (const ds of datasets) {
        await buildOneDataset(ds, cfg);
    }
})();
