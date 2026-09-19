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
  category: 'flat' | 'shop' | 'office' | 'penthouse' | 'plot';
  area: number;
  carpetArea?: number;
  builtUpArea?: number;
  superBuiltupArea?: number;
  rate: number;
  price: number;
  basePrice?: number;
  parkingSlot?: string;
  parkingCharges?: number;
  clubhouseCharges?: number;
  gstPercentage?: number;
  totalValue?: number;
  plotAreaSqmt?: number;
  builtUpAreaSqmt?: number;
  carpetAreaSqmt?: number;
  balconyAreaSqmt?: number;
  terraceAreaSqmt?: number;
  saleDeedAmount?: number;
  status: 'available' | 'reserved' | 'booked' | 'sold' | 'blocked';
  facing?: string;
  bedrooms?: number;
  bathrooms?: number;
  balconies?: number;
  notes?: string;
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

/** Robust numeric parser that handles commas, currency symbols, and unit texts like 'sqft' */
function parseNumber(val: any, multiplier = 1): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val * multiplier);

  let str = String(val).trim();
  // Check if string mentions sq yard or sq meter
  if (/sq\.?\s*y(ar)?d|varga?\s*vaar|varg/i.test(str)) {
    multiplier = 9;
  } else if (/sq\.?\s*m(t|tr|eter)?|sqm/i.test(str)) {
    multiplier = 10.764;
  }

  // Remove commas (e.g. 1,200 or 50,00,000)
  str = str.replace(/,/g, '');
  // Remove unit text
  str = str.replace(/sq\.?\s*ft\.?|sqft|sft|sq\.?\s*mt\.?|sqm|sq\.?\s*yd\.?|sqyd/gi, '');
  // Remove currency symbols
  str = str.replace(/[₹$€£]|rs\.?|inr/gi, '');

  const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
  if (match) {
    const num = parseFloat(match[0]);
    return isNaN(num) ? 0 : Math.round(num * multiplier);
  }
  return 0;
}

