import {
  catalog,
  inspectMemory,
  capacityFor,
  modelPlans,
  matchesCapability,
  isAiFusion2,
  canPostTrain,
} from "./source.js";
const root = document.getElementById("advisor-full"),
  body = root.querySelector("#af-content");
const state = {
  catalogPage: 1,
  modelTab: "results",
  planPage: 1,
  workTab: "results",
  resultGroup: "fit",
  resultSort: "memory",
  resultSearch: "",
  resultPage: 1,
  configGroup: 0,
  detailModel: 0,
  lang: "zh",
  page: "hardware",
  search: "",
  filter: "all",
  family: "all",
  sort: "name",
  expanded: null,
  selected: [],
  compare: false,
  values: {
    device: "1",
    count: "2",
    cap: "all",
    quant: "4",
    context: "32",
    concurrency: "1",
    accelerator: "1024",
    shard: "yes",
    model: "15",
    mquant: "8",
    mcontext: "128",
    mconcurrency: "4",
    util: "90",
  },
};
const T = (z, e) => (state.lang === "zh" ? z : e);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const missing = () => T("待补充", "Not recorded");
const fusion = isAiFusion2;
const devName = (n) =>
  state.lang === "zh"
    ? n
    : n
        .replaceAll("双 RTX", "Dual RTX")
        .replace("各 1 ×", "each with 1 ×")
        .replace(
          "总计 128GB，可分配 96GB 给 GPU",
          "128GB total / 96GB GPU-allocatable",
        )
        .replace("（AIO）", " (AIO)");
const ctx = (v) =>
  v >= 1048576
    ? (v / 1048576).toFixed(v % 1048576 ? 2 : 0) + "M"
    : v / 1024 + "K";
const num = (v, d = 1) =>
  v === null ? T("待校验", "Unverified") : Number(v).toFixed(d);
