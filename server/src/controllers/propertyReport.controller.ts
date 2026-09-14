import type { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { sendSuccess } from '../utils/apiResponse';
import { Unit } from '../models/Unit';
import { Payment } from '../models/Payment';
import { Booking } from '../models/Booking';
import { Customer } from '../models/Customer';
import { PropertyDocument } from '../models/PropertyDocument';
import { Project } from '../models/Project';
import { utcDay, addDays, startOfMonthUtc } from '../utils/dates';
import type { AuthUser } from '../types';

type Req = Request & { validatedQuery?: any };

// ── Property Dashboard ────────────────────────────────────────────

export async function getPropertyDashboard(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const companyId = user.companyId;
  const today = utcDay(new Date());
  const monthStart = startOfMonthUtc();

  const [
    unitsAgg,
    todayCollectionAgg,
    monthCollectionAgg,
    pendingPaymentsAgg,
    overduePaymentsAgg,
    recentBookings,
    recentReceipts,
    projectRevenueAgg,
  ] = await Promise.all([
    // Inventory Counts & Values
    Unit.aggregate([
      { $match: { companyId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$totalValue' },
        },
      },
    ]),

    // Today's Collection
    Payment.aggregate([
      {
        $match: {
          companyId,
          status: 'paid',
          paidDate: { $gte: today, $lt: addDays(today, 1) },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),

    // Monthly Collection
    Payment.aggregate([
      {
        $match: {
          companyId,
          status: 'paid',
          paidDate: { $gte: monthStart, $lt: addDays(today, 1) },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),

    // Pending Payments
    Payment.aggregate([
      { $match: { companyId, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),

    // Overdue Payments
    Payment.aggregate([
      { $match: { companyId, status: 'pending', dueDate: { $lt: today } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),

    // Recent Bookings
    Booking.find({ companyId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('customerId', 'name phone')
      .populate('projectId', 'name')
      .populate('unitId', 'unitNumber unitType')
      .lean(),

    // Recent Receipts
    Payment.find({ companyId, status: 'paid', receiptNumber: { $ne: null } })
      .sort({ paidDate: -1 })
      .limit(5)
      .populate('customerId', 'name')
      .populate('unitId', 'unitNumber')
      .lean(),

    // Project Revenue
    Booking.aggregate([
      { $match: { companyId, status: { $in: ['confirmed', 'sold'] } } },
      {
        $group: {
          _id: '$projectId',
          bookedValue: { $sum: '$totalValue' },
          bookingsCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'projects',
          localField: '_id',
          foreignField: '_id',
          as: 'project',
        },
      },
      { $unwind: '$project' },
      {
        $project: {
          projectId: '$_id',
          projectName: '$project.name',
          projectCode: '$project.projectCode',
          bookedValue: 1,
          bookingsCount: 1,
        },
      },
    ]),
  ]);

  const unitMap: Record<string, { count: number; value: number }> = {};
  for (const u of unitsAgg) {
    unitMap[u._id] = { count: u.count, value: Math.round(u.totalValue) };
  }

  const availableUnits = unitMap.available?.count || 0;
  const bookedUnits = (unitMap.booked?.count || 0) + (unitMap.reserved?.count || 0);
  const soldUnits = unitMap.sold?.count || 0;
  const totalUnits = availableUnits + bookedUnits + soldUnits;

  sendSuccess(res, {
    inventory: {
      totalUnits,
      availableUnits,
      bookedUnits,
      soldUnits,
      availableValue: unitMap.available?.value || 0,
      bookedValue: (unitMap.booked?.value || 0) + (unitMap.reserved?.value || 0),
      soldValue: unitMap.sold?.value || 0,
    },
    collections: {
      today: Math.round(todayCollectionAgg[0]?.total || 0),
      todayCount: todayCollectionAgg[0]?.count || 0,
      monthly: Math.round(monthCollectionAgg[0]?.total || 0),
      monthlyCount: monthCollectionAgg[0]?.count || 0,
      pending: Math.round(pendingPaymentsAgg[0]?.total || 0),
      pendingCount: pendingPaymentsAgg[0]?.count || 0,
      overdue: Math.round(overduePaymentsAgg[0]?.total || 0),
      overdueCount: overduePaymentsAgg[0]?.count || 0,
    },
    recentBookings,
    recentReceipts,
    projectRevenue: projectRevenueAgg,
  });
}

// ── Property Reports Generator ────────────────────────────────────

export async function generatePropertyReport(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const companyId = user.companyId;
  const q = req.query as any;
  const reportType = q.type || 'inventory';

  let rows: any[] = [];
  let totals: Record<string, any> = {};

  switch (reportType) {
    case 'inventory': {
      const units = await Unit.find({ companyId })
        .populate('projectId', 'name')
        .populate('blockId', 'name')
        .populate('floorId', 'name')
        .sort({ unitNumber: 1 })
        .lean();

      rows = units.map((u: any) => ({
        unitNumber: u.unitNumber,
        category: u.category || 'flat',
        unitType: u.unitType,
        project: u.projectId?.name || 'N/A',
        tower: u.blockId?.name || 'Tower A',
        floor: u.floorId?.name || '1st Floor',
        areaSqft: u.areaSqft,
        ratePerSqft: u.ratePerSqft,
        price: Math.round(u.totalValue),
        status: u.status,
      }));

      totals = {
        totalUnits: rows.length,
        available: rows.filter((r) => r.status === 'available').length,
        booked: rows.filter((r) => r.status === 'booked' || r.status === 'reserved').length,
        sold: rows.filter((r) => r.status === 'sold').length,
        totalInventoryValue: rows.reduce((s, r) => s + r.price, 0),
      };
      break;
    }

    case 'booking': {
      const bookings = await Booking.find({ companyId })
        .populate('projectId', 'name')
        .populate('unitId', 'unitNumber unitType')
        .populate('customerId', 'name phone')
        .populate('salesManagerId', 'name')
        .sort({ bookingDate: -1 })
        .lean();

      rows = bookings.map((b: any) => ({
        bookingNumber: b.bookingNumber,
        bookingDate: new Date(b.bookingDate).toLocaleDateString('en-IN'),
        customer: b.customerId?.name || 'N/A',
        customerPhone: b.customerId?.phone || 'N/A',
        project: b.projectId?.name || 'N/A',
        unitNumber: b.unitId?.unitNumber || 'N/A',
        unitType: b.unitId?.unitType || 'N/A',
        totalPrice: Math.round(b.totalValue),
        bookingAmount: Math.round(b.bookingAmount),
        discountAmount: Math.round(b.discountAmount || 0),
        status: b.status,
      }));

      totals = {
        totalBookings: rows.length,
        totalValue: rows.reduce((s, r) => s + r.totalPrice, 0),
        totalBookingAmountReceived: rows.reduce((s, r) => s + r.bookingAmount, 0),
        totalDiscounts: rows.reduce((s, r) => s + r.discountAmount, 0),
      };
      break;
    }

    case 'receipt': {
      const payments = await Payment.find({ companyId, status: 'paid', receiptNumber: { $ne: null } })
        .populate('customerId', 'name phone')
        .populate('projectId', 'name')
        .populate('unitId', 'unitNumber')
        .sort({ paidDate: -1 })
        .lean();

      rows = payments.map((p: any) => ({
        receiptNumber: p.receiptNumber,
        date: new Date(p.paidDate || p.createdAt).toLocaleDateString('en-IN'),
        customer: p.customerId?.name || 'N/A',
        project: p.projectId?.name || 'N/A',
        unitNumber: p.unitId?.unitNumber || 'N/A',
        amount: Math.round(p.amount),
        mode: (p.mode || p.method || 'CASH').toUpperCase(),
        refNo: p.transactionId || p.chequeNumber || p.reference || 'N/A',
      }));

      totals = {
        totalReceipts: rows.length,
        totalAmountCollected: rows.reduce((s, r) => s + r.amount, 0),
      };
      break;
    }

    case 'outstanding': {
      const pending = await Payment.find({ companyId, status: 'pending' })
        .populate('customerId', 'name phone')
        .populate('projectId', 'name')
        .populate('unitId', 'unitNumber')
        .sort({ dueDate: 1 })
        .lean();

      const now = Date.now();
      rows = pending.map((p: any) => {
        const isOverdue = p.dueDate ? new Date(p.dueDate).getTime() < now : false;
        return {
          customer: p.customerId?.name || 'N/A',
          phone: p.customerId?.phone || 'N/A',
          project: p.projectId?.name || 'N/A',
          unitNumber: p.unitId?.unitNumber || 'N/A',
          amountDue: Math.round(p.amount),
          dueDate: p.dueDate ? new Date(p.dueDate).toLocaleDateString('en-IN') : 'N/A',
          status: isOverdue ? 'OVERDUE' : 'UPCOMING',
        };
      });

      totals = {
        totalDuesCount: rows.length,
        totalOutstandingAmount: rows.reduce((s, r) => s + r.amountDue, 0),
        overdueCount: rows.filter((r) => r.status === 'OVERDUE').length,
        overdueAmount: rows.filter((r) => r.status === 'OVERDUE').reduce((s, r) => s + r.amountDue, 0),
      };
      break;
    }

    case 'banakhat': {
      const docs = await PropertyDocument.find({ companyId, documentType: 'banakhat' })
        .populate('customerId', 'name phone')
        .populate('projectId', 'name')
        .populate('unitId', 'unitNumber')
        .sort({ createdAt: -1 })
        .lean();

      rows = docs.map((d: any) => ({
        documentNumber: d.documentNumber,
        title: d.title,
        customer: d.customerId?.name || 'N/A',
        project: d.projectId?.name || 'N/A',
        unitNumber: d.unitId?.unitNumber || 'N/A',
        status: d.status,
        date: new Date(d.createdAt).toLocaleDateString('en-IN'),
      }));

      totals = {
        totalBanakhats: rows.length,
        signed: rows.filter((r) => r.status === 'signed').length,
        registered: rows.filter((r) => r.status === 'registered').length,
      };
      break;
    }

    case 'dastavej': {
      const docs = await PropertyDocument.find({ companyId, documentType: 'dastavej' })
        .populate('customerId', 'name phone')
        .populate('projectId', 'name')
        .populate('unitId', 'unitNumber')
        .sort({ createdAt: -1 })
        .lean();

      rows = docs.map((d: any) => ({
        documentNumber: d.documentNumber,
        title: d.title,
        customer: d.customerId?.name || 'N/A',
        project: d.projectId?.name || 'N/A',
        unitNumber: d.unitId?.unitNumber || 'N/A',
        status: d.status,
        registrationNumber: d.registrationDetails?.registrationNumber || 'Pending',
        subRegistrarOffice: d.registrationDetails?.subRegistrarOffice || 'Pending',
        date: new Date(d.createdAt).toLocaleDateString('en-IN'),
      }));

      totals = {
        totalDastavejs: rows.length,
        registered: rows.filter((r) => r.status === 'registered').length,
      };
      break;
    }

    case 'customer_ledger': {
      const customerId = q.customerId;
      if (!customerId) {
        // Return summary of all customers
        const customers = await Customer.find({ companyId }).sort({ name: 1 }).lean();
        rows = customers.map((c: any) => ({
          name: c.name,
          phone: c.phone,
          pan: c.pan || 'N/A',
          leadSource: c.leadSource,
          journeyStage: c.journeyStage,
        }));
        totals = { totalCustomers: rows.length };
      } else {
        const [customer, payments, bookings] = await Promise.all([
          Customer.findOne({ _id: customerId, companyId }).lean(),
          Payment.find({ customerId, companyId }).sort({ paidDate: 1, dueDate: 1 }).lean(),
          Booking.find({ customerId, companyId }).populate('unitId').lean(),
        ]);

        rows = payments.map((p: any) => ({
          date: new Date(p.paidDate || p.dueDate || p.createdAt).toLocaleDateString('en-IN'),
          particulars: p.receiptNumber ? `Payment Received (${p.receiptNumber})` : `Due Installment`,
          type: p.status === 'paid' ? 'CREDIT' : 'DEBIT',
          amount: Math.round(p.amount),
          status: p.status,
        }));

        const totalDebits = bookings.reduce((s: number, b: any) => s + (b.totalValue || 0), 0);
        const totalCredits = payments.filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + p.amount, 0);

        totals = {
          customerName: customer?.name,
          totalPrice: totalDebits,
          totalPaid: totalCredits,
          balanceDue: Math.max(0, totalDebits - totalCredits),
        };
      }
      break;
    }
  }

  sendSuccess(res, {
    reportType,
    generatedAt: new Date(),
    rows,
    totals,
  });
}

// ── Export Property Report to Excel ───────────────────────────────

export async function exportPropertyReportExcel(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const companyId = user.companyId;
  const q = req.query as any;
  const reportType = q.type || 'inventory';

  // Fetch report data
  const reportReq = { ...req, user, query: q } as any;
  let reportData: any = null;

  const mockRes: any = {
    json: (payload: any) => {
      reportData = payload.data;
    },
    status: () => mockRes,
  };

  await generatePropertyReport(reportReq, mockRes);

  if (!reportData || !reportData.rows || reportData.rows.length === 0) {
    // Generate empty sheet with message
    const ws = XLSX.utils.aoa_to_sheet([['No records found for this report.']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="BuildTrack_${reportType}_Report.xlsx"`);
    return res.send(buffer);
  }

  const ws = XLSX.utils.json_to_sheet(reportData.rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, reportType.toUpperCase());

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="BuildTrack_${reportType}_Report.xlsx"`);
  res.send(buffer);
  return;
}

// ── Export Property Report to PDF ─────────────────────────────────

export async function exportPropertyReportPdf(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.query as any;
  const reportType = q.type || 'inventory';

  // Fetch report data
  let reportData: any = null;
  const mockRes: any = {
    json: (payload: any) => {
      reportData = payload.data;
    },
    status: () => mockRes,
  };

  await generatePropertyReport({ ...req, user, query: q } as any, mockRes);

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => {
    const buffer = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="BuildTrack_${reportType}_Report.pdf"`);
    res.send(buffer);
  });

  // Header
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#E8590C').text(`BUILDTRACK - ${reportType.toUpperCase()} REPORT`);
  doc.fontSize(8.5).font('Helvetica').fillColor('#777777').text(`Generated: ${new Date().toLocaleString('en-IN')} | Scope: Company Operations`);
  doc.moveDown(1);
  doc.strokeColor('#CCCCCC').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(1);

  // Totals Box
  if (reportData?.totals) {
    doc.rect(40, doc.y, 515, 30).fill('#F6F4F1');
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#17263B');
    const summaryStr = Object.entries(reportData.totals)
      .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').toUpperCase()}: ${v}`)
      .join('   |   ');
    doc.text(summaryStr, 50, doc.y + 9, { width: 500 });
    doc.moveDown(2);
  }

  // Rows Table (first 50)
  const rows = reportData?.rows || [];
  if (rows.length === 0) {
    doc.fontSize(10).font('Helvetica').fillColor('#555555').text('No entries found for this report period.');
  } else {
    const firstRow = rows[0];
    const columns = Object.keys(firstRow).slice(0, 6);
    const colWidth = 515 / columns.length;

    // Header Row
    const headerY = doc.y;
    doc.rect(40, headerY, 515, 20).fill('#17263B');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
    columns.forEach((col, idx) => {
      doc.text(col.replace(/([A-Z])/g, ' $1').toUpperCase(), 45 + idx * colWidth, headerY + 6, {
        width: colWidth - 8,
      });
    });

    let currentY = headerY + 20;
    doc.font('Helvetica').fontSize(7.5).fillColor('#333333');

    for (const r of rows.slice(0, 40)) {
      if (currentY > 750) {
        doc.addPage();
        currentY = 40;
      }
      doc.rect(40, currentY, 515, 18).fillAndStroke(currentY % 2 === 0 ? '#FAFAFA' : '#FFFFFF', '#EAEAEA');
      columns.forEach((col, idx) => {
        doc.text(String(r[col] ?? ''), 45 + idx * colWidth, currentY + 5, {
          width: colWidth - 8,
          lineBreak: false,
        });
      });
      currentY += 18;
    }
  }

  doc.end();
}
