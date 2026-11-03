import { useEffect, useRef, useState } from "react";

/** The original static calculator remains available at its original URL. */
export default function App() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number>();
  const [search] = useState(() => window.location.search);

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (
        event.origin !== window.location.origin ||
        event.source !== frame.current?.contentWindow
      )
        return;
      const data: unknown = event.data;
      if (!data || typeof data !== "object" || !("type" in data)) return;
      if (
        data.type === "advisor-v2-height" &&
        "height" in data &&
        typeof data.height === "number" &&
        Number.isFinite(data.height) &&
        data.height > 0 &&
        data.height < 100000
      ) {
        setHeight(Math.ceil(data.height));
      }
      if (
        data.type === "advisor-v2-language" &&
        "lang" in data &&
        (data.lang === "zh" || data.lang === "en")
      ) {
        const url = new URL(window.location.href);
        url.searchParams.set("lang", data.lang);
        window.history.replaceState({}, "", url);
        document.documentElement.lang = data.lang === "zh" ? "zh-CN" : "en";
      }
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  return (
    <iframe
      ref={frame}
      title="AI Compute Advisor v2"
      src={`${import.meta.env.BASE_URL}ui-v2/index.html${search}`}
      style={{
        display: "block",
        width: "100%",
        height: height ?? "100dvh",
        border: 0,
      }}
    />
  );
}
