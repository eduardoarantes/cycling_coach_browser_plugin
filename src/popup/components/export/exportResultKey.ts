import type { ExportResult as ExportResultType } from '@/export/adapters/base';

export function getExportResultKey(result: ExportResultType): string {
  return [
    result.success ? 'success' : 'failure',
    result.fileName ?? 'no-file',
    result.fileUrl ?? 'no-url',
    String(result.itemsExported),
    String(result.warnings.length),
    String(result.errors?.length ?? 0),
  ].join(':');
}