/** Creates a normalized row value getter that matches keys ignoring spaces, symbols, and case */
function createCleanRowGetter(row: Record<string, any>) {
  const map = new Map<string, any>();
  const originalEntries = Object.entries(row);

  for (const [key, val] of originalEntries) {
    if (!key) continue;
    const clean = String(key)
      .toLowerCase()
      .replace(/[\r\n\t_ \-\.\(\)\/\\\[\]\,\:\*\#]+/g, '')
      .trim();
    map.set(clean, val);
  }

  return function getVal(...candidateKeys: string[]): any {
    // 1. Exact match on cleaned candidate
    for (const cand of candidateKeys) {
      const cleanCand = cand
        .toLowerCase()
        .replace(/[\r\n\t_ \-\.\(\)\/\\\[\]\,\:\*\#]+/g, '')
        .trim();
      if (map.has(cleanCand)) {
        const v = map.get(cleanCand);
        if (v !== undefined && v !== null && v !== '') return v;
      }
    }
    // 2. Substring match fallback
    for (const cand of candidateKeys) {
      const cleanCand = cand
        .toLowerCase()
        .replace(/[\r\n\t_ \-\.\(\)\/\\\[\]\,\:\*\#]+/g, '')
        .trim();
      if (cleanCand.length < 3) continue;
      for (const [k, v] of map.entries()) {
        if (k.includes(cleanCand) || cleanCand.includes(k)) {
          if (v !== undefined && v !== null && v !== '') return v;
        }
      }
    }
    return undefined;
  };
}

/** Inspects worksheet and detects the real header row (skips title banners and empty rows) */
function extractRowsFromWorksheet(sheet: XLSX.WorkSheet): Record<string, any>[] {
  const defaultRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (defaultRows.length === 0) return [];

  const sampleKeys = Object.keys(defaultRows[0] || {}).map((k) =>
    k.toLowerCase().replace(/[^a-z0-9]/g, '')
  );
  const keywords = ['unit', 'flat', 'shop', 'area', 'carpet', 'sqft', 'price', 'rate', 'tower', 'floor', 'bhk', 'sba', 'size'];
  const hasRecognizedHeader = sampleKeys.some((k) => keywords.some((kw) => k.includes(kw)));

  if (hasRecognizedHeader) {
    return defaultRows;
  }

  // Inspect 2D array if top row had title banner or merged cells
  const aoa: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (aoa.length <= 1) return defaultRows;

  let bestHeaderIndex = -1;
  let bestScore = 0;

  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const row = aoa[i] || [];
    let score = 0;
    for (const cell of row) {
      const cellStr = String(cell || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (keywords.some((kw) => cellStr.includes(kw))) {
        score++;
      }
    }
    if (score > bestScore && score >= 2) {
      bestScore = score;
      bestHeaderIndex = i;
    }
  }

  if (bestHeaderIndex > 0) {
    return XLSX.utils.sheet_to_json(sheet, { range: bestHeaderIndex, defval: '' });
  }

  return defaultRows;
}

/** Generates a sample XLSX template with the exact real estate inventory columns from image */
export function generateSampleExcelTemplate(project?: { name?: string; projectCode?: string } | null): Buffer {
  const pName = project?.name || 'Santora';

  const headers = [
    'Sr.No.',
    'Project Name',
    'Block',
    'Floor',
    'Flat No.',
    'Prop. Plot Area In Sqmt',
    'Unit Built up Area In Sqmt',
    'Rera Carpet Area In Sqmt',
    'Wash & Balcony Area In Sqmt',
    'Open Terrace In Sqmt',
    'Sale deed Amount',
  ];

  const sampleRows = [
    [1, pName, 'A', '1st floor', 'A-101', 25.85, 68.80, 60.35, 4.59, 43.18, 4040000],
    [2, pName, 'A', '1st floor', 'A-102', 25.94, 69.02, 60.35, 4.59, 109.32, 4400000],
    [3, pName, 'A', '1st floor', 'A-103', 26.10, 69.44, 60.35, 4.59, 59.73, 4130000],
    [4, pName, 'A', '2nd floor', 'A-201', 25.85, 68.80, 60.35, 4.59, 0, 3800000],
    [5, pName, 'A', '2nd floor', 'A-202', 25.94, 69.02, 60.35, 4.59, 0, 3800000],
    [6, pName, 'A', '2nd floor', 'A-203', 25.94, 69.02, 60.35, 4.59, 0, 3800000],
    [7, pName, 'A', '2nd floor', 'A-204', 25.85, 68.80, 60.35, 4.59, 1.69, 3810000],
    [8, pName, 'A', '3rd floor', 'A-301', 25.85, 68.80, 60.35, 4.59, 0, 3800000],
    [9, pName, 'B', '1st floor', 'B-101', 25.85, 68.80, 60.35, 4.59, 0, 3800000],
    [10, pName, 'Commercial', 'Ground floor', 'SHOP-01', 18.50, 45.00, 38.20, 0, 0, 5200000],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

  worksheet['!cols'] = [
    { wch: 8 },  // Sr.No.
    { wch: 18 }, // Project Name
    { wch: 10 }, // Block
    { wch: 14 }, // Floor
    { wch: 12 }, // Flat No.
    { wch: 24 }, // Prop. Plot Area In Sqmt
    { wch: 26 }, // Unit Built up Area In Sqmt
    { wch: 26 }, // Rera Carpet Area In Sqmt
    { wch: 28 }, // Wash & Balcony Area In Sqmt
    { wch: 22 }, // Open Terrace In Sqmt
    { wch: 18 }, // Sale deed Amount
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/** Parses uploaded Excel buffer and produces a preview with error detection */
export async function parseAndPreviewExcel(
  buffer: Buffer,
  companyId: unknown,
  defaultProjectId?: string,
): Promise<ImportPreviewResult> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The uploaded Excel file contains no worksheets.');
  }

  // Find the worksheet with the most valid data
  let rawRows: Record<string, any>[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = extractRowsFromWorksheet(sheet);
    if (rows.length > rawRows.length) {
      rawRows = rows;
    }
  }

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

  // Pre-load default project if provided
  let fallbackProject: any = null;
  if (defaultProjectId) {
    fallbackProject = projectMap.get(String(defaultProjectId)) || null;
  }
  if (!fallbackProject && existingProjects.length > 0) {
    fallbackProject = existingProjects[0];
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

    const get = createCleanRowGetter(r);

    // 1. Project Resolution
    const rawProject = String(get('project', 'projectname', 'scheme', 'schemename') || '').trim();
    const matchedProject = (rawProject ? projectMap.get(rawProject.toLowerCase()) : null) || fallbackProject;

    // 2. Unit Number Resolution (flexible matching)
    const rawUnit = get(
      'unitnumber', 'unitno', 'unit', 'flatno', 'flatnumber', 'flat',
      'shopno', 'shopnumber', 'shop', 'roomno', 'room', 'doorno', 'no'
    );
    let unitNumber = String(rawUnit || '').trim().toUpperCase();

    // If unit number column wasn't found by name, check first column of row
    if (!unitNumber) {
      const firstColVal = Object.values(r)[0];
      if (firstColVal && String(firstColVal).trim().length > 0) {
        unitNumber = String(firstColVal).trim().toUpperCase();
      }
    }

    // Skip empty separator rows
    if (!unitNumber && Object.values(r).every((v) => !v)) {
      continue;
    }

    // 3. Category & Unit Type
    const rawCategory = String(get('category', 'propertycategory', 'unittypecategory') || '').trim().toLowerCase();
    const rawType = String(get('unittype', 'type', 'configuration', 'bhk', 'specification') || '').trim();

    let category: 'flat' | 'shop' | 'office' | 'penthouse' | 'plot' = 'flat';
    if (['shop', 'office', 'penthouse', 'plot', 'flat'].includes(rawCategory)) {
      category = rawCategory as any;
    } else if (rawType.toLowerCase().includes('shop') || /shop/i.test(unitNumber)) {
      category = 'shop';
    } else if (rawType.toLowerCase().includes('office')) {
      category = 'office';
    } else if (rawType.toLowerCase().includes('penthouse')) {
      category = 'penthouse';
    } else if (rawType.toLowerCase().includes('plot')) {
      category = 'plot';
    }

    const unitType = rawType || (category === 'shop' ? 'Commercial Shop' : 'Residential Flat');

    // 4. Tower & Floor Resolution
    const rawTower = get('tower', 'towername', 'wing', 'wingname', 'block', 'blockname', 'building');
    const towerName = (rawTower ? String(rawTower) : 'Tower A').trim();

    const rawFloor = get('floor', 'floorname', 'storey', 'level');
    let floorName = (rawFloor ? String(rawFloor) : '').trim();
    if (!floorName && unitNumber) {
      const digits = unitNumber.replace(/\D/g, '');
      if (digits.length >= 3) {
        const fl = digits.slice(0, digits.length - 2);
        floorName = `${fl}${fl === '1' ? 'st' : fl === '2' ? 'nd' : fl === '3' ? 'rd' : 'th'} Floor`;
      } else {
        floorName = '1st Floor';
      }
    }

    // 5. Bedrooms, Bathrooms, Balconies
    const rawBhk = get('bedrooms', 'bedroom', 'bhk', 'beds', 'bed');
    let bedrooms = parseNumber(rawBhk);
    if (!bedrooms) {
      const bhkMatch = unitType.match(/(\d+)\s*bhk/i);
      if (bhkMatch) bedrooms = parseInt(bhkMatch[1], 10);
    }
    if (category === 'shop') bedrooms = 0;

    const bathrooms = parseNumber(get('bathrooms', 'bathroom', 'baths', 'bath', 'toilets', 'toilet')) || (category === 'shop' ? 1 : undefined);
    const balconies = parseNumber(get('balconies', 'balcony', 'balc')) || (category === 'shop' ? 0 : undefined);
    const facing = String(get('facing', 'direction', 'orientation') || '').trim() || undefined;
    const notes = String(get('notes', 'remarks', 'description', 'comments') || '').trim() || undefined;

    // 6. Specific Sqmt Fields matching real estate inventory image
    const plotAreaSqmt = parseNumber(get('propplotareainsqmt', 'plotareainsqmt', 'plotareasqmt', 'propplotarea', 'plotarea', 'plotareainsqm'));
    const builtUpAreaSqmt = parseNumber(get('unitbuiltupareainsqmt', 'builtupareainsqmt', 'builtupareasqmt', 'unitbuiltuparea', 'bbuiltupareasqmt', 'builtupareasqm'));
    const carpetAreaSqmt = parseNumber(get('reracarpetareainsqmt', 'carpetareainsqmt', 'reracarpetarea', 'carpetareasqmt', 'reracarpet', 'carpetareasqm'));
    const balconyAreaSqmt = parseNumber(get('washbalconyareainsqmt', 'washandbalconyareainsqmt', 'washbalconyarea', 'washbalcony', 'balconyareainsqmt', 'balconyareasqmt', 'washareasqmt'));
    const terraceAreaSqmt = parseNumber(get('openterraceinsqmt', 'openterraceareasqmt', 'openterrace', 'terraceareainsqmt', 'terraceareasqmt', 'terracesqmt'));
    const saleDeedAmount = parseNumber(get('saledeedamount', 'saledeedamt', 'saledeedvalue', 'saledeed', 'deedamount', 'saledeedamountinrs'));

    // 7. Comprehensive Area Parsing & Fallback
    const carpetArea = parseNumber(get(
      'carpetarea', 'carpet', 'ca', 'netcarpet', 'netcarpetarea', 'carpetareasqft', 'carpetsqft', 'reraarea'
    ));

    const builtUpArea = parseNumber(get(
      'builtuparea', 'builtup', 'bua', 'builtupareasqft', 'builtupsqft',
      'constructionarea', 'constarea', 'plintharea'
    ));

    const superBuiltupArea = parseNumber(get(
      'superbuiltuparea', 'superbuiltup', 'superarea', 'sba', 'sbua',
      'saleablearea', 'salablearea', 'saleable', 'salable',
      'areasqft', 'area', 'sqft', 'sft', 'size', 'unitsize', 'flatsize', 'shopsize',
      'totalarea', 'grossarea'
    ));

    // Handle Sq. Yards (e.g. 120 sq yard = 1080 sqft) & Sq. Meters
    const sqYdArea = parseNumber(get('sqyd', 'sqyard', 'areasqyd', 'areasqyard', 'varg', 'vargvaar'), 9);
    const sqMtArea = parseNumber(get('sqmt', 'sqmeter', 'sqmtr', 'areasqmt', 'areasqm', 'areasqmtr'), 10.764);

    let resolvedCarpet = carpetArea || (carpetAreaSqmt > 0 ? Math.round(carpetAreaSqmt * 10.7639) : 0);
    let resolvedBuiltUp = builtUpArea || (builtUpAreaSqmt > 0 ? Math.round(builtUpAreaSqmt * 10.7639) : 0);
    let resolvedArea = superBuiltupArea || sqYdArea || sqMtArea || resolvedBuiltUp || resolvedCarpet || 0;

    // Cross-infer missing area measurements
    if (!resolvedArea && resolvedCarpet > 0) {
      resolvedArea = Math.round(resolvedCarpet * 1.33);
    }
    if (!resolvedBuiltUp && resolvedArea > 0) {
      resolvedBuiltUp = Math.round(resolvedArea * 0.9);
    }
    if (!resolvedCarpet && resolvedArea > 0) {
      resolvedCarpet = Math.round(resolvedArea * 0.75);
    }

    // 8. Rates, Pricing, and Extra Charges
    const rate = parseNumber(get('ratepersqft', 'rate', 'ratesqft', 'sqftrate', 'unitrate', 'base_rate'));
    let basePrice = parseNumber(get('baseprice', 'price', 'cost', 'unitprice', 'basecost'));
    if (saleDeedAmount > 0 && basePrice <= 0) {
      basePrice = saleDeedAmount;
    }
    const parkingSlot = String(get('parkingslot', 'parking', 'parkingspace', 'slot') || '').trim() || undefined;
    const parkingCharges = parseNumber(get('parkingcharges', 'parkingcost', 'parkingfee', 'parkingrate'));
    const clubhouseCharges = parseNumber(get('clubhousecharges', 'clubhouse', 'amenities', 'amenitiescharges'));
    const gstPercentage = parseNumber(get('gst', 'gstpercentage', 'tax', 'taxpercentage')) || (category === 'shop' ? 12 : 5);

    // Auto-calculate Base Price if area and rate exist
    if (basePrice <= 0 && rate > 0 && resolvedBuiltUp > 0) {
      basePrice = resolvedBuiltUp * rate;
    }

    let totalValue = parseNumber(get('totalvalue', 'totalprice', 'totalamount', 'finalprice', 'grandtotal'));
    if (saleDeedAmount > 0 && totalValue <= 0) {
      totalValue = saleDeedAmount;
    }
    if (totalValue <= 0) {
      totalValue = basePrice + parkingCharges + clubhouseCharges;
    }

    // Smart area fallback from Price & Rate if area was missing or 0
    if (resolvedArea <= 0 && (basePrice > 0 || totalValue > 0) && rate > 0) {
      const priceForCalc = basePrice > 0 ? basePrice : totalValue;
      resolvedArea = Math.round(priceForCalc / rate);
      resolvedCarpet = Math.round(resolvedArea * 0.75);
      resolvedBuiltUp = resolvedArea;
    }

    // Smart area fallback from BHK configuration if still 0
    if (resolvedArea <= 0) {
      if (bedrooms === 1 || /1\s*bhk/i.test(unitType)) {
        resolvedArea = 600;
        resolvedCarpet = 450;
        resolvedBuiltUp = 550;
      } else if (bedrooms === 2 || /2\s*bhk/i.test(unitType)) {
        resolvedArea = 900;
        resolvedCarpet = 675;
        resolvedBuiltUp = 800;
      } else if (bedrooms === 3 || /3\s*bhk/i.test(unitType)) {
        resolvedArea = 1400;
        resolvedCarpet = 1050;
        resolvedBuiltUp = 1250;
      } else if (bedrooms >= 4 || /4\s*bhk/i.test(unitType)) {
        resolvedArea = 2200;
        resolvedCarpet = 1650;
        resolvedBuiltUp = 1950;
      } else if (category === 'shop' || /shop|retail|showroom/i.test(unitType)) {
        resolvedArea = 450;
        resolvedCarpet = 350;
        resolvedBuiltUp = 400;
      } else {
        // Minimum non-blocking fallback
        resolvedArea = 500;
        resolvedCarpet = 375;
        resolvedBuiltUp = 450;
      }
    }

    // If price is still 0, auto-estimate from default reasonable rate
    if (basePrice <= 0 && totalValue <= 0) {
      const defaultRate = category === 'shop' ? 10000 : 4500;
      basePrice = resolvedArea * defaultRate;
      totalValue = basePrice + parkingCharges + clubhouseCharges;
    }

    const rawStatus = String(get('status', 'unitstatus', 'state') || 'available').trim().toLowerCase();
    const status = ['available', 'reserved', 'booked', 'sold', 'blocked'].includes(rawStatus)
      ? (rawStatus as any)
      : 'available';

    // 9. Row Validations
    if (!matchedProject) {
      errors.push({
        rowNumber,
        unitNumber,
        projectName: rawProject || undefined,
        reason: rawProject
          ? `Project "${rawProject}" does not exist in BuildTrack. Please verify spelling or create it first.`
          : 'Project name is missing. Please specify Project column or select one in the app.',
      });
      continue;
    }

    if (!unitNumber) {
      errors.push({ rowNumber, reason: 'Unit Number / Flat No is required' });
      continue;
    }

    // Duplicate detection against DB
    const dbKey = `${String(matchedProject._id)}::${unitNumber}`;
    if (existingUnitSet.has(dbKey)) {
      duplicateCount++;
      errors.push({
        rowNumber,
        unitNumber,
        projectName: matchedProject.name,
        reason: `Unit "${unitNumber}" already exists in Project "${matchedProject.name}". Duplicate skipped.`,
      });
      continue;
    }

    // Duplicate detection within the file
    if (internalSeenUnits.has(dbKey)) {
      duplicateCount++;
      errors.push({
        rowNumber,
        unitNumber,
        projectName: matchedProject.name,
        reason: `Duplicate in file: Unit "${unitNumber}" appears more than once in this spreadsheet.`,
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
      category,
      area: resolvedArea,
      carpetArea: resolvedCarpet,
      builtUpArea: resolvedBuiltUp,
      superBuiltupArea: resolvedArea,
      plotAreaSqmt: plotAreaSqmt || undefined,
      builtUpAreaSqmt: builtUpAreaSqmt || undefined,
      carpetAreaSqmt: carpetAreaSqmt || undefined,
      balconyAreaSqmt: balconyAreaSqmt || undefined,
      terraceAreaSqmt: terraceAreaSqmt || undefined,
      saleDeedAmount: saleDeedAmount || undefined,
      rate: rate || Math.round(basePrice / (resolvedBuiltUp || resolvedArea || 1)),
      price: totalValue,
      basePrice,
      parkingSlot,
      parkingCharges,
      clubhouseCharges,
      gstPercentage,
      totalValue,
      status,
      facing,
      bedrooms,
      bathrooms,
      balconies,
      notes,
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

  const towerCache = new Map<string, any>();
  const floorCache = new Map<string, any>();

  let towersCreated = 0;
  let floorsCreated = 0;

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

    // 3. Prepare full Unit document
    const unitArea = row.superBuiltupArea || row.area || row.builtUpArea || row.carpetArea || 0;
    const carpetArea = row.carpetArea || Math.round(unitArea * 0.75);
    const builtUpArea = row.builtUpArea || unitArea;
    const basePrice = row.basePrice || row.price || 0;
    const totalVal = row.totalValue || row.price || basePrice;

    unitsToInsert.push({
      companyId,
      projectId,
      blockId: tower._id,
      towerId: tower._id,
      floorId: floor._id,
      category: row.category || 'flat',
      unitNumber: row.unitNumber,
      unitType: row.unitType || (row.category === 'shop' ? 'Commercial Shop' : 'Residential Flat'),
      areaSqft: unitArea,
      carpetAreaSqft: carpetArea,
      builtUpAreaSqft: builtUpArea,
      superBuiltupAreaSqft: unitArea,
      plotAreaSqmt: row.plotAreaSqmt || null,
      builtUpAreaSqmt: row.builtUpAreaSqmt || null,
      carpetAreaSqmt: row.carpetAreaSqmt || null,
      balconyAreaSqmt: row.balconyAreaSqmt || null,
      terraceAreaSqmt: row.terraceAreaSqmt || null,
      saleDeedAmount: row.saleDeedAmount || null,
      bedrooms: row.bedrooms !== undefined ? row.bedrooms : (row.category === 'shop' ? 0 : null),
      bathrooms: row.bathrooms !== undefined ? row.bathrooms : (row.category === 'shop' ? 1 : null),
      balconies: row.balconies !== undefined ? row.balconies : 0,
      facing: row.facing || null,
      ratePerSqft: row.rate || (unitArea > 0 ? Math.round(basePrice / unitArea) : 0),
      basePrice: basePrice,
      parkingSlot: row.parkingSlot || null,
      parkingCharges: row.parkingCharges || 0,
      clubhouseCharges: row.clubhouseCharges || 0,
      gstPercentage: row.gstPercentage || (row.category === 'shop' ? 12 : 5),
      totalValue: totalVal,
      finalPrice: totalVal,
      status: row.status || 'available',
      notes: row.notes || null,
    });
  }

  let insertedUnits = 0;
  if (unitsToInsert.length > 0) {
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
