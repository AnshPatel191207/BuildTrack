import { sendSuccess } from '../utils/apiResponse';
import { accessibleProjectsFilter, assertProjectAccess } from '../utils/accessControl';
import { utcDay, addDays, startOfMonthUtc } from '../utils/dates';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

type Req = Request & { validatedQuery?: any };

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * GET /api/analytics/financial — Module 20.
 * Revenue vs spend, receivables/payables, cash-flow and budget utilisation.
 */
export async function financialAnalytics(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!['super_admin', 'owner', 'accountant', 'manager', 'project_manager'].includes(user.role)) {
    void user;
  }
  const q = req.validatedQuery ?? {};

  let projectFilter = await accessibleProjectsFilter(user);
  if (q.projectId) {
    await assertProjectAccess(user, String(q.projectId));
    projectFilter = { ...projectFilter, _id: q.projectId };
  }
  const projects = await import('../models/Project').then(({ Project }) =>
    Project.find(projectFilter).select('name budget spentAmount progressPercentage status').lean(),
  );
  const projectIds = projects.map((p: any) => p._id);

  const from = q.from ? utcDay(q.from) : startOfMonthUtc();
  const to = q.to ? addDays(utcDay(q.to), 1) : addDays(startOfMonthUtc(), 31);

  const [
    revenueAgg,
    receivableAgg,
    overdueAgg,
    poUnpaidAgg,
    contractorPendingAgg,
    expenseByCategory,
    cashFlow,
    paymentByMethod,
  ] = await Promise.all([
    import('../models/Payment').then(async ({ Payment }) =>
      Payment.aggregate([
        {
          $match: {
            companyId: user.companyId,
            projectId: { $in: projectIds },
            status: 'paid',
            paidDate: { $gte: from, $lt: to },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ),
    import('../models/Payment').then(({ Payment }) =>
      Payment.aggregate([
        { $match: { companyId: user.companyId, projectId: { $in: projectIds }, status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ),
    import('../models/Payment').then(({ Payment }) =>
      Payment.aggregate([
        {
          $match: {
            companyId: user.companyId,
            projectId: { $in: projectIds },
            status: 'pending',
            dueDate: { $ne: null, $lt: utcDay(new Date()) },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ),
    import('../models/PurchaseOrder').then(({ PurchaseOrder }) =>
      PurchaseOrder.aggregate([
        {
          $match: {
            companyId: user.companyId,
            projectId: { $in: projectIds },
            status: { $in: ['approved', 'ordered', 'delivered'] },
          },
        },
        {
          $addFields: { unpaid: { $subtract: ['$totalAmount', '$paidAmount'] } },
        },
        { $match: { unpaid: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$unpaid' }, count: { $sum: 1 } } },
      ]),
    ),
    import('../models/Contractor').then(({ ContractorContract }) =>
      ContractorContract.aggregate([
        {
          $match: {
            projectId: { $in: projectIds },
            status: { $ne: 'terminated' },
          },
        },
        {
          $project: {
            pending: { $max: [{ $subtract: ['$contractValue', '$paidAmount'] }, 0] },
          },
        },
        { $group: { _id: null, total: { $sum: '$pending' } } },
      ]),
    ),
    import('../models/Expense').then(({ Expense }) =>
      Expense.aggregate([
        {
          $match: {
            companyId: user.companyId,
            projectId: { $in: projectIds },
            date: { $gte: from, $lt: to },
          },
        },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
    ),
    buildCashFlow(projectIds, user.companyId),
    import('../models/Payment').then(({ Payment }) =>
      Payment.aggregate([
        {
          $match: {
            companyId: user.companyId,
            projectId: { $in: projectIds },
            status: 'paid',
            paidDate: { $gte: from, $lt: to },
          },
        },
        { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ),
  ]);

  const revenue = round(revenueAgg[0]?.total ?? 0);
  const expensesInRange = round(expenseByCategory.reduce((s: number, c: any) => s + c.total, 0));
  const totalBudget = round(projects.reduce((s: number, p: any) => s + (p.budget ?? 0), 0));
  const totalSpent = round(projects.reduce((s: number, p: any) => s + (p.spentAmount ?? 0), 0));

  sendSuccess(res, {
    period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    revenue,
    expenses: expensesInRange,
    grossProfitability: round(revenue - expensesInRange),
    margin:
      revenue > 0 ? Math.round(((revenue - expensesInRange) / revenue) * 1000) / 10 : 0,
    totalBudget,
    totalSpent,
    budgetUtilization:
      totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 1000) / 10 : 0,
    receivables: {
      pendingAmount: round(receivableAgg[0]?.total ?? 0),
      pendingCount: receivableAgg[0]?.count ?? 0,
      overdueAmount: round(overdueAgg[0]?.total ?? 0),
      overdueCount: overdueAgg[0]?.count ?? 0,
    },
    payables: {
      purchaseOrders: round(poUnpaidAgg[0]?.total ?? 0),
      poCount: poUnpaidAgg[0]?.count ?? 0,
      contractors: round(contractorPendingAgg[0]?.total ?? 0),
    },
    cashFlow,
    expenseBreakdown: expenseByCategory.map((c: any) => ({
      category: c._id,
      total: round(c.total),
      count: c.count,
    })),
    collectionsByMethod: paymentByMethod.map((m: any) => ({
      method: m._id,
      total: round(m.total),
      count: m.count,
    })),
    projects: projects.map((p: any) => ({
      _id: p._id,
      name: p.name,
      status: p.status,
      budget: round(p.budget ?? 0),
      spent: round(p.spentAmount ?? 0),
      utilization:
        (p.budget ?? 0) > 0
          ? Math.round(((p.spentAmount ?? 0) / p.budget) * 1000) / 10
          : 0,
      profitability: round(revenue - (p.spentAmount ?? 0)),
    })),
  });
}

async function buildCashFlow(projectIds: unknown[], companyId: unknown) {
  const monthsBack = 6;
  const start = startOfMonthUtc();
  const monthKeys: { key: string; label: string; start: Date; end: Date }[] = [];
  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    monthKeys.push({
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('en-US', { month: 'short' }),
      start: d,
      end,
    });
  }

  const [inflow, outflow] = await Promise.all([
    import('../models/Payment').then(({ Payment }) =>
      Payment.aggregate([
        {
          $match: {
            companyId,
            projectId: { $in: projectIds },
            status: 'paid',
            paidDate: { $gte: monthKeys[0].start, $lt: monthKeys[monthKeys.length - 1].end },
          },
        },
        {
          $group: {
            _id: { y: { $year: '$paidDate' }, m: { $month: '$paidDate' } },
            total: { $sum: '$amount' },
          },
        },
      ]),
    ),
    import('../models/Expense').then(({ Expense }) =>
      Expense.aggregate([
        {
          $match: {
            companyId,
            projectId: { $in: projectIds },
            date: { $gte: monthKeys[0].start, $lt: monthKeys[monthKeys.length - 1].end },
          },
        },
        {
          $group: {
            _id: { y: { $year: '$date' }, m: { $month: '$date' } },
            total: { $sum: '$amount' },
          },
        },
      ]),
    ),
  ]);

  const inMap = new Map<string, number>(
    inflow.map((r: any) => [`${r._id.y}-${String(r._id.m).padStart(2, '0')}`, r.total] as [string, number]),
  );
  const outMap = new Map<string, number>(
    outflow.map((r: any) => [`${r._id.y}-${String(r._id.m).padStart(2, '0')}`, r.total] as [string, number]),
  );

  return monthKeys.map((m) => ({
    month: m.key,
    label: m.label,
    inflow: round(inMap.get(m.key) ?? 0),
    outflow: round(outMap.get(m.key) ?? 0),
    net: round((inMap.get(m.key) ?? 0) - (outMap.get(m.key) ?? 0)),
  }));
}

/**
 * GET /api/analytics/executive — Module 21. One-screen company cockpit
 * for the owner: sales, finance, operations and alerts.
 */
export async function executiveDashboard(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};
  const projectFilter = await accessibleProjectsFilter(user);
  const projects = await import('../models/Project').then(({ Project }) =>
    Project.find(projectFilter).select('name status budget spentAmount progressPercentage expectedEndDate').lean(),
  );
  const projectIds = projects.map((p: any) => p._id);

  const today = utcDay(new Date());
  const monthStart = startOfMonthUtc();

  const [
    revenueAll,
    receivableAgg,
    overdueAgg,
    payablePoAgg,
    contractorPendingAgg,
    bookingsMonth,
    bookingsValue,
    unitsSummary,
    delayedMilestones,
    upcomingMilestones,
    lowStockCount,
    pendingApprovals,
    overduePaymentsTop,
  ] = await Promise.all([
    import('../models/Payment').then(({ Payment }) =>
      Payment.aggregate([
        { $match: { companyId: user.companyId, projectId: { $in: projectIds }, status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ),
    import('../models/Payment').then(({ Payment }) =>
      Payment.aggregate([
        { $match: { companyId: user.companyId, projectId: { $in: projectIds }, status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ),
    import('../models/Payment').then(({ Payment }) =>
      Payment.aggregate([
        {
          $match: {
            companyId: user.companyId,
            projectId: { $in: projectIds },
            status: 'pending',
            dueDate: { $ne: null, $lt: today },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ),
    import('../models/PurchaseOrder').then(({ PurchaseOrder }) =>
      PurchaseOrder.aggregate([
        {
          $match: {
            companyId: user.companyId,
            status: { $in: ['approved', 'ordered', 'delivered'] },
          },
        },
        { $addFields: { unpaid: { $subtract: ['$totalAmount', '$paidAmount'] } } },
        { $match: { unpaid: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$unpaid' }, count: { $sum: 1 } } },
      ]),
    ),
    import('../models/Contractor').then(({ ContractorContract }) =>
      ContractorContract.aggregate([
        { $match: { status: { $ne: 'terminated' } } },
        { $addFields: { pending: { $max: [{ $subtract: ['$contractValue', '$paidAmount'] }, 0] } } },
        { $group: { _id: null, total: { $sum: '$pending' } } },
      ]),
    ),
    import('../models/Booking').then(async ({ Booking }) => {
      const count = await Booking.countDocuments({
        companyId: user.companyId,
        createdAt: { $gte: monthStart },
        status: { $ne: 'cancelled' },
      });
      return count;
    }),
    import('../models/Booking').then(({ Booking }) =>
      Booking.aggregate([
        { $match: { companyId: user.companyId, status: { $in: ['confirmed', 'sold'] } } },
        { $group: { _id: null, total: { $sum: '$totalValue' }, count: { $sum: 1 } } },
      ]),
    ),
    import('../models/Unit').then(({ Unit }) =>
      Unit.aggregate([
        { $match: { companyId: user.companyId, projectId: { $in: projectIds } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            value: { $sum: '$totalValue' },
          },
        },
      ]),
    ),
    import('../models/Milestone').then(({ Milestone }) =>
      Milestone.find({
        companyId: user.companyId,
        completedAt: null,
        dueDate: { $lt: today },
      })
        .sort({ dueDate: 1 })
        .limit(8)
        .populate('projectId', 'name')
        .lean(),
    ),
    import('../models/Milestone').then(({ Milestone }) =>
      Milestone.find({
        companyId: user.companyId,
        completedAt: null,
        dueDate: { $gte: today, $lte: addDays(today, 30) },
      })
        .sort({ dueDate: 1 })
        .limit(8)
        .populate('projectId', 'name')
        .lean(),
    ),
    import('../models/Material').then(({ Material }) =>
      Material.countDocuments({
        companyId: user.companyId,
        projectId: { $in: projectIds },
        $expr: { $and: [{ $gt: ['$minimumStock', 0] }, { $lte: ['$currentStock', '$minimumStock'] }] },
      }),
    ),
    import('../models/Approval').then(({ Approval }) =>
      Approval.countDocuments({ companyId: user.companyId, status: 'pending' }),
    ),
    import('../models/Payment').then(({ Payment }) =>
      Payment.find({
        companyId: user.companyId,
        status: 'pending',
        dueDate: { $ne: null, $lt: addDays(today, -14) },
      })
        .sort({ dueDate: 1 })
        .limit(5)
        .populate('customerId', 'name')
        .lean(),
    ),
  ]);

  const unitMap = Object.fromEntries(unitsSummary.map((u: any) => [u._id, u]));
  const totalBudget = round(projects.reduce((s: number, p: any) => s + (p.budget ?? 0), 0));
  const totalSpent = round(projects.reduce((s: number, p: any) => s + (p.spentAmount ?? 0), 0));

  sendSuccess(res, {
    projects: {
      total: projects.length,
      active: projects.filter((p: any) => p.status === 'active').length,
      completed: projects.filter((p: any) => p.status === 'completed').length,
      avgProgress: projects.length
        ? Math.round(projects.reduce((s: number, p: any) => s + (p.progressPercentage ?? 0), 0) / projects.length)
        : 0,
      list: projects.map((p: any) => ({
        _id: p._id,
        name: p.name,
        status: p.status,
        progressPercentage: p.progressPercentage,
        budget: round(p.budget ?? 0),
        spent: round(p.spentAmount ?? 0),
        overBudget: (p.spentAmount ?? 0) > (p.budget ?? 0) && (p.budget ?? 0) > 0,
      })),
    },
    finance: {
      revenueCollected: round(revenueAll[0]?.total ?? 0),
      totalBudget,
      totalSpent,
      budgetUtilization: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 1000) / 10 : 0,
      profitability: round((revenueAll[0]?.total ?? 0) - totalSpent),
    },
    sales: {
      bookingsThisMonth: bookingsMonth,
      activeBookings: bookingsValue[0]?.count ?? 0,
      bookedValue: round(bookingsValue[0]?.total ?? 0),
      units: {
        available: unitMap.available?.count ?? 0,
        reserved: unitMap.reserved?.count ?? 0,
        booked: unitMap.booked?.count ?? 0,
        sold: unitMap.sold?.count ?? 0,
        unsoldInventoryValue: round(
          ['available', 'reserved', 'blocked'].reduce(
            (s: number, k: string) => s + (unitMap[k]?.value ?? 0),
            0,
          ),
        ),
      },
    },
    receivables: {
      pending: round(receivableAgg[0]?.total ?? 0),
      overdue: round(overdueAgg[0]?.total ?? 0),
      overdueCount: overdueAgg[0]?.count ?? 0,
    },
    payables: {
      purchaseOrders: round(payablePoAgg[0]?.total ?? 0),
      contractors: round(contractorPendingAgg[0]?.total ?? 0),
    },
    milestones: {
      delayed: delayedMilestones.map((m: any) => ({
        _id: m._id,
        name: m.name,
        dueDate: m.dueDate,
        projectName: m.projectId?.name,
        projectId: m.projectId?._id ?? m.projectId,
      })),
      upcoming: upcomingMilestones.map((m: any) => ({
        _id: m._id,
        name: m.name,
        dueDate: m.dueDate,
        projectName: m.projectId?.name,
        projectId: m.projectId?._id ?? m.projectId,
      })),
    },
    alerts: {
      lowStockCount,
      pendingApprovals,
      longOverduePayments: overduePaymentsTop.map((p: any) => ({
        _id: p._id,
        amount: round(p.amount),
        dueDate: p.dueDate,
        customerName: p.customerId?.name ?? 'Customer',
      })),
    },
  });
}
