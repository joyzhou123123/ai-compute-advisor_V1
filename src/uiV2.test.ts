import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../public/ui-v2/source.js", import.meta.url),
  "utf8",
)
  .replace(/^export \{[^}]*\};$/gm, "")
  .replace(/^export /gm, "");
const app = readFileSync(
  new URL("../public/ui-v2/app.js", import.meta.url),
  "utf8",
).replace(/^import[\s\S]*?from "\.\/source\.js";\n/, "");

function harness(search = "?lang=zh") {
  type Node = {
    innerHTML: string;
    textContent: string;
    value: string;
    setAttribute(): void;
    focus(): void;
  };
  const nodes = new Map<string, Node>();
  const node = (key: string) => {
    if (!nodes.has(key))
      nodes.set(key, {
        innerHTML: "",
        textContent: "",
        value: "",
        setAttribute() {},
        focus() {},
      });
    return nodes.get(key)!;
  };
  const handlers: Record<string, (event: unknown) => void> = {};
  const root = {
    querySelector: node,
    querySelectorAll: () => [],
    addEventListener: (name: string, handler: (event: unknown) => void) => {
      handlers[name] = handler;
    },
    getBoundingClientRect: () => ({ height: 800 }),
  };
  const location = {
    search,
    href: `https://example.test/project/ui-v2/index.html${search}`,
    origin: "https://example.test",
  };
  const history = {
    replaceState(_state: unknown, _title: string, url: URL) {
      location.href = String(url);
      location.search = url.search;
    },
  };
  const window: Record<string, unknown> = { addEventListener() {} };
  window.parent = window;
  const context = createContext({
    document: {
      getElementById: () => root,
      documentElement: {},
      activeElement: null,
    },
    window,
    history,
    location,
    URL,
    URLSearchParams,
    ResizeObserver: class {
      observe() {}
    },
    console,
  });
  runInContext(source + "\n" + app, context);
  const click = (dataset: Record<string, string>, id?: string) =>
    handlers.click({ target: { closest: () => ({ dataset, id }) } });
  const change = (field: string, value: string) =>
    handlers.change({
      target: { dataset: { field }, value, type: "select-one" },
    });
  return {
    node,
    click,
    change,
    context,
    location,
    content: () => node("#af-content").innerHTML,
  };
}

describe("UI v2 preserves the original data and calculator", () => {
  it("matches the source catalog literals and formula blocks byte for byte", () => {
    expect(() =>
      execFileSync(process.execPath, [
        "scripts/extract-live-source.mjs",
        "--check",
      ]),
    ).not.toThrow();
  });

  it("keeps all catalog records including unavailable values and cross-device plans", () => {
    const { context } = harness();
    expect(
      runInContext(
        "[catalog.M.length,catalog.H.length,catalog.P.length]",
        context,
      ),
    ).toEqual([22, 9, 10]);
    expect(
      runInContext(
        "Number.isNaN(catalog.M.find(m=>m[0]==='MiniMax H3 33B')[2])",
        context,
      ),
    ).toBe(true);
    expect(runInContext("catalog.P.some(p=>p[3]>1)", context)).toBe(true);
  });

  it("matches original hardware arithmetic across quantization, context and concurrency boundaries", () => {
    const { context } = harness();
    const mismatches = runInContext(
      `(() => {
      const errors=[];
      for(const m of catalog.M)for(const bits of [4,8,16])for(const ctx of [16,32,128,1024])for(const con of [1,4,32]){
        const a=calculateHardwareMemory(m,bits,ctx,con),b=inspectMemory(m,bits,ctx,con);
        if(a.need!==b.need||a.weight!==b.w||a.kv!==b.kv||a.offload!==b.off||a.ssdKv!==b.ssd||a.util!==b.util)errors.push(m[0]);
      }
      return errors;
    })()`,
      context,
    );
    expect(mismatches).toEqual([]);
  });
});

describe("results-first interactions", () => {
  it("paginates and preserves the result page when returning from details", () => {
    const h = harness();
    expect((h.content().match(/data-pick=/g) || []).length).toBe(5);
    expect(h.content()).toContain("1–5 / 17");
    h.click({ turn: "1" });
    const id = h.content().match(/data-pick="(\d+)"/)![1];
    h.click({ resultDetail: id });
    expect(h.content()).toContain("返回第 2 页结果");
    h.click({ work: "results" });
    expect(h.content()).toContain("6–10 / 17");
  });

  it("keeps active inputs and switches language without resetting choices", () => {
    const h = harness();
    h.click({ work: "config" });
    expect((h.content().match(/data-field=/g) || []).length).toBe(4);
    h.click({ configGroup: "1" });
    expect((h.content().match(/data-field=/g) || []).length).toBe(4);
    h.change("context", "64");
    h.click({ lang: "en" });
    expect(h.content()).toContain("Model & workload");
    expect(h.content()).toContain('value="64" selected');
    expect(h.location.search).toBe("?lang=en");
    h.click({ page: "model" });
    h.click({ modelTab: "config" });
    expect((h.content().match(/data-field=/g) || []).length).toBe(5);
    expect(h.content()).not.toContain("MiniMax H3");
  });

  it("serves the requested language from a copied URL", () => {
    expect(harness("?lang=en").content()).toContain("Hardware → models");
    expect(harness("?locale=zh-cn").content()).toContain("硬件找模型");
  });

  it("preserves library counts while hiding absent fields and incomplete recommendations", () => {
    const h = harness();
    expect(h.content()).not.toContain('data-result-group="pending"');
    for (const lang of ["zh", "en"]) {
      h.click({ lang });
      for (const page of [
        "hardware",
        "model",
        "models",
        "devices",
        "performance",
      ]) {
        h.click({ page });
        expect(h.content()).not.toMatch(
          /TBD|待补|待校验|待测试|Not recorded|Pending test|TTFT|预算上限|目标速度/,
        );
      }
    }
    h.click({ page: "models" });
    h.click({ catalogTurn: "1" });
    h.click({ catalogTurn: "1" });
    expect(h.content()).toContain("17–22 / 22");
    h.click({ page: "devices" });
    h.click({ catalogTurn: "1" });
    expect(h.content()).toContain("9–9 / 9");
  });

  it("separates incompatible contexts and prevents missing data from becoming zero", () => {
    const h = harness();
    h.click({ resultGroup: "excluded" });
    expect(h.content()).toContain("上下文超限");
    const result = runInContext(
      "inspectMemory(catalog.M.find(m=>m[0]==='MiniMax H3 33B'),4,32,1)",
      h.context,
    );
    expect(result.need).toBeNull();
    expect(result.kv).toBeNull();
  });
});
