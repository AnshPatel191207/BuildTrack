import { sendSuccess } from '../utils/apiResponse';
import { Project } from '../models/Project';
import { Worker } from '../models/Worker';
import { Attendance } from '../models/Attendance';
import { Expense } from '../models/Expense';
import { Task } from '../models/Task';
import { Material } from '../models/Material';
import { MaterialTransaction } from '../models/MaterialTransaction';
import { DailyReport } from '../models/DailyReport';
import { accessibleProjectsFilter } from '../utils/accessControl';
import { utcDay, addDays, startOfMonthUtc } from '../utils/dates';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/** GET /api/dashboard — company-wide overview for the main dashboard tab. */
export async function getGlobalDashboard(req: Request & { validatedQuery?: any }, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};

  let projectFilter = await accessibleProjectsFilter(user);
  if (q.projectId) {
    projectFilter = {
      ...projectFilter,
      _id: q.projectId as any,
    };
  }
  const projects = await Project.find(projectFilter).sort({ status: 1, updatedAt: -1 });
  const projectIds = projects.map((p: any) => p._id);

  const today = utcDay(new Date());
  const tomorrow = addDays(today, 1);
  const monthStart = startOfMonthUtc();

  const [
    activeCount,
    completedCount,
    workersTotal,
    presentToday,
    absentToday,
    onLeaveToday,
    expensesTodayAgg,
    monthExpensesAgg,
    lowStock,
    recentExpenses,
    dueTodayTasks,
    overdueTasks,
    recentActivityRows,
  ] = await Promise.all([
    Project.countDocuments({ _id: { $in: projectIds }, status: 'active' }),
    Project.countDocuments({ _id: { $in: projectIds }, status: 'completed' }),
    Worker.countDocuments({ companyId: user.companyId, projectId: { $in: projectIds }, status: 'active' }),
    Attendance.countDocuments({
      projectId: { $in: projectIds },
      date: today,
      status: { $in: ['present', 'half_day'] },
    }),
    Attendance.countDocuments({ projectId: { $in: projectIds }, date: today, status: 'absent' }),
    Attendance.countDocuments({ projectId: { $in: projectIds }, date: today, status: 'leave' }),
    Expense.aggregate([
      { $match: { projectId: { $in: projectIds }, date: { $gte: today, $lt: tomorrow } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Expense.aggregate([
      { $match: { projectId: { $in: projectIds }, date: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Material.find({ projectId: { $in: projectIds }, $expr: { $and: [{ $gt: ['$minimumStock', 0] }, { $lte: ['$currentStock', '$minimumStock'] }] } })
      .limit(10)
      .select('name currentStock minimumStock unit projectId')
      .populate('projectId', 'name'),
    Expense.find({ projectId: { $in: projectIds } })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('projectId', 'name')
      .populate('createdBy', 'name'),
    Task.countDocuments({ projectId: { $in: projectIds }, dueDate: { $gte: today, $lt: tomorrow }, status: { $ne: 'completed' } }),
    Task.countDocuments({ projectId: { $in: projectIds }, dueDate: { $lt: today }, status: { $ne: 'completed' } }),
    buildRecentActivity(projectIds, 12),
  ]);

  const totals = projects.reduce(
    (acc: { totalBudget: number; totalSpent: number }, p: any) => {
      acc.totalBudget += p.budget;
      acc.totalSpent += p.spentAmount;
      return acc;
    },
    { totalBudget: 0, totalSpent: 0 },
  );

  // Deliveries (purchases) recorded today.
  const deliveriesToday = await MaterialTransaction.countDocuments({
    projectId: { $in: projectIds },
    date: today,
    type: { $in: ['purchase', 'return'] },
  });

  sendSuccess(res, {
    scope: q.projectId ? ('project' as const) : ('company' as const),
    metrics: {
      totalProjects: projects.length,
      activeProjects: activeCount,
      completedProjects: completedCount,
      totalBudget: round(totals.totalBudget),
      totalSpent: round(totals.totalSpent),
      remainingBudget: round(totals.totalBudget - totals.totalSpent),
      budgetUtilization:
        totals.totalBudget > 0 ? round((totals.totalSpent / totals.totalBudget) * 1000) / 10 : 0,
      totalWorkers: workersTotal,
      workersPresentToday: presentToday,
      lowStockCount: lowStock.length,
      overdueTasks,
      todaysExpenses: round(expensesTodayAgg[0]?.total ?? 0),
      todaysExpenseCount: expensesTodayAgg[0]?.count ?? 0,
      monthExpenses: round(monthExpensesAgg[0]?.total ?? 0),
      overallProgress:
        projects.length > 0
          ? Math.round(projects.reduce((s: number, p: any) => s + p.progressPercentage, 0) / projects.length)
          : 0,
    },
    projects: projects.map((p: any) => ({
      _id: p._id,
      name: p.name,
      clientName: p.clientName,
      location: p.location,
      status: p.status,
      progressPercentage: p.progressPercentage,
      budget: p.budget,
      spentAmount: round(p.spentAmount),
      startDate: p.startDate,
      expectedEndDate: p.expectedEndDate,
      daysRemaining: computeDaysRemaining(p),
      overBudget: p.spentAmount > p.budget && p.budget > 0,
    })),
    todaysActivity: {
      workersPresent: presentToday,
      workersAbsent: absentToday,
      workersOnLeave: onLeaveToday,
      expensesToday: round(expensesTodayAgg[0]?.total ?? 0),
      materialDeliveries: deliveriesToday,
      tasksDueToday: dueTodayTasks,
    },
    recentExpenses,
    lowStockMaterials: lowStock,
    recentActivity: recentActivityRows,
  });
}

export async function getProjectDashboard(req: Request, res: Response) {
  const user = req.user! as AuthUser;

  const target = await Project.findById(req.params.id);
  if (!target || !target.companyId.equals(user.companyId!)) {
    res.status(404).json({ success: false, message: 'Project not found.' });
    return;
  }
  if (user.role !== 'owner' && !user.assignedProjects.some((id) => String(id) === req.params.id)) {
    res.status(403).json({ success: false, message: 'You are not assigned to this project.' });
    return;
  }
  const projectId = target._id;
  const today = utcDay(new Date());
  const tomorrow = addDays(today, 1);

  const [workersActive, attendanceToday, openTasks, overdueTasks, completedTasks, lowStock, activity] =
    await Promise.all([
      Worker.countDocuments({ projectId, status: 'active' }),
      Attendance.find({ projectId, date: today }).populate('workerId', 'name dailyWage workerType'),
      Task.countDocuments({ projectId, status: { $in: ['todo', 'in_progress', 'blocked'] } }),
      Task.countDocuments({ projectId, dueDate: { $lt: today }, status: { $ne: 'completed' } }),
      Task.countDocuments({ projectId, status: 'completed' }),
      Material.find({
        projectId,
        $expr: { $and: [{ $gt: ['$minimumStock', 0] }, { $lte: ['$currentStock', '$minimumStock'] }] },
      }).limit(8),
      buildRecentActivity([projectId], 15),
    ]);

  const presentWorkers = attendanceToday.filter((a: any) => a.status === 'present');
  const halfDayWorkers = attendanceToday.filter((a: any) => a.status === 'half_day');
  const estimatedLaborCost = Math.round(
    presentWorkers.reduce((s: number, a: any) => s + (a.workerId?.dailyWage ?? 0), 0) +
      halfDayWorkers.reduce((s: number, a: any) => s + (a.workerId?.dailyWage ?? 0) * 0.5, 0),
  );

  await target.populate('projectManagerId', 'name');

  sendSuccess(res, {
    project: target,
    financial: {
      budget: target.budget,
      spent: round(target.spentAmount),
      remaining: round(target.budget - target.spentAmount),
      utilization:
        target.budget > 0 ? round((target.spentAmount / target.budget) * 1000) / 10 : 0,
      overBudget: target.budget > 0 && target.spentAmount > target.budget,
      overBy: target.spentAmount > target.budget ? round(target.spentAmount - target.budget) : 0,
    },
    workforce: {
      totalWorkers: workersActive,
      present: presentWorkers.length,
      halfDay: halfDayWorkers.length,
      absent: attendanceToday.filter((a: any) => a.status === 'absent').length,
      leave: attendanceToday.filter((a: any) => a.status === 'leave').length,
      unmarked: Math.max(workersActive - attendanceToday.length, 0),
      estimatedLaborCost,
    },
    materials: {
      lowStockNames: lowStock.map((m: any) => m.name),
      lowStockCount: lowStock.length,
    },
    tasks: {
      open: openTasks,
      overdue: overdueTasks,
      completed: completedTasks,
    },
    recentActivity: activity,
  });
}

async function buildRecentActivity(projectIds: unknown[], limit: number) {
  const [expenses, attendance, transactions, tasks, reports] = await Promise.all([
    Expense.find({ projectId: { $in: projectIds } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('title amount category date createdAt createdBy projectId')
      .populate('createdBy', 'name')
      .lean(),
    Attendance.find({ projectId: { $in: projectIds } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('status date createdAt workerId projectId markedBy')
      .populate('workerId', 'name')
      .lean(),
    MaterialTransaction.find({ projectId: { $in: projectIds } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('type quantity date createdAt materialId projectId createdBy')
      .populate('materialId', 'name unit')
      .populate('createdBy', 'name')
      .lean(),
    Task.find({ projectId: { $in: projectIds } })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select('title status priority updatedAt projectId assignedTo')
      .populate('assignedTo', 'name')
      .lean(),
    DailyReport.find({ projectId: { $in: projectIds } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('date workCompleted createdAt projectId createdBy')
      .populate('createdBy', 'name')
      .lean(),
  ]);

  type Activity = Record<string, unknown> & { timestamp: Date; kind: string };
  const merged: Activity[] = [
    ...expenses.map((e: any) => ({
      kind: 'expense',
      timestamp: e.createdAt,
      id: e._id,
      title: `₹${Number(e.amount).toLocaleString('en-IN')} • ${e.title}`,
      subtitle: `${e.category} expense by ${e.createdBy?.name ?? 'team'}`,
      projectId: e.projectId,
      createdAt: e.createdAt,
    })),
    ...attendance.map((a: any) => ({
      kind: 'attendance',
      timestamp: a.createdAt,
      id: a._id,
      title: `${a.workerId?.name ?? 'Worker'} marked ${String(a.status).replace('_', ' ')}`,
      subtitle: new Date(a.date).toISOString().slice(0, 10),
      projectId: a.projectId,
      createdAt: a.createdAt,
    })),
    ...transactions.map((t: any) => ({
      kind: 'material',
      timestamp: t.createdAt,
      id: t._id,
      title: `${t.type === 'purchase' ? 'Purchased' : t.type === 'usage' ? 'Used' : 'Adjusted'} ${Math.abs(t.quantity)} ${t.materialId?.unit ?? ''} ${t.materialId?.name ?? ''}`,
      subtitle: `by ${t.createdBy?.name ?? 'team'}`,
      projectId: t.projectId,
      createdAt: t.createdAt,
    })),
    ...tasks.map((t: any) => ({
      kind: 'task',
      timestamp: t.updatedAt,
      id: t._id,
      title: `Task ${String(t.status).replace('_', ' ')}: ${t.title}`,
      subtitle: t.assignedTo?.name ? `assigned to ${t.assignedTo.name}` : '',
      projectId: t.projectId,
      createdAt: t.updatedAt,
    })),
    ...reports.map((r: any) => ({
      kind: 'report',
      timestamp: r.createdAt,
      id: r._id,
      title: `Daily report filed`,
      subtitle: `${r.workCompleted?.slice(0, 60) ?? ''}${(r.workCompleted?.length ?? 0) > 60 ? '…' : ''}`,
      projectId: r.projectId,
      createdAt: r.createdAt,
    })),
  ];

  merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return merged.slice(0, limit);
}

function computeDaysRemaining(p: any): number | null {
  if (!p.expectedEndDate || p.status === 'completed') return null;
  const end = new Date(p.expectedEndDate);
  const now = utcDay(new Date());
  return Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
}
