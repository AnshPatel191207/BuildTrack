import { ApiError, sendSuccess } from '../utils/apiResponse';
import { accessibleProjectsFilter, assertProjectAccess } from '../utils/accessControl';
import { hasPermission } from '../utils/permissions';
import { utcDay, addDays, startOfMonthUtc } from '../utils/dates';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

type Req = Request & { validatedQuery?: any };

export const REPORT_TYPES = [
  'project',
  'sales',
  'booking',
  'payment',
  'progress',
  'vendor',
  'contractor',
  'attendance',
  'expense',
  'inventory',
] as const;

type ReportType = (typeof REPORT_TYPES)[number];

/**
 * Module 22 — reporting system.
 * GET /api/analytics/reports?type=…&projectId=…&from=…&to=…
 * Returns structured JSON that the mobile client renders natively and can
 * share as text/CSV via the OS share sheet.
 */
export async function generateReport(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageReports')) {
    throw ApiError.forbidden('You cannot generate reports.');
  }
  const q = req.validatedQuery ?? {};
  const type = q.type as ReportType;

  const to = q.to ? addDays(utcDay(q.to), 1) : utcDay(new Date());
  const from = q.from ? utcDay(q.from) : addDays(to, -30);

  let projectFilter = await accessibleProjectsFilter(user);
  if (q.projectId) {
    await assertProjectAccess(user, q.projectId);
    projectFilter = { ...projectFilter, _id: q.projectId };
  }
  const projects: any[] = await import('../models/Project.js').then(({ Project }) =>
    Project.find(projectFilter).lean(),
  );
  const projectIds = projects.map((p) => p._id);
  const projectName = new Map<string, string>(projects.map((p) => [String(p._id), p.name]));

  switch (type) {
    case 'project': {
      const rows = [];
      for (const p of projects) {
        const expenseAgg = await import('../models/Expense.js').then(({ Expense }) =>
          Expense.aggregate([
            { $match: { projectId: p._id, date: { $gte: from, $lt: to } } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
          ]),
        );
        const workerCount = await import('../models/Worker.js').then(({ Worker }) =>
          Worker.countDocuments({ projectId: p._id, status: 'active' }),
        );
        rows.push({
          _id: p._id,
          name: p.name,
          code: p.projectCode,
          clientName: p.clientName,
          location: p.location,
          status: p.status,
          progressPercentage: p.progressPercentage,
          budget: Math.round(p.budget ?? 0),
          spentAmount: Math.round(p.spentAmount ?? 0),
          expensesInRange: Math.round(expenseAgg[0]?.total ?? 0),
          activeWorkers: workerCount,
          startDate: p.startDate,
          expectedEndDate: p.expectedEndDate,
        });
      }
      return sendSuccess(res, {
        type,
        generatedAt: new Date(),
        period: { from, to },
        rows,
        totals: {
          budget: rows.reduce((s, r) => s + r.budget, 0),
          spent: rows.reduce((s, r) => s + r.spentAmount, 0),
          progress:
            rows.length > 0
              ? Math.round(rows.reduce((s, r) => s + r.progressPercentage, 0) / rows.length)
              : 0,
        },
      });
    }

    case 'sales': {
      const { Lead } = await import('../models/Lead.js');
      const [byStage, bySource, bookings] = await Promise.all([
        Lead.aggregate([
          { $match: { companyId: user.companyId, createdAt: { $gte: from, $lt: to } } },
          { $group: { _id: '$stage', count: { $sum: 1 }, value: { $sum: '$convertedValue' } } },
        ]),
        Lead.aggregate([
          { $match: { companyId: user.companyId, createdAt: { $gte: from, $lt: to } } },
          {
            $group: {
              _id: '$source',
              count: { $sum: 1 },
              won: { $sum: { $cond: [{ $eq: ['$stage', 'booked'] }, 1, 0] } },
            },
          },
          { $sort: { count: -1 } },
        ]),
        import('../models/Booking.js').then(({ Booking }) =>
          Booking.find({
            companyId: user.companyId,
            bookingDate: { $gte: from, $lt: to },
            status: { $ne: 'cancelled' },
          })
            .populate('customerId', 'name')
            .populate('unitId', 'unitNumber')
            .populate('salesManagerId', 'name'),
        ),
      ]);
      return sendSuccess(res, {
        type,
        generatedAt: new Date(),
        period: { from, to },
        leadsByStage: byStage.map((s: any) => ({
          stage: s._id,
          count: s.count,
          value: Math.round(s.value ?? 0),
        })),
        leadsBySource: bySource.map((s: any) => ({ source: s._id, count: s.count, won: s.won })),
        bookings: bookings.map((b: any) => ({
          _id: b._id,
          bookingNumber: b.bookingNumber,
          customerName: b.customerId?.name,
          unit: b.unitId?.unitNumber,
          salesManagerName: b.salesManagerId?.name,
          bookingDate: b.bookingDate,
          totalValue: b.totalValue,
          status: b.status,
        })),
        totals: {
          bookings: bookings.length,
          bookedValue: bookings.reduce((s: number, b: any) => s + b.totalValue, 0),
          totalLeads: byStage.reduce((s: number, x: any) => s + x.count, 0),
        },
      });
    }

    case 'booking': {
      const { Booking } = await import('../models/Booking.js');
      const filter: Record<string, unknown> = {
        companyId: user.companyId,
        projectId: { $in: projectIds },
      };
      if (!q.allTime || q.allTime !== 'true') filter.bookingDate = { $gte: from, $lt: to };
      const [bookings, statusTotals] = await Promise.all([
        Booking.find(filter)
          .sort({ bookingDate: -1 })
          .populate('projectId', 'name')
          .populate('unitId', 'unitNumber unitType')
          .populate('customerId', 'name phone')
          .populate('salesManagerId', 'name'),
        Booking.aggregate([
          { $match: filter },
          { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$totalValue' } } },
        ]),
      ]);
      return sendSuccess(res, {
        type,
        generatedAt: new Date(),
        period: { from, to },
        rows: bookings.map((b: any) => ({
          _id: b._id,
          bookingNumber: b.bookingNumber,
          projectName: b.projectId?.name,
          unit: b.unitId ? `${b.unitId.unitNumber} (${b.unitId.unitType})` : '',
          customerName: b.customerId?.name,
          customerPhone: b.customerId?.phone,
          bookingDate: b.bookingDate,
          bookingAmount: b.bookingAmount,
          totalValue: b.totalValue,
          salesManagerName: b.salesManagerId?.name,
          status: b.status,
        })),
        statusTotals: statusTotals.map((s: any) => ({
          status: s._id,
          count: s.count,
          value: Math.round(s.value),
        })),
      });
    }

    case 'payment': {
      const { Payment } = await import('../models/Payment.js');
      const match: Record<string, unknown> = {
        companyId: user.companyId,
        projectId: { $in: projectIds },
        createdAt: { $gte: from, $lt: to },
      };
      const [paidRows, pendingRows] = await Promise.all([
        Payment.find({ ...match, status: 'paid' })
          .sort({ paidDate: -1 })
          .limit(500)
          .populate('customerId', 'name phone')
          .populate('projectId', 'name')
          .populate('bookingId', 'bookingNumber'),
        Payment.aggregate([
          { $match: { ...match, status: 'pending' } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
      ]);
      return sendSuccess(res, {
        type,
        generatedAt: new Date(),
        period: { from, to },
        received: paidRows.map((p: any) => ({
          _id: p._id,
          paymentNumber: p.paymentNumber,
          projectName: p.projectId?.name,
          customerName: p.customerId?.name,
          bookingNumber: p.bookingId?.bookingNumber,
          amount: Math.round(p.amount),
          paymentType: p.paymentType,
          method: p.method,
          paidDate: p.paidDate,
        })),
        outstanding: Math.round(pendingRows[0]?.total ?? 0),
        outstandingCount: pendingRows[0]?.count ?? 0,
        totals: { collected: paidRows.reduce((s: number, p: any) => s + p.amount, 0) },
      });
    }

    case 'progress': {
      const { ConstructionStage, STANDARD_STAGE_NAMES } = await import('../models/ConstructionStage.js');
      const { ProjectNode } = await import('../models/ProjectNode.js');
      const [stages, blocks, workAgg] = await Promise.all([
        ConstructionStage.find({ projectId: { $in: projectIds } }).sort({ order: 1 }),
        ProjectNode.find({ projectId: { $in: projectIds }, nodeType: 'block' }).populate(
          'projectId',
          'name',
        ),
        import('../models/WorkItem.js').then(({ WorkItem }) =>
          WorkItem.aggregate([
            { $match: { projectId: { $in: projectIds } } },
            {
              $group: {
                _id: '$projectId',
                avgProgress: { $avg: '$progressPercentage' },
                count: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
              },
            },
          ]),
        ),
      ]);
      return sendSuccess(res, {
        type,
        generatedAt: new Date(),
        period: { from, to },
        overallProgress:
          projects.length > 0
            ? Math.round(
                projects.reduce((s, p) => s + (p.progressPercentage ?? 0), 0) / projects.length,
              )
            : 0,
        blocks: blocks.map((n: any) => ({
          _id: n._id,
          projectName: n.projectId?.name,
          name: n.name,
          progressPercentage: n.progressPercentage,
        })),
        stageSummary: stages.map((s: any) => ({
          projectName: projectName.get(String(s.projectId)),
          stage:
            s.name === 'custom'
              ? s.customName
              : STANDARD_STAGE_NAMES.find((x) => x.value === s.name)?.label ?? s.name,
          status: s.status,
          progressPercentage: s.progressPercentage,
          startDate: s.startDate,
          endDate: s.endDate,
        })),
        workItemsByProject: workAgg.map((w: any) => ({
          projectName: projectName.get(String(w._id)),
          items: w.count,
          completed: w.completed,
          avgProgress: Math.round(w.avgProgress ?? 0),
        })),
      });
    }

    case 'vendor': {
      const { Vendor } = await import('../models/Vendor.js');
      const { PurchaseOrder } = await import('../models/PurchaseOrder.js');
      const vendors = await Vendor.find({ companyId: user.companyId }).sort({ name: 1 });
      const stats = await PurchaseOrder.aggregate([
        {
          $match: {
            vendorId: { $in: vendors.map((v: any) => v._id) },
            status: { $ne: 'cancelled' },
            createdAt: { $gte: from, $lt: to },
          },
        },
        {
          $group: {
            _id: '$vendorId',
            orders: { $sum: 1 },
            delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
            ordered: { $sum: '$totalAmount' },
            paid: { $sum: '$paidAmount' },
          },
        },
      ]);
      type VendorStat = { orders?: number; delivered?: number; ordered?: number; paid?: number };
      const statMap = new Map<string, VendorStat>(
        stats.map((s: any) => [
          String(s._id),
          { orders: s.orders, delivered: s.delivered, ordered: s.ordered, paid: s.paid },
        ]),
      );
      return sendSuccess(res, {
        type,
        generatedAt: new Date(),
        period: { from, to },
        rows: vendors.map((v: any) => {
          const s = statMap.get(String(v._id)) ?? {};
          return {
            _id: v._id,
            name: v.name,
            gstNumber: v.gstNumber,
            phone: v.phone,
            materialsSupplied: v.materialsSupplied,
            orders: s.orders ?? 0,
            delivered: s.delivered ?? 0,
            orderedValue: Math.round(s.ordered ?? 0),
            paidValue: Math.round(s.paid ?? 0),
            outstanding: Math.round((s.ordered ?? 0) - (s.paid ?? 0)),
          };
        }),
      });
    }

    case 'contractor': {
      const contracts = await import('../models/Contractor.js').then(({ ContractorContract }) =>
        ContractorContract.find({ projectId: { $in: projectIds } })
          .populate('contractorId', 'name companyName phone workTypes')
          .populate('projectId', 'name'),
      );
      return sendSuccess(res, {
        type,
        generatedAt: new Date(),
        period: { from, to },
        rows: contracts.map((c: any) => ({
          _id: c._id,
          contractorName: c.contractorId?.name,
          companyName: c.contractorId?.companyName,
          phone: c.contractorId?.phone,
          workTypes: c.contractorId?.workTypes,
          projectName: c.projectId?.name,
          scope: c.scope,
          contractValue: c.contractValue,
          paidAmount: c.paidAmount,
          pendingAmount: Math.max(c.contractValue - c.paidAmount, 0),
          status: c.status,
        })),
        totals: {
          contractValue: contracts.reduce((s: number, c: any) => s + c.contractValue, 0),
          paid: contracts.reduce((s: number, c: any) => s + c.paidAmount, 0),
        },
      });
    }

    case 'attendance': {
      const rows = await import('../models/Attendance.js').then(({ Attendance }) =>
        Attendance.aggregate([
          {
            $match: {
              companyId: user.companyId,
              projectId: { $in: projectIds },
              date: { $gte: from, $lt: to },
            },
          },
          {
            $group: {
              _id: { workerId: '$workerId', projectId: '$projectId' },
              present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
              halfDay: { $sum: { $cond: [{ $eq: ['$status', 'half_day'] }, 1, 0] } },
              absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
              leave: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } },
              overtime: { $sum: '$overtimeHours' },
              daysMarked: { $sum: 1 },
            },
          },
        ]),
      );
      const workerIds = rows.map((r: any) => r._id.workerId);
      const workers = await import('../models/Worker.js').then(({ Worker }) =>
        Worker.find({ _id: { $in: workerIds } }).select('name dailyWage workerType'),
      );
      type WorkerInfo = { name?: string; dailyWage?: number; workerType?: string };
      const wageMap = new Map<string, WorkerInfo>(
        workers.map((w: any) => [String(w._id), w]),
      );
      const enriched = rows
        .map((r: any) => {
          const w = wageMap.get(String(r._id.workerId)) ?? {};
          const payableDays = r.present + r.halfDay * 0.5;
          return {
            workerId: r._id.workerId,
            workerName: w.name ?? 'Unknown',
            workerType: w.workerType,
            projectName: projectName.get(String(r._id.projectId)),
            present: r.present,
            halfDay: r.halfDay,
            absent: r.absent,
            leave: r.leave,
            overtimeHours: r.overtime,
            estimatedWages: w.dailyWage ? Math.round(payableDays * w.dailyWage) : 0,
          };
        })
        .sort((a: any, b: any) => a.workerName.localeCompare(b.workerName));
      return sendSuccess(res, {
        type,
        generatedAt: new Date(),
        period: { from, to },
        rows: enriched,
        totals: {
          estimatedWages: enriched.reduce((s: number, r: any) => s + r.estimatedWages, 0),
          workers: enriched.length,
        },
      });
    }

    case 'expense': {
      const { Expense } = await import('../models/Expense.js');
      const match: Record<string, unknown> = {
        companyId: user.companyId,
        projectId: { $in: projectIds },
        date: { $gte: from, $lt: to },
      };
      const [rows, byCategory] = await Promise.all([
        Expense.find(match)
          .sort({ date: -1 })
          .limit(1000)
          .populate('projectId', 'name')
          .populate('createdBy', 'name'),
        Expense.aggregate([
          { $match: match },
          { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
          { $sort: { total: -1 } },
        ]),
      ]);
      return sendSuccess(res, {
        type,
        generatedAt: new Date(),
        period: { from, to },
        rows: rows.map((e: any) => ({
          _id: e._id,
          projectName: e.projectId?.name,
          title: e.title,
          category: e.category,
          amount: e.amount,
          paymentMethod: e.paymentMethod,
          date: e.date,
          createdByName: e.createdBy?.name,
        })),
        byCategory: byCategory.map((c: any) => ({
          category: c._id,
          total: c.total,
          count: c.count,
        })),
        totals: {
          amount: rows.reduce((s: number, e: any) => s + e.amount, 0),
          entries: rows.length,
        },
      });
    }

    case 'inventory': {
      const { Unit } = await import('../models/Unit.js');
      const [units, summary] = await Promise.all([
        Unit.find({ companyId: user.companyId, projectId: { $in: projectIds } }).sort({
          projectId: 1,
          unitNumber: 1,
        }),
        Unit.aggregate([
          { $match: { companyId: user.companyId, projectId: { $in: projectIds } } },
          { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$totalValue' } } },
        ]),
      ]);
      return sendSuccess(res, {
        type,
        generatedAt: new Date(),
        period: { from, to },
        rows: units.map((u: any) => ({
          _id: u._id,
          projectName: projectName.get(String(u.projectId)),
          unitNumber: u.unitNumber,
          unitType: u.unitType,
          areaSqft: u.areaSqft,
          ratePerSqft: u.ratePerSqft,
          totalValue: u.totalValue,
          status: u.status,
        })),
        statusTotals: summary.map((s: any) => ({
          status: s._id,
          count: s.count,
          value: Math.round(s.value),
        })),
        totals: {
          units: units.length,
          inventoryValue: Math.round(units.reduce((s: number, u: any) => s + u.totalValue, 0)),
        },
      });
    }

    default:
      throw ApiError.badRequest(`Unknown report type "${q.type}".`);
  }
}

/** Sensible default window for reports when the caller omits dates. */
export function defaultReportPeriod(): { from: string; to: string } {
  const end = utcDay(new Date());
  const start = startOfMonthUtc();
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}
