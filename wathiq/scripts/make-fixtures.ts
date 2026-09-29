/**
 * يولّد ثلاث كراسات تجريبية عربية في tests/fixtures:
 *  - text.pdf    : كل الصفحات بطبقة نص حقيقية (طباعة Chromium)
 *  - scanned.pdf : كل الصفحات صور فقط (محاكاة المسح الضوئي)
 *  - mixed.pdf   : صفحات نصية + صفحة ممسوحة + صفحة ممسوحة عليها تذييل نصي
 *
 * الاستخدام: npm run fixtures   (يحتاج Chromium: CHROMIUM_PATH أو /opt/pw-browsers/chromium)
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { PDFDocument, StandardFonts } from "pdf-lib";

const OUT = path.resolve("tests/fixtures");

const PAGES: string[] = [
  `<h1>كراسة الشروط والمواصفات</h1>
   <p>الجهة: وزارة الشؤون البلدية والقروية والإسكان</p>
   <p>اسم المنافسة: تشغيل وصيانة المباني الإدارية بمنطقة الرياض</p>
   <p>رقم المنافسة: 240139005712</p>
   <p>قيمة وثائق المنافسة: 1500 ريال سعودي</p>
   <p>مدة التنفيذ: ستة وثلاثون شهراً من تاريخ استلام الموقع</p>`,
  `<h2>القسم الثاني: الأحكام العامة</h2>
   <p>2.1 يجب على المتنافس تقديم سجل تجاري ساري المفعول يتضمن نشاط التشغيل والصيانة.</p>
   <p>2.2 يجب تقديم شهادة سارية من هيئة الزكاة والضريبة والجمارك.</p>
   <p>2.3 يلتزم المتنافس بتقديم ضمان ابتدائي بنسبة 2% من قيمة العرض، ويستبعد العرض غير المصحوب بالضمان.</p>
   <p>2.4 يفضّل أن يكون لدى المتنافس شهادة الأيزو 9001 في إدارة الجودة.</p>`,
  `<h2>القسم الثالث: نطاق العمل والمواصفات الفنية</h2>
   <p>3.1 يلتزم المقاول بتوفير فريق صيانة وقائية يعمل على مدار الساعة طوال مدة العقد.</p>
   <p>3.2 يجب ألا تقل خبرة مدير المشروع عن عشر سنوات في مشاريع مماثلة.</p>
   <p>3.3 نسبة المحتوى المحلي المطلوبة لا تقل عن 40% وفق آلية هيئة المحتوى المحلي والمشتريات الحكومية.</p>`,
  `<h2>القسم الرابع: معايير التقييم</h2>
   <p>4.1 التقييم الفني بوزن 60% والتقييم المالي بوزن 40%.</p>
   <p>4.2 الحد الأدنى لاجتياز التقييم الفني 65 درجة من 100.</p>
   <p>4.3 آخر موعد لتلقي الاستفسارات قبل عشرة أيام من موعد تقديم العروض.</p>`,
];

function pageHtml(body: string, n: number) {
  return `<section style="page-break-after: always; height: 240mm; position: relative; overflow: hidden">
    ${body}
    <footer style="position:absolute; bottom:0; width:100%; text-align:center; font-size:11pt">صفحة ${n}</footer>
  </section>`;
}

function docHtml(bodies: string[]) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: "Noto Naskh Arabic", "Noto Sans Arabic", serif; font-size: 15pt; line-height: 1.9; color: #111; }
    h1 { font-size: 24pt; text-align: center; margin-top: 40mm; }
    h2 { font-size: 18pt; }
  </style></head><body>${bodies.map((b, i) => pageHtml(b, i + 1)).join("")}</body></html>`;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
  });
  const page = await browser.newPage();

  // 1) كراسة نصية
  await page.setContent(docHtml(PAGES), { waitUntil: "networkidle" });
  const textPdf = await page.pdf({ format: "A4", printBackground: true });
  await writeFile(path.join(OUT, "text.pdf"), textPdf);

  // صور الصفحات (لمحاكاة المسح): نرسم كل صفحة في viewport بحجم A4 عند ~150dpi
  await page.setViewportSize({ width: 1240, height: 1754 });
  const images: Buffer[] = [];
  for (let i = 0; i < PAGES.length; i++) {
    await page.setContent(
      `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
        body{margin:0;background:#f4f2ec;font-family:"Noto Naskh Arabic",serif;font-size:30px;line-height:1.9;color:#1a1a1a}
        .p{padding:120px 110px;transform:rotate(-0.6deg);filter:blur(0.3px) grayscale(1)}
        h1{font-size:46px;text-align:center;margin-top:140px} h2{font-size:36px}
      </style></head><body><div class="p">${PAGES[i]}<p style="text-align:center;margin-top:80px">صفحة ${i + 1}</p></div></body></html>`,
      { waitUntil: "networkidle" },
    );
    images.push(await page.screenshot({ type: "png", fullPage: false }));
  }
  await browser.close();

  const a4 = { w: 595.28, h: 841.89 };

  // 2) كراسة ممسوحة: كل صفحة صورة تغطي الصفحة
  const scanned = await PDFDocument.create();
  for (const img of images) {
    const png = await scanned.embedPng(img);
    const p = scanned.addPage([a4.w, a4.h]);
    p.drawImage(png, { x: 0, y: 0, width: a4.w, height: a4.h });
  }
  await writeFile(path.join(OUT, "scanned.pdf"), await scanned.save());

  // 3) كراسة مختلطة: ص1-2 نصية، ص3 ممسوحة، ص4 ممسوحة مع تذييل نصي قصير (ختم رقمي)
  const mixed = await PDFDocument.create();
  const textDoc = await PDFDocument.load(textPdf);
  const [t1, t2] = await mixed.copyPages(textDoc, [0, 1]);
  mixed.addPage(t1);
  mixed.addPage(t2);
  for (const idx of [2, 3]) {
    const png = await mixed.embedPng(images[idx]);
    const p = mixed.addPage([a4.w, a4.h]);
    p.drawImage(png, { x: 0, y: 0, width: a4.w, height: a4.h });
    if (idx === 3) {
      const font = await mixed.embedFont(StandardFonts.Helvetica);
      p.drawText("Etimad upload ref 240139005712 - page 4", { x: 40, y: 20, size: 8, font });
    }
  }
  await writeFile(path.join(OUT, "mixed.pdf"), await mixed.save());

  console.log("fixtures written to", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
