// ينسخ عامل pdf.js للمتصفح (نسخة legacy لدعم المتصفحات الأقدم في الجهات) إلى public/ (يُستدعى بعد npm install)
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public", { recursive: true });
copyFileSync("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs", "public/pdf.worker.min.mjs");
