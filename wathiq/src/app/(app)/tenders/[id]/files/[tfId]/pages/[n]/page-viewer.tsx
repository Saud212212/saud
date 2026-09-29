"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import clsx from "clsx";
import type { Word } from "@/server/pipeline/types";

interface Props {
  fileUrl: string;
  pageNo: number;
  words: Word[];
  text: string;
  /** أبعاد الصفحة بالنقاط كما خُزّنت (بعد تطبيق الدوران) */
  width: number;
  height: number;
  /** مستطيلات موضع متطلب أو حقل (الانتقال من المصفوفة/الملخص) */
  highlights?: [number, number, number, number][];
}

// نسخة legacy: البناء الحديث يستخدم ميزات JS حديثة جداً (مثل Map.getOrInsertComputed)
// غير متوفرة في متصفحات كثير من الأجهزة الحكومية.
type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

/**
 * يرسم الصفحة الأصلية بـ pdf.js ويضع فوقها مربعات الكلمات المستخرجة.
 * هذا هو نفس الأساس الذي ستستخدمه المرحلة 2 لتظليل موضع الاقتباس عند فتح متطلب.
 */
export function PageViewer({ fileUrl, pageNo, words, text, width, height, highlights = [] }: Props) {
  const t = useTranslations("viewer");
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  // عند وجود موضع مظلّل نخفي مربعات الكلمات افتراضياً حتى يبرز الموضع
  const [showBoxes, setShowBoxes] = useState(highlights.length === 0);
  const firstHl = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!loading) firstHl.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [loading]);
  const [active, setActive] = useState<number | null>(null);

  // عرض الحاوية → المقياس
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  useEffect(() => {
    let cancelled = false;
    let task: { destroy(): Promise<void> } | undefined;
    (async () => {
      setLoading(true);
      const pdfjs: PdfJs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const loadingTask = pdfjs.getDocument({ url: fileUrl, withCredentials: true });
      task = loadingTask;
      const doc = await loadingTask.promise;
      const page = await doc.getPage(pageNo);
      if (cancelled || !canvasRef.current || !wrapRef.current) return;
      const cssScale = wrapRef.current.clientWidth / page.getViewport({ scale: 1 }).width;
      const dpr = window.devicePixelRatio || 1;
      const vp = page.getViewport({ scale: cssScale * dpr });
      const canvas = canvasRef.current;
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      await page.render({ canvas, viewport: vp }).promise;
      if (!cancelled) setLoading(false);
    })().catch((e) => console.error(e));
    return () => {
      cancelled = true;
      task?.destroy();
    };
  }, [fileUrl, pageNo]);

  // تقسيم النص إلى مقاطع مرتبطة بالكلمات (عبر الإزاحات المخزنة)
  const segments = useMemo(() => {
    const out: { s: string; w?: number }[] = [];
    let pos = 0;
    words.forEach((w, i) => {
      if (w.o > pos) out.push({ s: text.slice(pos, w.o) });
      out.push({ s: text.slice(w.o, w.o + w.t.length), w: i });
      pos = w.o + w.t.length;
    });
    if (pos < text.length) out.push({ s: text.slice(pos) });
    return out;
  }, [words, text]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div>
        <label className="mb-3 flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={showBoxes} onChange={(e) => setShowBoxes(e.target.checked)} className="accent-[var(--brand)]" />
          {t("showBoxes")}
        </label>
        {/* الصفحة تُعرض دائماً يسار→يمين كما هي في الملف */}
        <div ref={wrapRef} dir="ltr" className="relative w-full overflow-hidden rounded-lg border border-line bg-white shadow-sm" style={{ aspectRatio: `${width} / ${height}` }}>
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
          {loading && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">{t("loading")}</div>}
          {highlights.map((b, i) => (
            <div
              key={`hl-${i}`}
              ref={i === 0 ? firstHl : undefined}
              className="pointer-events-none absolute rounded-[3px] border-2 border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_28%,transparent)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_20%,transparent)]"
              style={{ left: b[0] * scale - 3, top: b[1] * scale - 3, width: (b[2] - b[0]) * scale + 6, height: (b[3] - b[1]) * scale + 6 }}
            />
          ))}
          {showBoxes &&
            words.map((w, i) => (
              <div
                key={i}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                title={w.c !== undefined ? `${w.t} (${w.c}%)` : w.t}
                className={clsx(
                  "absolute rounded-[2px] border transition-colors",
                  active === i
                    ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_35%,transparent)]"
                    : w.c !== undefined && w.c < 60
                      ? "border-[color-mix(in_srgb,var(--warn)_80%,transparent)] bg-[color-mix(in_srgb,var(--warn)_18%,transparent)]"
                      : "border-[color-mix(in_srgb,var(--brand)_45%,transparent)] bg-[color-mix(in_srgb,var(--brand)_8%,transparent)]",
                )}
                style={{
                  left: w.b[0] * scale,
                  top: w.b[1] * scale,
                  width: Math.max(2, (w.b[2] - w.b[0]) * scale),
                  height: Math.max(2, (w.b[3] - w.b[1]) * scale),
                }}
              />
            ))}
        </div>
      </div>
      <div>
        <h2 className="mb-3 text-sm font-semibold">{t("extracted")}</h2>
        <div className="max-h-[80vh] overflow-auto rounded-lg border border-line bg-surface p-4 text-[15px] leading-8 whitespace-pre-wrap" dir="auto">
          {text.trim() ? (
            segments.map((seg, k) =>
              seg.w === undefined ? (
                <span key={k}>{seg.s}</span>
              ) : (
                <span
                  key={k}
                  onMouseEnter={() => setActive(seg.w!)}
                  onMouseLeave={() => setActive(null)}
                  className={clsx("rounded-sm", active === seg.w && "bg-accent-soft outline outline-1 outline-[var(--accent)]")}
                >
                  {seg.s}
                </span>
              ),
            )
          ) : (
            <span className="text-muted">{t("empty")}</span>
          )}
        </div>
      </div>
    </div>
  );
}
