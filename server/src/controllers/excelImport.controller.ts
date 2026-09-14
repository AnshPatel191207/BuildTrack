import type { Request, Response } from 'express';
import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import {
  generateSampleExcelTemplate,
  parseAndPreviewExcel,
  executeExcelBulkImport,
} from '../services/excelImport.service';
import { hasPermission } from '../utils/permissions';
import { logAudit } from '../utils/audit';
import type { AuthUser } from '../types';

type Req = Request & { validatedBody?: any; file?: Express.Multer.File };

/** GET /api/property/import/template — Download sample Excel file */
export async function downloadExcelTemplate(_req: Request, res: Response) {
  const buffer = generateSampleExcelTemplate();
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', 'attachment; filename="BuildTrack_Unit_Import_Template.xlsx"');
  res.send(buffer);
}

/** POST /api/property/import/preview — Dry run validate Excel upload */
export async function previewExcelImport(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role, 'canManageUnits') && !hasPermission(user.role, 'canImportInventory')) {
    throw ApiError.forbidden('You do not have permission to import inventory.');
  }

  if (!req.file || !req.file.buffer) {
    throw ApiError.badRequest('Please upload an Excel spreadsheet file (.xlsx or .xls).');
  }

  const preview = await parseAndPreviewExcel(req.file.buffer, user.companyId);
  sendSuccess(res, preview, 'File parsed successfully. Review preview below.');
}

/** POST /api/property/import/execute — Bulk create validated inventory */
export async function executeExcelImport(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role, 'canManageUnits') && !hasPermission(user.role, 'canImportInventory')) {
    throw ApiError.forbidden('You do not have permission to import inventory.');
  }

  const { validRows } = req.body;
  if (!validRows || !Array.isArray(validRows) || validRows.length === 0) {
    throw ApiError.badRequest('No valid rows provided for import.');
  }

  const result = await executeExcelBulkImport(user.companyId, user._id, validRows);

  await logAudit(req, {
    action: 'bulk_import',
    module: 'inventory_import',
    description: `${user.name} bulk imported ${result.insertedUnits} units (${result.towersCreated} towers, ${result.floorsCreated} floors created)`,
  });

  sendCreated(
    res,
    result,
    `Successfully imported ${result.insertedUnits} units across ${result.towersCreated} new towers and ${result.floorsCreated} new floors.`,
  );
}
