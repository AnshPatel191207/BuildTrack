import * as XLSX from 'xlsx';
import { Project } from '../models/Project';
import { ProjectNode } from '../models/ProjectNode';
import { Unit } from '../models/Unit';

export interface ExcelRowParsed {
  rowNumber: number;
  projectName: string;
  towerName: string;
  floorName: string;
  unitNumber: string;
  unitType: string;
  area: number;
  carpetArea?: number;
  builtUpArea?: number;
  rate: number;
  price: number;
  status: 'available' | 'reserved' | 'booked' | 'sold' | 'blocked';
  facing?: string;
  bedrooms?: number;
  category?: 'flat' | 'shop' | 'office' | 'penthouse' | 'plot';
}

export interface ImportError {
  rowNumber: number;
  unitNumber?: string;
  projectName?: string;
  column?: string;
  reason: string;
}

export interface ImportPreviewResult {
  totalRows: number;
  validCount: number;
  errorCount: number;
  duplicateCount: number;
  validRows: ExcelRowParsed[];
  errors: ImportError[];
}

/** Generates a sample XLSX template for admin download */
export function generateSampleExcelTemplate(): Buffer {
  const headers = [
    'Project',
    'Tower',
    'Floor',
    'Unit Number',
    'Unit Type',
    'Category',
    'Area',
    'Carpet Area',
    'BuiltUp Area',
    'Rate',
    'Price',
    'Status',
    'Facing',
    'Bedrooms',
  ];

  const sampleRows = [
    [
      'Orchid Heights',
      'Tower A',
      '1st Floor',
      'A-101',
      '2BHK',
      'flat',
      1200,
      950,
      1200,
      5000,
      6000000,
      'available',
      'East',
      2,
    ],
    [
      'Orchid Heights',
      'Tower A',
      '1st Floor',
      'A-102',
      '3BHK',
      'flat',
      1600,
      1300,
      1600,
      5200,
      8320000,
      'available',
      'North-East',
      3,
    ],
    [
      'Orchid Heights',
      'Tower A',
      'Ground Floor',
      'SHOP-01',
      'Shop',
      'shop',
      450,
      380,
      450,
      11000,
      4950000,
      'available',
      'Road Facing',
      0,
    ],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Unit Inventory');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/** Parses uploaded Excel buffer and produces a preview with error detection */
export async function parseAndPreviewExcel(
  buffer: Buffer,
  companyId: unknown,
): Promise<ImportPreviewResult> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('The uploaded Excel file contains no worksheets.');
  }

  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: '',
  });

  if (rawRows.length === 0) {
    throw new Error('The worksheet is empty. Please add rows to import.');
  }

  const validRows: ExcelRowParsed[] = [];
  const errors: ImportError[] = [];
  let duplicateCount = 0;

  // Cache existing projects for fast resolution
  const existingProjects = await Project.find({ companyId }).select('_id name projectCode').lean();
  const projectMap = new Map<string, any>();
  for (const p of existingProjects) {
    if (p.name) projectMap.set(String(p.name).trim().toLowerCase(), p);
    if (p.projectCode) projectMap.set(String(p.projectCode).trim().toLowerCase(), p);
    projectMap.set(String(p._id), p);
  }

  // Pre-fetch all unit numbers in this company to detect duplicate units
  const existingUnits = await Unit.find({ companyId }).select('projectId unitNumber').lean();
  const existingUnitSet = new Set<string>();
  for (const u of existingUnits) {
    if (u.unitNumber) {
      existingUnitSet.add(`${String(u.projectId)}::${String(u.unitNumber).trim().toUpperCase()}`);
    }
  }

  const internalSeenUnits = new Set<string>();

  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i];
    const rowNumber = i + 2; // Row 1 is header in Excel

    // Key column extraction (supporting flexible headers)
    const projectName = String(r['Project'] || r['Project Name'] || r['project'] || '').trim();
    const towerName = String(r['Tower'] || r['Tower Name'] || r['tower'] || r['Block'] || 'Tower A').trim();
    const floorName = String(r['Floor'] || r['Floor Name'] || r['floor'] || '1st Floor').trim();
    const unitNumber = String(r['Unit Number'] || r['Unit'] || r['unitNumber'] || r['Unit No'] || '').trim().toUpperCase();
    const unitType = String(r['Unit Type'] || r['Type'] || r['unitType'] || 'Residential').trim();
    const rawCategory = String(r['Category'] || r['category'] || '').trim().toLowerCase();
    const category = ['shop', 'office', 'penthouse', 'plot'].includes(rawCategory)
      ? (rawCategory as any)
      : unitType.toLowerCase().includes('shop')
      ? 'shop'
      : 'flat';

    const area = Number(r['Area'] || r['area'] || r['Super BuiltUp Area'] || 0);
    const carpetArea = Number(r['Carpet Area'] || r['carpetArea'] || area * 0.75 || 0);
    const builtUpArea = Number(r['BuiltUp Area'] || r['builtUpArea'] || area || 0);
    const rate = Number(r['Rate'] || r['rate'] || r['Rate Per SqFt'] || 0);
    let price = Number(r['Price'] || r['price'] || r['Total Value'] || 0);

    // If price is 0 but area and rate exist, compute price
    if (price <= 0 && area > 0 && rate > 0) {
      price = area * rate;
    }

    const rawStatus = String(r['Status'] || r['status'] || 'available').trim().toLowerCase();
    const status = ['available', 'reserved', 'booked', 'sold', 'blocked'].includes(rawStatus)
      ? (rawStatus as any)
      : 'available';

    const facing = String(r['Facing'] || r['facing'] || '').trim() || undefined;
    const bedrooms = r['Bedrooms'] !== undefined && r['Bedrooms'] !== '' ? Number(r['Bedrooms']) : undefined;

    // Row-level validations
    if (!projectName) {
      errors.push({ rowNumber, unitNumber, reason: 'Project name is required' });
      continue;
    }

    const matchedProject = projectMap.get(projectName.toLowerCase());
    if (!matchedProject) {
      errors.push({
        rowNumber,
        unitNumber,
        projectName,
        reason: `Project "${projectName}" does not exist in BuildTrack. Please create it first.`,
      });
      continue;
    }

    if (!unitNumber) {
      errors.push({ rowNumber, reason: 'Unit Number is required' });
      continue;
    }

    if (area <= 0) {
      errors.push({ rowNumber, unitNumber, reason: 'Area must be greater than 0' });
      continue;
    }

    if (price <= 0) {
      errors.push({ rowNumber, unitNumber, reason: 'Price must be greater than 0' });
      continue;
    }

    // Duplicate detection within the database
    const dbKey = `${String(matchedProject._id)}::${unitNumber}`;
    if (existingUnitSet.has(dbKey)) {
      duplicateCount++;
      errors.push({
        rowNumber,
        unitNumber,
        projectName,
        reason: `Unit "${unitNumber}" already exists in Project "${matchedProject.name}"`,
      });
      continue;
    }

    // Duplicate detection within the file itself
    if (internalSeenUnits.has(dbKey)) {
      duplicateCount++;
      errors.push({
        rowNumber,
        unitNumber,
        projectName,
        reason: `Duplicate entry: Unit "${unitNumber}" appears more than once in this file.`,
      });
      continue;
    }
    internalSeenUnits.add(dbKey);

    validRows.push({
      rowNumber,
      projectName: matchedProject.name,
      towerName,
      floorName,
      unitNumber,
      unitType,
      area,
      carpetArea,
      builtUpArea,
      rate,
      price,
      status,
      facing,
      bedrooms,
      category,
    });
  }

  return {
    totalRows: rawRows.length,
    validCount: validRows.length,
    errorCount: errors.length,
    duplicateCount,
    validRows,
    errors,
  };
}

