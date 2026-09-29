/** سياقات AAD: تربط كل نص مشفّر بموضعه فلا يصلح نقله لصف أو ملف آخر. */
export const aad = {
  file: (fileId: string) => `file:${fileId}`,
  page: (tenderFileId: string, pageNo: number) => `page:${tenderFileId}:${pageNo}`,
  chunk: (tenderFileId: string, ordinal: number) => `chunk:${tenderFileId}:${ordinal}`,
  tenderMeta: (tenderId: string) => `tender-meta:${tenderId}`,
  fileName: (fileId: string) => `file-name:${fileId}`,
  aiRun: (id: string) => `ai-run:${id}`,
  factValue: (id: string) => `fact-value:${id}`,
  factSource: (id: string) => `fact-source:${id}`,
  requirement: (id: string) => `requirement:${id}`,
  item: (id: string) => `item:${id}`,
};
