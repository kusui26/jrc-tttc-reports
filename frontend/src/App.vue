// frontend/src/App.vue
<<template>
  <div>
    <header style="padding:12px 16px;border-bottom:1px solid #eee">
      <h1 style="margin:0;font-size:18px">{{ meta.title }}</h1>
      <div style="color:#666">{{ subtitleWithPeriod }}</div>
    </header>

    <div style="display:flex;gap:12px;align-items:center;padding:10px 16px;border-bottom:1px solid #eee">
      <label>データセット：
        <select v-model="dataset">
          <option value="jan">日本語</option>
          <option value="en">英語</option>
        </select>
      </label>

      <label>クラスタ：
        <select v-model="filterCluster">
          <option value="__ALL__">すべて</option>
          <option v-for="c in clusters" :key="c.cluster_id" :value="String(c.cluster_id)">
            {{ c.cluster_label }} ({{ c.size }})
          </option>
        </select>
      </label>

      <label>キーワード検索：
        <input v-model="keyword" type="search" :placeholder="searchPlaceholder" />
      </label>

      <span style="color:#777">
        件数: {{ filtered.length.toLocaleString() }} / クラスタ: {{ clusters.length }}
      </span>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;padding:12px 16px">
      <div id="plot" style="height:72vh;border:1px solid #eee;border-radius:10px"></div>

      <div style="border:1px solid #eee;border-radius:10px;padding:12px;max-height:72vh;overflow:auto">
        <h3 style="margin-top:0">クラスタ概要</h3>
        <ul>
          <li v-for="c in clusters" :key="c.cluster_id" style="margin-bottom:10px">
            <span :style="{display:'inline-block',width:'10px',height:'10px',borderRadius:'50%',marginRight:'6px',border:'1px solid rgba(0,0,0,.25)',background:c.color}"></span>
            <strong>{{ c.cluster_label }}</strong> <span style="color:#777">({{ c.size }})</span>
            <div v-if="c.examples?.length" style="color:#777">
              <div v-for="e in c.examples" :key="e">・{{ e }}</div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";

let plotlyLoader;
const loadPlotly = () => {
  if (!plotlyLoader) {
    plotlyLoader = import("plotly.js-dist-min").then((mod) => mod.default ?? mod);
  }
  return plotlyLoader;
};

let drawPromise = null;
let drawRequested = false;
let clickBound = false;

const meta = ref({ title: "TTTC Reports", subtitle: "" });
const data = ref([]);
const clusters = ref([]);

const dataset = ref("jan"); // ← 追加：現在のデータセット（jan/en）
const filterCluster = ref("__ALL__");
const keyword = ref("");

const searchPlaceholder = computed(() =>
  dataset.value === "en"
    ? "e.g., delay OR onboard sales"
    : "例: 遅延 OR 車内販売"
);

const subtitleWithPeriod = computed(() => {
  const base = meta.value.subtitle || "";
  const period =
    dataset.value === "jan"
      ? "2025-08-07--2025-08-12"
      : "2025-08-10--2025-09-08";
  return base ? `${base} （期間：${period}）` : `期間：${period}`;
});

const reKeyword = computed(() => {
  const kw = keyword.value.trim();
  return kw ? new RegExp(kw.replace(/\s+OR\s+/gi, "|"), "i") : null;
});

const filtered = computed(() =>
  data.value.filter((d) => {
    const okC =
      filterCluster.value === "__ALL__" ||
      String(d.cluster_id) === String(filterCluster.value);
    const okK =
      !reKeyword.value ||
      reKeyword.value.test(d.text_display) ||
      reKeyword.value.test(d.text_raw || "");
    return okC && okK;
  })
);

const colorFor = (cid) => {
  const m = clusters.value.find((c) => String(c.cluster_id) === String(cid));
  return m?.color || "#9aa1a7";
};

async function draw() {
  if (drawPromise) {
    drawRequested = true;
    return drawPromise;
  }

  const execute = async () => {
    const Plotly = await loadPlotly();

    const xs = filtered.value.map((d) => d.x);
    const ys = filtered.value.map((d) => d.y);
    const colors = filtered.value.map((d) => colorFor(d.cluster_id));
    const text = filtered.value.map((d) => d.text_display);
    const custom = filtered.value.map((d) => [
      d.id,
      d.url,
      d.date,
      d.cluster_label,
    ]);

    const trace = {
      x: xs,
      y: ys,
      text,
      customdata: custom,
      mode: "markers",
      type: "scattergl",
      marker: { size: 6, opacity: 0.85, color: colors },
      hovertemplate:
        "<b>%{customdata[3]}</b><br>id: %{customdata[0]}<br>%{text}<br>%{customdata[2]}<extra></extra>",
    };
    const layout = {
      margin: { l: 20, r: 10, t: 10, b: 30 },
      xaxis: { showgrid: false, showticklabels: false, zeroline: false },
      yaxis: { showgrid: false, showticklabels: false, zeroline: false },
    };

    await Plotly.react("plot", [trace], layout, {
      displayModeBar: true,
      responsive: true,
    });

    if (!clickBound) {
      const plot = document.getElementById("plot");
      plot?.on("plotly_click", (ev) => {
        const url = ev?.points?.[0]?.customdata?.[1];
        if (url) window.open(url, "_blank");
      });
      clickBound = true;
    }
  };

  drawRequested = false;
  drawPromise = execute();
  try {
    await drawPromise;
  } finally {
    drawPromise = null;
    if (drawRequested) return draw();
  }
}

async function loadDataset(key) {
  const base = `/data/${key}`;
  const [m, d, c] = await Promise.all([
    fetch(`${base}/meta.json`).then((r) => r.json()),
    fetch(`${base}/data.json`).then((r) => r.json()),
    fetch(`${base}/clusters.json`).then((r) => r.json()),
  ]);
  meta.value = m;
  data.value = d;
  clusters.value = c;
}

// 初期表示
onMounted(async () => {
  const plotlyReady = loadPlotly();
  await loadDataset(dataset.value);
  await plotlyReady;
  await draw();
});

// データセット変更 → 再読込＆フィルタ初期化 → 描画
watch(dataset, async () => {
  filterCluster.value = "__ALL__";
  keyword.value = "";
  const plotlyReady = loadPlotly();
  await loadDataset(dataset.value);
  await plotlyReady;
  await draw();
});

// フィルタや検索が変わったら再描画
watch([filtered, filterCluster, keyword], () => {
  void draw();
});
</script>
