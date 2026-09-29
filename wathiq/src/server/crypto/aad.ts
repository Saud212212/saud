/** سياقات AAD: تربط كل نص مشفّر بموضعه فلا يصلح نقله لصف أو ملف آخر. */
export const aad = {
  file: (fileId: string) => `file:${fileId}`,
  page: (tenderFileId: string, pageNo: number) => `page:${tenderFileId}:${pageNo}`,
  chunk: (tenderFileId: string, ordinal: number) => `chunk:${tenderFileId}:${ordinal}`,
};