/** Executes bulk insert, automatically discovering or creating towers and floors */
export async function executeExcelBulkImport(
  companyId: unknown,
  userId: unknown,
  validRows: ExcelRowParsed[],
  overrideProjectId?: string,
): Promise<{
  insertedUnits: number;
  towersCreated: number;
  floorsCreated: number;
}> {
  if (!validRows || validRows.length === 0) {
    return { insertedUnits: 0, towersCreated: 0, floorsCreated: 0 };
  }

  // Pre-load projects
  const projects = await Project.find({ companyId }).lean();
  const projectMap = new Map<string, any>();
  for (const p of projects) {
    if (p.name) projectMap.set(String(p.name).trim().toLowerCase(), p);
    if (p.projectCode) projectMap.set(String(p.projectCode).trim().toLowerCase(), p);
    projectMap.set(String(p._id), p);
  }
  const defaultProject = overrideProjectId
    ? await Project.findOne({ _id: overrideProjectId, companyId }).lean()
    : projects[0];

  // Cache towers and floors to prevent repeated lookups
  const towerCache = new Map<string, any>(); // key: `${projectId}::${towerName}`
  const floorCache = new Map<string, any>(); // key: `${towerId}::${floorName}`

  let towersCreated = 0;
  let floorsCreated = 0;

  // Load existing structure nodes
  const existingNodes = await ProjectNode.find({
    companyId,
    nodeType: { $in: ['tower', 'block', 'floor'] },
  }).lean();

  for (const n of existingNodes) {
    const nodeName = (n.name ? String(n.name) : '').trim().toLowerCase();
    if (!nodeName) continue;
    if (n.nodeType === 'tower' || n.nodeType === 'block') {
      towerCache.set(`${String(n.projectId)}::${nodeName}`, n);
    } else if (n.nodeType === 'floor') {
      floorCache.set(`${String(n.parentId)}::${nodeName}`, n);
    }
  }

  const unitsToInsert: any[] = [];

  for (const row of validRows) {
    const rowProj = (row.projectName ? String(row.projectName) : '').trim().toLowerCase();
    const project = projectMap.get(rowProj) || defaultProject;
    if (!project) continue;

    const projectId = project._id;
    const rawTower = (row.towerName ? String(row.towerName) : 'Tower A').trim();
    const rawFloor = (row.floorName ? String(row.floorName) : '1st Floor').trim();

    // 1. Resolve or Create Tower
    const towerKey = `${String(projectId)}::${rawTower.toLowerCase()}`;
    let tower = towerCache.get(towerKey);
    if (!tower) {
      tower = await ProjectNode.create({
        companyId,
        projectId,
        parentId: null,
        nodeType: 'tower',
        name: rawTower,
        order: 0,
        createdBy: userId,
      });
      towerCache.set(towerKey, tower);
      towersCreated++;
    }

    // 2. Resolve or Create Floor
    const floorKey = `${String(tower._id)}::${rawFloor.toLowerCase()}`;
    let floor = floorCache.get(floorKey);
    if (!floor) {
      floor = await ProjectNode.create({
        companyId,
        projectId,
        parentId: tower._id,
        nodeType: 'floor',
        name: rawFloor,
        order: 0,
        createdBy: userId,
      });
      floorCache.set(floorKey, floor);
      floorsCreated++;
    }

    // 3. Prepare Unit document
    unitsToInsert.push({
      companyId,
      projectId,
      blockId: tower._id,
      towerId: tower._id,
      floorId: floor._id,
      category: row.category || 'flat',
      unitNumber: row.unitNumber,
      unitType: row.unitType,
      areaSqft: row.area,
      carpetAreaSqft: row.carpetArea || row.area * 0.75,
      builtUpAreaSqft: row.builtUpArea || row.area,
      superBuiltupAreaSqft: row.area,
      bedrooms: row.bedrooms ?? null,
      facing: row.facing || null,
      ratePerSqft: row.rate,
      basePrice: row.price,
      totalValue: row.price,
      status: row.status,
    });
  }

  let insertedUnits = 0;
  if (unitsToInsert.length > 0) {
    // Insert in chunks of 500
    const chunkSize = 500;
    for (let i = 0; i < unitsToInsert.length; i += chunkSize) {
      const chunk = unitsToInsert.slice(i, i + chunkSize);
      const res = await Unit.insertMany(chunk, { ordered: false });
      insertedUnits += res.length;
    }
  }

  return {
    insertedUnits,
    towersCreated,
    floorsCreated,
  };
}
