/**
 * 简历文本提取调度器
 * 根据文件格式选择合适的库提取纯文本
 */

export type SupportedFileType = 'pdf' | 'docx' | 'doc';

const SUPPORTED_EXTENSIONS: Record<string, SupportedFileType> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.doc': 'doc',
};

const SUPPORTED_MIMES: Record<string, SupportedFileType> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
};

export function detectFileType(fileName: string, mimeType?: string): SupportedFileType | null {
  const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (ext && SUPPORTED_EXTENSIONS[ext]) {
    return SUPPORTED_EXTENSIONS[ext];
  }
  if (mimeType && SUPPORTED_MIMES[mimeType]) {
    return SUPPORTED_MIMES[mimeType];
  }
  return null;
}

export async function extractText(buffer: Buffer, fileType: SupportedFileType): Promise<string> {
  switch (fileType) {
    case 'pdf':
      return extractPdfText(buffer);
    case 'docx':
      return extractDocxText(buffer);
    case 'doc':
      return extractDocText(buffer);
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.text.trim();
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

async function extractDocText(buffer: Buffer): Promise<string> {
  // word-extractor 没有类型声明，用 require
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const WordExtractor = require('word-extractor');
  const extractor = new WordExtractor();
  const doc = await extractor.extract(buffer);
  return doc.getBody().trim();
}