const pages = [
  ["hardware", "硬件找模型", "Hardware → models", null],
  ["model", "模型找硬件", "Model → hardware", null],
  ["models", "模型库", "Model library", catalog.M.length],
  ["devices", "设备库", "Device library", catalog.H.length],
  ["performance", "性能资料库", "Performance library", catalog.H.length],
];
const options = {
  device: () =>
    catalog.H.map((h, i) => [String(i), devName(h[0]), devName(h[0])]),
  model: () =>
    catalog.M.map((m, i) => ({ m, i }))
      .filter((x) => Number.isFinite(x.m[2]))
      .map(({ m, i }) => [String(i), m[0], m[0]]),
  quant: () => [
    ["4", "4-bit · Q4 / MXFP4", "4-bit · Q4 / MXFP4"],
    ["8", "8-bit · Q8 / FP8", "8-bit · Q8 / FP8"],
    ["16", "16-bit · FP16 / BF16", "16-bit · FP16 / BF16"],
  ],
  mquant: () =>
    catalog.M[+state.values.model]
      .slice(4)
      .map((q) => [String(q[1]), q[0], q[0]]),
  context: () =>
    [16, 32, 64, 128, 256, 512, 1024].map((v) => [
      String(v),
      v === 1024 ? "1M" : v + "K",
      v === 1024 ? "1M" : v + "K",
    ]),
  mcontext: () => options.context(),
  cap: () => [
    ["all", "全部开放模型", "All open-weight models"],
    ["reasoning", "推理 / Agent", "Reasoning / agent"],
    ["coding", "代码生成", "Code generation"],
    ["multimodal", "多模态 / 视觉", "Multimodal / vision"],
    ["document", "文档理解 / RAG", "Documents / RAG"],
    ["translation", "翻译 / 多语言", "Translation / multilingual"],
    ["text", "通用文本问答", "General text Q&A"],
  ],
  accelerator: () => [
    ["0", "无", "None"],
    ["320", "320GB", "320GB"],
    ["1024", "1TB", "1TB"],
  ],
  shard: () => [
    ["no", "否：仅做副本并发", "No: replicas only"],
    ["yes", "是：需验证运行时", "Yes: validate runtime"],
  ],
};
const fields = {
  device: [
    "已有设备",
    "Existing hardware",
    "select",
    "设备库 " + catalog.H.length + " 条配置",
    catalog.H.length + " device configurations",
  ],
  count: [
    "设备台数",
    "Machine count",
    "number",
    "用于区分副本与跨机分片",
    "Replicas vs. cross-device sharding",
  ],
  shard: [
    "允许跨设备分片",
    "Allow cross-device sharding",
    "select",
    "容量合计有前提，需验证运行时",
    "Pooled capacity requires runtime validation",
  ],
  accelerator: [
    "AI 加速卡（微调）",
    "AI accelerator (fine-tuning)",
    "select",
    "只用于微调规则，不增加推理显存",
    "Fine-tuning rule only; no added inference VRAM",
  ],
  cap: [
    "模型能力筛选",
    "Model capability filter",
    "select",
    "沿用原站名称规则，能力需进一步评测",
    "Original name-based rules; evaluate capabilities",
  ],
  quant: [
    "权重量化",
    "Weight quantization",
    "select",
    "按位宽筛选；实际格式以模型记录为准",
    "Filter by bit width; actual format comes from each model",
  ],
  context: [
    "上下文长度",
    "Context length",
    "select",
    "影响 KV；同时检查模型上下文上限",
    "Affects KV; check the model context limit",
  ],
  concurrency: [
    "峰值并发（同时用的人数）",
    "Peak concurrent users",
    "number",
    "沿用原站口径；不是账号总数",
    "Original workload definition; not total accounts",
  ],
  model: [
    "目标模型",
    "Target model",
    "select",
    catalog.M.filter((m) => Number.isFinite(m[2])).length + " 条可计算记录",
    catalog.M.filter((m) => Number.isFinite(m[2])).length +
      " calculable records",
  ],
  mquant: [
    "量化",
    "Quantization",
    "select",
    "选项来自所选模型记录",
    "Options from the selected model record",
  ],
  mcontext: [
    "上下文",
    "Context",
    "select",
    "容量计算与最大上下文校验",
    "Memory sizing and context-limit validation",
  ],
  mconcurrency: [
    "并发",
    "Concurrency",
    "number",
    "同时处理的请求 / 会话数需统一定义",
    "Use a consistent concurrent request/session definition",
  ],
  util: [
    "显存使用上限（%）",
    "VRAM utilization limit (%)",
    "number",
    "50–99%；标准默认 90%，Fusion 规则 95%",
    "50–99%; standard 90%, Fusion rule 95%",
  ],
};
function field(id) {
  const f = fields[id],
    wide = ["device", "model"].includes(id);
  const value = state.values[id];
  const control =
    f[2] === "select"
      ? `<select id="af-${id}" data-field="${id}" class="cursor-interaction">${options[
          id
        ]()
          .map(
            (o) =>
              `<option value="${o[0]}" ${value === o[0] ? "selected" : ""}>${esc(T(o[1], o[2]))}</option>`,
          )
          .join("")}</select>`
      : `<input id="af-${id}" data-field="${id}" type="${f[2]}" value="${esc(value)}" ${f[2] === "number" ? `min="${id === "util" ? 50 : ["count", "concurrency", "mconcurrency"].includes(id) ? 1 : 0}" ${id === "util" ? 'max="99"' : ""} step="1"` : ""} aria-describedby="af-${id}-hint">`;
  return `<label class="af-field ${wide ? "af-wide" : ""}" for="af-${id}"><span>${T(f[0], f[1])}</span>${control}<small id="af-${id}-hint">${T(f[3], f[4])}</small></label>`;
}
function group(z, e, ids, n) {
  return `<section class="af-group"><div class="af-group-title"><h3>${T(z, e)}</h3><small>${ids.length} ${T("项", "fields")} · ${T(n || "全部展开", "All visible")}</small></div><div class="af-fields">${ids.map(field).join("")}</div></section>`;
}
function dl(items) {
  return (
    "<dl>" +
    items.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("") +
    "</dl>"
  );
}
function link(url, label) {
  return url
    ? `<a href="${esc(url)}" target="_blank" rel="noopener">${label}</a>`
    : missing();
}
function memory(m, mode = "hardware") {
  const v = state.values;
  return inspectMemory(
    m,
    +(mode === "model" ? v.mquant : v.quant),
    +(mode === "model" ? v.mcontext : v.context),
    +(mode === "model" ? v.mconcurrency : v.concurrency),
    mode === "model" ? +v.util : 90,
  );
}
// The fork has directional estimates but no model-bound measurements.
function speed() {
  return null;
}
function tune(m) {
  const tier = +state.values.accelerator;
  if (!tier) return T("未选加速卡", "No accelerator");
  if (fusion(m)) return T("Fusion 不支持", "Fusion unsupported");
  return canPostTrain(m, tier)
    ? T("规则支持", "Rule supports")
    : T("规则不支持", "Rule excludes");
}
function status(m, c) {
  if (c.need === null) return ["pending", T("KV 待校验", "KV unverified")];
  if (!c.supported)
    return ["invalid", T("量化不支持", "Quantization unsupported")];
  if (!c.contextOK) return ["invalid", T("上下文超限", "Context exceeded")];
  const h = catalog.H[+state.values.device],
    capacity = capacityFor(
      +state.values.device,
      +state.values.count,
      state.values.shard === "yes",
    );
  return c.need <= capacity
    ? ["fit", T("容量满足", "Capacity fits")]
    : ["fail", T("容量不足", "Insufficient VRAM")];
}
function capability(m) {
  return matchesCapability(m[0], state.values.cap);
}
function modelDetail(m, mode = "hardware") {
  const c = memory(m, mode),
    source =
      m[0] === "Qwen3.5 9B"
        ? "https://huggingface.co/Qwen/Qwen3.5-9B"
        : m[0] === "Qwen3.8 27B"
          ? "https://huggingface.co/Qwen/Qwen3.8-27B"
          : null;
  const items = [
    [T("模型参数量", "Parameters"), m[1] + "B"],
    [
      T("最大上下文", "Maximum context"),
      m[3].toLocaleString() + " tokens (" + ctx(m[3]) + ")",
    ],
    [
      T("支持量化", "Supported quantizations"),
      m
        .slice(4)
        .map((q) => q[0])
        .join(" / "),
    ],
  ];
  if (Number.isFinite(m[2]))
    items.push(
      [T("KV / Token", "KV / token"), m[2].toLocaleString() + " B/token"],
      [T("KV 精度", "KV precision"), fusion(m) ? "Fusion 2.0 KV" : "Q8 KV"],
    );
  if (c.need !== null && c.supported && c.contextOK)
    items.push(
      [T("GPU 权重", "GPU weights"), num(c.w) + " GB"],
      [T("GPU KV 缓存", "GPU KV cache"), num(c.kv) + " GB"],
      [
        T("安全余量（含取整）", "Headroom incl. rounding"),
        num(c.reserve) + " GB · " + Math.round((1 - c.util) * 100) + "%",
      ],
      [T("建议 GPU 显存", "Recommended GPU VRAM"), num(c.need, 0) + " GB"],
    );
  if (fusion(m) && c.need !== null)
    items.push(
      [T("模型卸载到内存", "Weights offloaded to RAM"), c.off + " GB"],
      [T("缓存卸载到 SSD", "Cache offloaded to SSD"), num(c.ssd) + " GB"],
    );
  if (mode === "hardware" && +state.values.accelerator)
    items.push([T("微调规则", "Fine-tuning rule"), tune(m)]);
  if (source)
    items.push([
      T("来源链接", "Source link"),
      link(source, T("模型页", "Model page")),
    ]);
  return dl(items);
}
function deviceDetail(h) {
  const items = [
    [T("设备配置", "Configuration"), esc(devName(h[0]))],
    [T("GPU 可用显存", "GPU-allocatable VRAM"), h[1] + " GB"],
    [
      T("显存带宽（原记录口径）", "Bandwidth (original record scope)"),
      h[3][0] + " GB/s",
    ],
    [
      T("芯片峰值 / 精度", "Chip peak / precision"),
      h[3][1] + " TOPS · " + h[3][2],
    ],
  ];
  if (h[2] !== null)
    items.push([
      T("方向性速度估算", "Directional speed estimate"),
      h[2] + " Token/s",
    ]);
  if (h[3][3] !== null)
    items.push([T("板卡功耗", "Board power"), h[3][3] + " W"]);
  if (speed(h))
    items.push([
      T("指定模型测速记载", "Named-model speed claim"),
      speed(h) + " Token/s · Gemma 4 26B / 35B A3B",
    ]);
  if (h[4])
    items.push([
      T("官方 GPU 资料", "Official GPU source"),
      link(h[4], T("查看来源", "View source")),
    ]);
  return dl(items);
}
function familyFilter() {
  return `<select id="af-family" aria-label="${T("整机系列", "Device family")}"><option value="all">${T("全部整机系列", "All device families")}</option>${[...new Set(catalog.H.map((h) => h[0].split(" · ")[0]))].map((f) => `<option value="${esc(f)}" ${state.family === f ? "selected" : ""}>${esc(devName(f))}</option>`).join("")}</select>`;
}
function toolbar(kind) {
  const filters =
    kind === "hardware"
      ? [
          ["all", "全部状态", "All statuses"],
          ["fit", "容量满足", "Capacity fits"],
          ["fail", "容量不足", "Insufficient VRAM"],
          ["invalid", "参数不兼容", "Incompatible parameters"],
        ]
      : kind === "models"
        ? [
            ["all", "全部记录", "All records"],
            ["fusion", "AI Fusion 变体", "AI Fusion variants"],
          ]
        : kind === "performance"
          ? [
              ["all", "全部证据", "All evidence"],
              ["estimate", "有方向性估算", "Directional estimate available"],
            ]
          : [
              ["all", "全部设备", "All devices"],
              ["dual", "双卡配置", "Dual-GPU"],
              ["single", "单卡 / 统一内存", "Single-GPU / unified"],
            ];
  return `<div class="af-toolbar">${["devices", "performance"].includes(kind) ? familyFilter() : ""}<label><input id="af-search" value="${esc(state.search)}" placeholder="${T("搜索完整型号 / 名称", "Search full model / device name")}" aria-label="${T("搜索库记录", "Search catalog")}"></label><select id="af-filter" aria-label="${T("筛选状态", "Filter status")}">${filters.map((f) => `<option value="${f[0]}" ${state.filter === f[0] ? "selected" : ""}>${T(f[1], f[2])}</option>`).join("")}</select><select id="af-sort" aria-label="${T("排序", "Sort")}"><option value="name" ${state.sort === "name" ? "selected" : ""}>${T("名称排序", "Name")}</option><option value="size" ${state.sort === "size" ? "selected" : ""}>${T("容量 / 规模升序", "Memory / size ascending")}</option></select><button type="button" id="af-apply" class="cursor-interaction">${T("筛选", "Apply")}</button></div>`;
}
function dataTable(head, rows, widths) {
  return `<p class="af-mobile-table-hint">${T("左右滑动查看完整参数", "Scroll horizontally for all parameters")}</p><div class="af-table-wrap" tabindex="0" role="region" aria-label="${T("数据表格", "Data table")}"><table><thead><tr>${head.map((h, i) => `<th scope="col" ${widths ? `style="width:${widths[i]}%"` : ""}>${h}</th>`).join("")}</tr></thead><tbody>${rows || `<tr><td colspan="${head.length}" class="af-empty">${T("当前筛选没有记录；请修改筛选条件。", "No records. Change the filters.")}</td></tr>`}</tbody></table></div>`;
}
function detailButton(id) {
  return `<button type="button" class="af-rowbtn cursor-interaction" data-detail="${id}" aria-expanded="${state.expanded === id}">${state.expanded === id ? T("收起", "Close") : T("详情", "Details")}</button>`;
}
function detailRow(id, span, html) {
  return state.expanded === id
    ? `<tr class="af-detail"><td colspan="${span}">${html}</td></tr>`
    : "";
}
function compared() {
  if (!state.compare) return "";
  const selected = state.selected.map((i) => catalog.M[i]);
  const dimensions = [
    [T("参数量", "Parameters"), (m) => m[1] + "B"],
    [
      T("支持量化", "Quantizations"),
      (m) =>
        m
          .slice(4)
          .map((q) => q[0])
          .join(" / "),
    ],
    [T("最大上下文", "Maximum context"), (m) => ctx(m[3])],
    [T("KV 字节 / Token", "KV bytes / token"), (m) => m[2] ?? "—"],
    [T("GPU 权重", "GPU weights"), (m) => num(memory(m).w) + " GB"],
    ["GPU KV", (m) => num(memory(m).kv) + " GB"],
    [T("安全余量", "Headroom"), (m) => num(memory(m).reserve) + " GB"],
    [T("建议显存", "Required VRAM"), (m) => num(memory(m).need, 0) + " GB"],
  ];
  if (selected.some(fusion))
    dimensions.push([
      T("卸载到内存 / SSD", "RAM / SSD offload"),
      (m) =>
        fusion(m) ? memory(m).off + " / " + num(memory(m).ssd) + " GB" : "—",
    ]);
  if (+state.values.accelerator)
    dimensions.push([T("微调规则", "Fine-tuning rule"), tune]);
  if (selected.some((m) => speed(catalog.H[+state.values.device], m)))
    dimensions.push([
      T("原站测速记载", "Source speed claim"),
      (m) =>
        speed(catalog.H[+state.values.device], m)
          ? speed(catalog.H[+state.values.device], m) + " Token/s"
          : "—",
    ]);
  return `<section class="af-compare"><h3>${T("参数对比", "Parameter comparison")}</h3>${dataTable([T("维度", "Dimension"), ...selected.map((m) => esc(m[0]))], dimensions.map(([n, f]) => '<tr><th scope="row">' + n + "</th>" + selected.map((m) => "<td>" + f(m) + "</td>").join("") + "</tr>").join(""))}</section>`;
}
function modelPage() {
  const m = catalog.M[+state.values.model],
    c = memory(m, "model");
  const plans = c.supported && c.contextOK ? modelPlans(c.need) : [];
  const pageCount = Math.max(1, Math.ceil(plans.length / 5));
  state.planPage = Math.max(1, Math.min(state.planPage, pageCount));
  const head = `<div class="af-workhead"><div><h2>${T("模型找硬件", "Model → hardware")}</h2><p class="af-subtitle">${T("按显存需求比较设备方案。", "Compare hardware plans by memory requirement.")}</p></div><button type="button" data-model-tab="config">${T("编辑需求 · 5 项", "Edit requirements · 5")}</button></div><div class="af-condition"><strong>${esc(m[0])}</strong><span>${state.values.mquant}-bit · ${state.values.mcontext === "1024" ? "1M" : state.values.mcontext + "K"} · ${state.values.mconcurrency} ${T("人并发", "concurrent")} · ${T("显存上限", "VRAM limit")} ${Math.round(c.util * 100)}%</span></div>`;
  const back = `<div class="af-configtop"><button type="button" data-model-tab="results" class="af-rowbtn">← ${T("返回结果", "Back to results")}</button></div>`;
  if (state.modelTab === "config")
    return (
      head +
      back +
      group("模型运行约束", "Model operating constraints", [
        "model",
        "mquant",
        "mcontext",
        "mconcurrency",
        "util",
      ]) +
      `<button type="button" class="af-primary" data-model-tab="results">${T("查看更新后的结果", "View updated results")}</button>`
    );
  if (state.modelTab === "detail")
    return (
      head +
      back +
      `<div class="af-group af-detail">${modelDetail(m, "model")}</div>`
    );
  const visible = plans.slice((state.planPage - 1) * 5, state.planPage * 5);
  return (
    head +
    `<div class="af-kpis">${[
      [T("GPU 权重", "GPU weights"), c.w],
      [T("GPU KV 缓存", "GPU KV cache"), c.kv],
      [T("安全余量", "Headroom"), c.reserve],
      [T("建议 GPU 显存", "Required GPU VRAM"), c.need],
    ]
      .map(
        ([k, v]) => `<div><span>${k}</span><strong>${num(v)} GB</strong></div>`,
      )
      .join(
        "",
      )}</div><div class="af-result-title"><h3>${T("容量候选方案", "Capacity candidate plans")} · ${plans.length}</h3><button type="button" class="af-rowbtn" data-model-tab="detail">${T("查看完整参数", "View all parameters")}</button></div>${!c.contextOK ? `<p class="af-notice" role="alert">${T("当前上下文超过模型上限，请调整运行参数。", "Context exceeds the model limit. Adjust the operating inputs.")}</p>` : ""}${dataTable([T("设备方案", "Hardware plan"), T("显存 / 剩余", "VRAM / remaining"), T("部署方式", "Topology")], visible.map((p) => `<tr><td><strong>${esc(devName(p[0]))}</strong></td><td>${p[1]} / ${p[1] - c.need} GB</td><td>${T(p[5], p[3] > 1 ? "Cross-device sharding" : p[4] === 2 ? "Dual-GPU sharding" : p[5] === "统一内存" ? "Unified memory" : "Single GPU")}</td></tr>`).join(""), [54, 20, 26])}<div class="af-pagebar"><span role="status">${plans.length ? `${(state.planPage - 1) * 5 + 1}–${Math.min(state.planPage * 5, plans.length)}` : "0"} / ${plans.length} · ${T("每页 5 条", "5 per page")}</span><div><button type="button" data-plan-turn="-1" ${state.planPage === 1 ? "disabled" : ""}>${T("上一页", "Previous")}</button><span>${state.planPage} / ${pageCount}</span><button type="button" data-plan-turn="1" ${state.planPage === pageCount ? "disabled" : ""}>${T("下一页", "Next")}</button></div></div><p class="af-meta">${T("容量估算不代表速度或运行时兼容性保证。", "Capacity estimates do not guarantee speed or runtime compatibility.")}</p>`
  );
}
function libraryModels() {
  let rows = catalog.M.map((m, i) => ({ m, i })).filter(
    ({ m }) =>
      m[0].toLowerCase().includes(state.search.toLowerCase()) &&
      (state.filter === "all" ||
        (state.filter === "fusion" && fusion(m)) ||
        (state.filter === "pending" && !Number.isFinite(m[2]))),
  );
  rows.sort((a, b) =>
    state.sort === "size" ? a.m[1] - b.m[1] : a.m[0].localeCompare(b.m[0]),
  );
  const totalRows = rows.length;
  state.catalogPage = Math.max(
    1,
    Math.min(state.catalogPage, Math.max(1, Math.ceil(totalRows / 8))),
  );
  rows = rows.slice((state.catalogPage - 1) * 8, state.catalogPage * 8);
  return `<h2>${T("模型库", "Model library")} <span class="af-mark">${catalog.M.length}</span></h2><p class="af-subtitle">${T(catalog.M.length + " 条目录记录，其中 " + catalog.M.filter((m) => Number.isFinite(m[2])).length + " 条可参与容量计算。", catalog.M.length + " catalog records; " + catalog.M.filter((m) => Number.isFinite(m[2])).length + " support capacity sizing.")}</p>${toolbar("models")}<p class="af-meta">${T("显示", "Showing")} ${totalRows}/${catalog.M.length}</p>${dataTable(
    [
      T("模型 / 变体", "Model / variant"),
      T("参数量", "Parameters"),
      T("最大上下文", "Max context"),
      T("量化格式", "Quantizations"),
      T("KV 字节 / Token", "KV bytes / token"),
      T("详情", "Details"),
    ],
    rows
      .map(
        ({ m, i }) =>
          `<tr><td><strong>${esc(m[0])}</strong>${fusion(m) ? "<small>AI Fusion 2.0</small>" : ""}</td><td>${m[1]}B</td><td>${ctx(m[3])}</td><td>${m
            .slice(4)
            .map((q) => q[0])
            .join(
              " / ",
            )}</td><td>${!Number.isFinite(m[2]) ? "" : m[2].toLocaleString() + "<small>" + (fusion(m) ? "Fusion KV" : "Q8 KV") + "</small>"}</td><td>${detailButton("m" + i)}</td></tr>` +
          detailRow("m" + i, 6, modelDetail(m)),
      )
      .join(""),
    [32, 11, 14, 17, 17, 9],
  )}${catalogPager(totalRows)}<p class="af-meta">${T("仅展示已有资料；空白表示该记录没有对应数据，且不参与相关计算。", "Only recorded values are shown. Blank cells have no source data and are excluded from the relevant calculation.")}</p>`;
}
function libraryDevices(performance = false) {
  let rows = catalog.H.map((h, i) => ({ h, i })).filter(
    ({ h }) =>
      (state.family === "all" || h[0].split(" · ")[0] === state.family) &&
      h[0].toLowerCase().includes(state.search.toLowerCase()) &&
      (state.filter === "all" ||
        (state.filter === "dual" && h[0].includes("双")) ||
        (state.filter === "single" && !h[0].includes("双")) ||
        (state.filter === "measured" && speed(h)) ||
        (state.filter === "estimate" && h[2] !== null)),
  );
  rows.sort((a, b) =>
    state.sort === "size" ? a.h[1] - b.h[1] : a.h[0].localeCompare(b.h[0]),
  );
  const totalRows = rows.length;
  state.catalogPage = Math.max(
    1,
    Math.min(state.catalogPage, Math.max(1, Math.ceil(totalRows / 8))),
  );
  rows = rows.slice((state.catalogPage - 1) * 8, state.catalogPage * 8);
  return `<h2>${performance ? T("性能资料库", "Performance library") : T("设备库", "Device library")} <span class="af-mark">${catalog.H.length}</span></h2><p class="af-subtitle">${performance ? T("原目录中的方向性速度估算；不代表模型实测吞吐。", "Directional speed estimates from the original catalog; not measured model throughput.") : T(catalog.H.length + " 条设备配置，来自原始设备目录。", catalog.H.length + " device configurations from the original catalog.")}</p>${toolbar(performance ? "performance" : "devices")}<p class="af-meta">${T("显示", "Showing")} ${totalRows}/${catalog.H.length}</p>${dataTable(
    performance
      ? [
          T("设备配置", "Device configuration"),
          T("已有性能记录", "Available performance records"),
          T("详情", "Details"),
        ]
      : [
          T("设备配置", "Device configuration"),
          T("GPU 显存", "GPU VRAM"),
          T("带宽", "Bandwidth"),
          T("峰值 / 精度", "Peak / precision"),
          T("详情", "Details"),
        ],
    rows
      .map(({ h, i }) => {
        const claims = [];
        if (speed(h))
          claims.push(
            `<span>${T("模型测速记载", "Model speed claim")} · ${speed(h)} Token/s</span><small>Gemma 4 26B / 35B A3B</small>`,
          );
        if (h[2] !== null)
          claims.push(
            `<span>${T("方向性估算", "Directional estimate")} · ${h[2]} Token/s</span>`,
          );
        const cells = performance
          ? `<td>${claims.join("<br>")}</td>`
          : `<td>${h[1]} GB</td><td>${h[3][0]} GB/s</td><td>${h[3][1]} TOPS<small>${h[3][2]}${h[3][3] !== null ? " · " + h[3][3] + " W" : ""}</small></td>`;
        return (
          `<tr><td><strong>${esc(devName(h[0]))}</strong></td>${cells}<td>${detailButton("h" + i)}</td></tr>` +
          detailRow("h" + i, performance ? 3 : 5, deviceDetail(h))
        );
      })
      .join(""),
    performance ? [44, 45, 11] : [38, 13, 15, 23, 11],
  )}${catalogPager(totalRows)}`;
}
function save() {
  const url = new URL(location.href);
  url.searchParams.set("lang", state.lang);
  history.replaceState({}, "", url);
  if (window.parent !== window)
    window.parent.postMessage(
      { type: "advisor-v2-language", lang: state.lang },
      location.origin,
    );
}
function restore() {
  const lang = (
    new URLSearchParams(location.search).get("lang") ||
    new URLSearchParams(location.search).get("locale") ||
    "zh"
  ).toLowerCase();
  state.lang = ["en", "en-us"].includes(lang) ? "en" : "zh";
}
function render() {
  const active = document.activeElement;
  const focusId = active?.id;
  const focusData =
    active?.tagName === "BUTTON" ? Object.entries(active.dataset || {}) : [];
  document.documentElement.lang = root.lang =
    state.lang === "zh" ? "zh-CN" : "en";
  root
    .querySelectorAll("[data-lang]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.lang === state.lang)),
    );
  root.querySelector("#af-nav").innerHTML =
    `<div class="af-section-label">${T("方案工作台", "WORKSPACE")}</div><nav class="af-nav">${pages.slice(0, 2).map(navButton).join("")}</nav><div class="af-section-label">${T("数据资料", "CATALOGS")}</div><nav class="af-nav">${pages.slice(2).map(navButton).join("")}</nav><p class="af-meta" style="padding:8px">${T("结果优先版 · v2.0", "Results first · v2.0")}</p>`;
  body.innerHTML =
    state.page === "hardware"
      ? hardware()
      : state.page === "model"
        ? modelPage()
        : state.page === "models"
          ? libraryModels()
          : state.page === "devices"
            ? libraryDevices()
            : libraryDevices(true);
  root.querySelector("#af-footer-left").textContent = T(
    catalog.M.length + " 条模型记录 · " + catalog.H.length + " 条设备配置",
    catalog.M.length +
      " model records · " +
      catalog.H.length +
      " device configurations",
  );
  root.querySelector("#af-footer-right").textContent = T(
    "v2.0 · 容量为估算值",
    "v2.0 · Estimated capacity",
  );
  if (focusId)
    root
      .querySelector("#" + CSS.escape(focusId))
      ?.focus({ preventScroll: true });
  else if (focusData.length) {
    const [key, value] = focusData[0];
    const attr = key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
    root
      .querySelector("[data-" + attr + '="' + CSS.escape(value) + '"]')
      ?.focus({ preventScroll: true });
  }
}
function navButton(p) {
  return `<button type="button" data-page="${p[0]}" class="cursor-interaction" ${state.page === p[0] ? 'aria-current="page"' : ""}><span>${T(p[1], p[2])}</span>${p[3] ? "<small>" + p[3] + "</small>" : ""}</button>`;
}
root.addEventListener("change", (event) => {
  const f = event.target.dataset.field;
  if (f) {
    if (event.target.type === "number" && !event.target.checkValidity()) {
      event.target.reportValidity();
      return;
    }
    state.values[f] = event.target.value;
    state.resultPage = 1;
    state.planPage = 1;
    if (f === "model") {
      const opts = options.mquant();
      if (!opts.some((o) => o[0] === state.values.mquant))
        state.values.mquant = opts[0][0];
    }
    render();
    save();
    return;
  }
  const p = event.target.dataset.pick;
  if (p !== undefined) {
    const i = +p;
    state.selected = event.target.checked
      ? [...new Set([...state.selected, i])].slice(0, 3)
      : state.selected.filter((n) => n !== i);
    if (state.selected.length < 2) state.compare = false;
    render();
    save();
  }
});
root.addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b) return;
  if (b.dataset.catalogTurn) {
    state.catalogPage += Number(b.dataset.catalogTurn);
    state.expanded = null;
  } else if (b.dataset.modelTab) {
    state.modelTab = b.dataset.modelTab;
  } else if (b.dataset.planTurn) {
    state.planPage += Number(b.dataset.planTurn);
  } else if (b.dataset.work) {
    state.workTab = b.dataset.work;
  } else if (b.dataset.resultGroup) {
    state.resultGroup = b.dataset.resultGroup;
    state.resultPage = 1;
  } else if (b.dataset.turn) {
    state.resultPage += Number(b.dataset.turn);
  } else if (b.dataset.configGroup) {
    state.configGroup = Number(b.dataset.configGroup);
  } else if (b.dataset.resultDetail) {
    state.detailModel = Number(b.dataset.resultDetail);
    state.workTab = "detail";
  } else if (b.id === "af-result-apply") {
    state.resultSearch = root.querySelector("#af-result-search").value;
    state.resultSort = root.querySelector("#af-result-sort").value;
    state.resultPage = 1;
  } else if (b.dataset.lang) {
    state.lang = b.dataset.lang;
  } else if (b.dataset.page) {
    state.page = b.dataset.page;
    state.catalogPage = 1;
    state.workTab = "results";
    state.search = "";
    state.filter = "all";
    state.family = "all";
    state.expanded = null;
    state.compare = false;
  } else if (b.dataset.detail) {
    state.expanded =
      state.expanded === b.dataset.detail ? null : b.dataset.detail;
  } else if (b.id === "af-apply") {
    state.catalogPage = 1;
    state.search = root.querySelector("#af-search").value;
    state.filter = root.querySelector("#af-filter").value;
    state.sort = root.querySelector("#af-sort").value;
    state.family = root.querySelector("#af-family")?.value || "all";
  } else if (b.id === "af-compare") {
    state.compare = !state.compare;
  } else return;
  render();
  save();
});
function catalogPager(total) {
  const pages = Math.max(1, Math.ceil(total / 8));
  return `<div class="af-pagebar"><span>${total ? `${(state.catalogPage - 1) * 8 + 1}–${Math.min(state.catalogPage * 8, total)}` : "0"} / ${total} · ${T("每页 8 条", "8 per page")}</span><div><button type="button" data-catalog-turn="-1" class="cursor-interaction" ${state.catalogPage === 1 ? "disabled" : ""}>${T("上一页", "Previous")}</button><span>${state.catalogPage} / ${pages}</span><button type="button" data-catalog-turn="1" class="cursor-interaction" ${state.catalogPage === pages ? "disabled" : ""}>${T("下一页", "Next")}</button></div></div>`;
}
function resultSet() {
  const h = catalog.H[+state.values.device];
  let items = catalog.M.map((m, i) => ({ m, i, c: memory(m) })).filter(
    (x) => capability(x.m) && Number.isFinite(x.m[2]),
  );
  items.forEach((x) => (x.kind = status(x.m, x.c)[0]));
  const counts = {
    fit: items.filter((x) => x.kind === "fit").length,
    pending: items.filter((x) => x.kind === "pending").length,
    excluded: items.filter((x) => !["fit", "pending"].includes(x.kind)).length,
  };
  items = items.filter((x) =>
    state.resultGroup === "fit"
      ? x.kind === "fit"
      : state.resultGroup === "pending"
        ? x.kind === "pending"
        : !["fit", "pending"].includes(x.kind),
  );
  items = items.filter((x) =>
    x.m[0].toLowerCase().includes(state.resultSearch.toLowerCase()),
  );
  items.sort((a, b) =>
    state.resultSort === "large"
      ? b.m[1] - a.m[1] || a.m[0].localeCompare(b.m[0])
      : state.resultSort === "evidence"
        ? Number(Boolean(speed(h, b.m))) - Number(Boolean(speed(h, a.m))) ||
          (a.c.need ?? Infinity) - (b.c.need ?? Infinity) ||
          a.m[0].localeCompare(b.m[0])
        : (a.c.need ?? Infinity) - (b.c.need ?? Infinity) ||
          a.m[0].localeCompare(b.m[0]),
  );
  const pageCount = Math.max(1, Math.ceil(items.length / 5));
  state.resultPage = Math.max(1, Math.min(state.resultPage, pageCount));
  return {
    items,
    counts,
    pageCount,
    current: items.slice((state.resultPage - 1) * 5, state.resultPage * 5),
  };
}
function workspaceHeader() {
  const h = catalog.H[+state.values.device],
    v = state.values;
  return `<div class="af-workhead"><div><h2>${T("硬件找模型", "Hardware → models")}</h2><p class="af-subtitle">${T("先比较容量，再查看配置与显存拆解。", "Compare capacity, then inspect configurations and memory breakdowns.")}</p></div><button type="button" data-work="config" class="cursor-interaction">${T("编辑需求 · 8 项", "Edit requirements · 8")}</button></div><div class="af-condition"><strong>${esc(devName(h[0]))} × ${v.count}</strong><span>${v.quant}-bit · ${v.context === "1024" ? "1M" : v.context + "K"} · ${v.concurrency} ${T("人并发", "concurrent")}</span><span>${v.shard === "yes" ? T("跨机分片容量估算", "Cross-device capacity estimate") : T("单机容量 · 副本并发", "Per-machine capacity · replicas")}</span></div>`;
}
function resultPager(total, pageCount) {
  return `<div class="af-pagebar"><span role="status">${total ? `${(state.resultPage - 1) * 5 + 1}–${Math.min(state.resultPage * 5, total)}` : "0"} / ${total} ${T("条 · 每页 5 条", "records · 5 per page")}</span><div><button type="button" data-turn="-1" class="cursor-interaction" ${state.resultPage === 1 ? "disabled" : ""}>${T("上一页", "Previous")}</button><span>${state.resultPage} / ${pageCount}</span><button type="button" data-turn="1" class="cursor-interaction" ${state.resultPage === pageCount ? "disabled" : ""}>${T("下一页", "Next")}</button></div></div>`;
}
function resultsView() {
  const { items, counts, pageCount, current } = resultSet(),
    h = catalog.H[+state.values.device];
  const cap = capacityFor(
    +state.values.device,
    +state.values.count,
    state.values.shard === "yes",
  );
  const sorting =
    state.resultSort === "memory"
      ? T(
          "显存余量优先：显存需求从低到高。此顺序不代表任务效果排名。",
          "More headroom first: lower VRAM requirement first. This is not a task-quality ranking.",
        )
      : state.resultSort === "large"
        ? T(
            "参数规模优先：参数量从大到小。更大不必然更适合你的任务。",
            "Larger parameter count first. Larger is not necessarily better for your task.",
          )
        : T(
            "测速记载优先，再按显存需求排序。测速记载不代表当前工作负载下的性能保证。",
            "Recorded speed claims first, then lower VRAM need. Source claims do not guarantee performance for your workload.",
          );
  const tabs = [
    ["fit", T("容量候选", "Capacity candidates"), counts.fit],
    ["excluded", T("条件不满足", "Conditions unmet"), counts.excluded],
  ];
  const rows = current
    .map(({ m, i, c, kind }) => {
      const s = speed(h, m),
        st = status(m, c),
        actualQ = m.slice(4).find((q) => q[1] === +state.values.quant);
      return `<tr><td><label><input type="checkbox" class="af-check cursor-interaction" data-pick="${i}" ${state.selected.includes(i) ? "checked" : ""} ${state.selected.length >= 3 && !state.selected.includes(i) ? "disabled" : ""}><strong>${esc(m[0])}</strong></label><small>${m[1]}B · ${actualQ ? actualQ[0] : T("量化不匹配", "Quantization mismatch")} · ${ctx(m[3])} ${T("上限", "max")}</small></td><td><strong>${c.need === null ? "—" : c.need + " GB"}</strong><small>${c.need === null ? T("缺少 KV 数据", "Missing KV data") : c.need <= cap ? T("剩余 ", "Remaining ") + (cap - c.need) + " GB" : T("缺口 ", "Short by ") + (c.need - cap) + " GB"}</small></td><td><span class="${kind === "fit" ? "af-ok" : "af-warn"}">${st[1]}</span>${s ? "<small>" + T("测速记载 ", "Source claim ") + s + " Token/s</small>" : ""}</td><td>${tune(m)}<small>${T("按原站微调规则", "Original fine-tuning rule")}</small></td><td><button type="button" class="af-rowbtn cursor-interaction" data-result-detail="${i}">${T("完整详情", "Full details")}</button></td></tr>`;
    })
    .join("");
  return `<div class="af-results-switch" aria-label="${T("结果分组", "Result groups")}">${tabs.map(([id, name, n]) => `<button type="button" data-result-group="${id}" class="cursor-interaction" aria-pressed="${state.resultGroup === id}"><span>${name}</span><b>${n}</b></button>`).join("")}</div><div class="af-result-tools"><label><span>${T("用途", "Use case")}</span><select id="af-quick-cap" data-field="cap" class="cursor-interaction">${options
    .cap()
    .map(
      (o) =>
        `<option value="${o[0]}" ${state.values.cap === o[0] ? "selected" : ""}>${T(o[1], o[2])}</option>`,
    )
    .join(
      "",
    )}</select></label><label class="af-searchfield"><span>${T("模型名称", "Model name")}</span><input id="af-result-search" value="${esc(state.resultSearch)}" placeholder="${T("搜索模型", "Search models")}"></label><label><span>${T("排序依据", "Sort by")}</span><select id="af-result-sort" class="cursor-interaction">${[
    ["memory", "显存余量优先", "More VRAM headroom"],
    ["large", "参数规模优先", "Larger parameter count"],
  ]
    .map(
      (o) =>
        `<option value="${o[0]}" ${state.resultSort === o[0] ? "selected" : ""}>${T(o[1], o[2])}</option>`,
    )
    .join(
      "",
    )}</select></label><button id="af-result-apply" type="button" class="cursor-interaction">${T("应用", "Apply")}</button></div><p class="af-sort-note">${sorting} ${T("容量估算不代表速度或运行时兼容性保证。", "Capacity estimates do not guarantee speed or runtime compatibility.")}</p><div class="af-short-table">${dataTable([T("模型 / 部署变体", "Model / deployment variant"), T("建议显存", "Required VRAM"), T("评估状态", "Assessment"), T("微调", "Fine-tuning"), T("详情", "Details")], rows, [38, 15, 20, 16, 11])}</div>${resultPager(items.length, pageCount)}<div class="af-comparebar"><span>${state.selected.length ? T("已选 ", "Selected ") + state.selected.length + T(" 个，可跨页选择", "; selections persist across pages") : T("勾选 2–3 个模型，集中比较完整参数", "Select 2–3 models to compare all parameters")}</span><button type="button" data-work="compare" class="cursor-interaction af-primary" ${state.selected.length < 2 ? "disabled" : ""}>${T("比较所选", "Compare selected")} (${state.selected.length})</button></div>`;
}
function compactConfig() {
  const groups = [
    [
      "设备与部署",
      "Hardware & deployment",
      ["device", "count", "shard", "accelerator"],
    ],
    [
      "模型与工作负载",
      "Model & workload",
      ["cap", "quant", "context", "concurrency"],
    ],
  ];
  state.configGroup = Math.min(state.configGroup, 1);
  const g = groups[state.configGroup];
  return `<div class="af-configtop"><button type="button" data-work="results" class="af-rowbtn cursor-interaction">← ${T("返回结果", "Back to results")}</button><span>${T("8 项有效配置", "8 active inputs")}</span></div><div class="af-configgroups">${groups.map((g, i) => `<button type="button" data-config-group="${i}" class="cursor-interaction" aria-pressed="${i === state.configGroup}">${T(g[0], g[1])} <small>${g[2].length}</small></button>`).join("")}</div>${group(g[0], g[1], g[2])}<div class="af-configend"><span>${T("修改后实时更新结果", "Results update as you edit")}</span><button type="button" data-work="results" class="cursor-interaction af-primary">${T("查看更新后的结果", "View updated results")}</button></div>`;
}
function compactDetail() {
  const i = state.detailModel,
    m = catalog.M[i];
  return `<div class="af-configtop"><button type="button" data-work="results" class="af-rowbtn cursor-interaction">← ${T("返回第 ", "Back to page ")}${state.resultPage}${T(" 页结果", "")}</button><span>${T("返回后保留分组、排序、页码和对比选择", "Preserves grouping, sort, page and comparison selection")}</span></div><h3 class="af-detail-title">${esc(m[0])}</h3><div class="af-group af-detail">${modelDetail(m)}</div><div class="af-group af-detail"><h3>${T("当前设备与性能依据", "Current hardware & performance evidence")}</h3><div style="margin-top:12px">${deviceDetail(catalog.H[+state.values.device])}</div></div>`;
}
function hardware() {
  const header = workspaceHeader();
  if (state.workTab === "config") return header + compactConfig();
  if (state.workTab === "detail") return header + compactDetail();
  if (state.workTab === "compare") {
    state.compare = true;
    return (
      header +
      `<div class="af-configtop"><button type="button" data-work="results" class="af-rowbtn cursor-interaction">← ${T("返回候选列表", "Back to candidates")}</button><span>${T("只看选中的模型，完整参数并列对照", "Full parameters, selected models only")}</span></div>` +
      compared()
    );
  }
  return header + resultsView();
}

restore();
render();
const notifySize = () => {
  if (window.parent !== window)
    window.parent.postMessage(
      {
        type: "advisor-v2-height",
        height: Math.ceil(root.getBoundingClientRect().height),
      },
      location.origin,
    );
};
new ResizeObserver(notifySize).observe(root);
notifySize();
