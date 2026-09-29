import { randomUUID } from "node:crypto";
import { charSimilarity, normalizeText, tokenJaccard } from "./normalize";
import type { VerificationResult, VerificationStatus } from "./verify";
import type { Category, Obligation } from "./schema";

/**
 * دمج المتطلبات المستخرجة من كل المقاطع.
 *
 * القاعدة المعتمدة:
 *  - يُحذف المكرر **فقط** إذا تطابق النص والمصدر معاً (نفس الملف، نفس الصفحة المطابَقة، نفس الاقتباس
 *    أو موضعاً متداخلاً) ولم تختلف صفاته (الإلزامية/الاستبعاد/الفئة).
 *  - أي تشابه غير مؤكد ← لا حذف؛ تُجمع في مجموعة "متطلبات متشابهة، راجع الدمج" ليقرر المستخدم.
 *  - المعرّف النهائي REQ-001... يسنده الكود بعد الدمج، بترتيب الظهور في المستند.
 *    العناصر غير الموثّقة تأخذ UNV-001... ولا تظهر في المصفوفة كمتطلبات مؤكدة.
 */

export interface RequirementCandidate {
  tmpId: string;
  chunkId: string;
  localId: string | null;
  tenderFileId: string;
  fileOrdinal: number;
  category: Category | null;
  categoryRaw: string | null;
  text: string;
  obligation: Obligation | null;
  disqualifying: boolean;
  evidenceRequired: string | null;
  clause: string | null;
  quote: string | null;
  statedPage: number | null;
  verification: VerificationResult;
  /** ترتيب داخل الصفحة لأجل الترقيم (أول مستطيل تظليل) */
  sortKey: number;
}

export interface MergedRequirement extends RequirementCandidate {
  code: string;
  similarGroupId: string | null;
  /** معرّفات محلية لمتطلبات حُذفت كمكرر تام لهذا المتطلب (للتتبع) */
  mergedLocalIds: string[];
}

export const SIMILARITY = { textJaccard: 0.6, textChars: 0.85, quoteChars: 0.9 } as const;

const pageOf = (c: RequirementCandidate) => c.verification.matchedPage ?? c.statedPage ?? 0;

function sameSource(a: RequirementCandidate, b: RequirementCandidate): boolean {
  if (a.tenderFileId !== b.tenderFileId || pageOf(a) !== pageOf(b)) return false;
  const qa = normalizeText(a.quote ?? "");
  const qb = normalizeText(b.quote ?? "");
  if (qa && qa === qb) return true;
  // اقتباسان مختلفان قليلاً لنفس الموضع: أحدهما يحتوي الآخر
  return !!qa && !!qb && (qa.includes(qb) || qb.includes(qa));
}

const sameAttributes = (a: RequirementCandidate, b: RequirementCandidate) =>
  a.obligation === b.obligation && a.disqualifying === b.disqualifying && a.category === b.category;

function similar(a: RequirementCandidate, b: RequirementCandidate): boolean {
  const ta = normalizeText(a.text);
  const tb = normalizeText(b.text);
  if (ta === tb) return true;
  if (tokenJaccard(ta, tb) >= SIMILARITY.textJaccard) return true;
  if (Math.min(ta.length, tb.length) / Math.max(ta.length, tb.length) > 0.6 && charSimilarity(ta, tb) >= SIMILARITY.textChars) return true;
  // نفس الموضع في المستند بصياغتين مختلفتين
  if (sameSource(a, b)) return true;
  const qa = normalizeText(a.quote ?? "");
  const qb = normalizeText(b.quote ?? "");
  return qa.length > 20 && qb.length > 20 && charSimilarity(qa, qb) >= SIMILARITY.quoteChars;
}

const pad = (n: number) => String(n).padStart(3, "0");
const shown = (s: VerificationStatus) => s !== "unverified";

export interface MergeResult {
  requirements: MergedRequirement[];
  exactDuplicatesRemoved: number;
  similarGroups: number;
}

export function mergeRequirements(candidates: RequirementCandidate[]): MergeResult {
  // 1) ترتيب المستند: الملف ← الصفحة ← الموضع في الصفحة
  const ordered = [...candidates].sort(
    (a, b) => a.fileOrdinal - b.fileOrdinal || pageOf(a) - pageOf(b) || a.sortKey - b.sortKey || a.tmpId.localeCompare(b.tmpId),
  );

  // 2) حذف المكرر التام فقط: نص + مصدر + صفات متطابقة
  const kept: MergedRequirement[] = [];
  let removed = 0;
  for (const c of ordered) {
    const dup = kept.find(
      (k) => shown(k.verification.status) === shown(c.verification.status) && normalizeText(k.text) === normalizeText(c.text) && sameSource(k, c) && sameAttributes(k, c),
    );
    if (dup) {
      removed++;
      if (c.localId) dup.mergedLocalIds.push(c.localId);
      continue;
    }
    kept.push({ ...c, code: "", similarGroupId: null, mergedLocalIds: [] });
  }

  // 3) مجموعات التشابه (union-find) بين المعروضة فقط — لا حذف
  const visible = kept.filter((k) => shown(k.verification.status));
  const parent = visible.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      if (similar(visible[i], visible[j])) parent[find(j)] = find(i);
    }
  }
  const groups = new Map<number, number[]>();
  visible.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));
  let similarGroups = 0;
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    similarGroups++;
    const gid = randomUUID();
    for (const i of members) visible[i].similarGroupId = gid;
  }

  // 4) المعرّفات النهائية
  let r = 0;
  let u = 0;
  for (const k of kept) k.code = shown(k.verification.status) ? `REQ-${pad(++r)}` : `UNV-${pad(++u)}`;

  return { requirements: kept, exactDuplicatesRemoved: removed, similarGroups };
}
