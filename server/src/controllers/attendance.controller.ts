import { ApiError, sendSuccess } from '../utils/apiResponse';
import { Attendance } from '../models/Attendance';
import { Worker } from '../models/Worker';
import { assertProjectAccess, canManageOperations, accessibleProjectsFilter } from '../utils/accessControl';
import { notifyProjectStakeholders } from '../services/notification.service';
import { utcDay } from '../utils/dates';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

interface Entry {
  workerId: string;
  status: string;
  checkIn?: string | null;
  checkOut?: string | null;
  overtimeHours?: number;
  remarks?: string;
  geo?: { latitude: number; longitude: number; distanceMeters?: number } | null;
}

/** Haversine distance in meters. */
function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

/** GET /api/attendance — query records with filters. */
export async function listAttendance(req: Request & { validatedQuery?: any }, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};

  const filter: Record<string, unknown> = {};
  if (q.projectId) {
    await assertProjectAccess(user, q.projectId);
    filter.projectId = q.projectId;
  } else {
    const projectFilter = await accessibleProjectsFilter(user);
    const projects = await (await import('../models/Project')).Project.find(projectFilter).select('_id');
    filter.projectId = { $in: projects.map((p: any) => p._id) };
  }
  if (q.date) filter.date = utcDay(q.date);
  if (q.from || q.to) {
    filter.date = {};
    if (q.from) (filter.date as any).$gte = utcDay(q.from);
    if (q.to) (filter.date as any).$lte = utcDay(q.to);
  }
  if (q.workerId) filter.workerId = q.workerId;

  const records = await Attendance.find(filter)
    .populate('workerId', 'name workerType dailyWage profilePhoto')
    .sort({ date: -1 })
    .limit(500);
  sendSuccess(res, records);
}

async function upsertEntry(
  user: AuthUser,
  projectId: unknown,
  dateStr: string,
  entry: Entry,
  siteGeo?: { latitude: number | null; longitude: number | null; radius: number } | null,
): Promise<{ created: boolean }> {
  const worker = await Worker.findOne({ _id: entry.workerId, companyId: user.companyId });
  if (!worker) throw ApiError.notFound('One of the workers was not found.');

  // Geofence: entries carrying GPS must be inside the configured site radius.
  // A 25% buffer absorbs GPS jitter at the boundary (±20m accuracy is normal
  // on phone hardware, so a worker standing on the fence line shouldn't fail).
  let geoToStore: Entry['geo'] | null = null;
  if (entry.geo) {
    const dist =
      entry.geo.distanceMeters ??
      (siteGeo?.latitude != null && siteGeo?.longitude != null
        ? distanceMeters(siteGeo.latitude, siteGeo.longitude, entry.geo.latitude, entry.geo.longitude)
        : null);
    if (siteGeo && dist != null && dist > siteGeo.radius * 1.25) {
      throw ApiError.unprocessable(
        `Outside site boundary — ${worker.name} is ${dist}m away (limit ${siteGeo.radius}m).`,
      );
    }
    geoToStore = {
      latitude: entry.geo.latitude,
      longitude: entry.geo.longitude,
      distanceMeters: dist ?? undefined,
    };
  }

  const date = utcDay(dateStr);
  const result = await Attendance.updateOne(
    { workerId: worker._id, date },
    {
      $set: {
        companyId: user.companyId,
        projectId,
        status: entry.status,
        checkIn: entry.checkIn ?? null,
        checkOut: entry.checkOut ?? null,
        overtimeHours: entry.overtimeHours ?? 0,
        remarks: entry.remarks ?? '',
        geo: geoToStore,
        markedBy: user._id,
      },
    },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return { created: result.upsertedCount > 0 };
}

/**
 * POST /api/attendance/bulk — idempotent upsert used by the attendance screen.
 * Re-marking a worker for a day simply updates their record (no duplicates —
 * enforced additionally by the compound unique index).
 */
export async function bulkMarkAttendance(req: Request, res: Response) {
  const user = req.user! as AuthUser;
  if (!canManageOperations(user)) {
    throw ApiError.forbidden('Your role does not allow marking attendance.');
  }
  const { projectId, date, entries } = req.body as {
    projectId: string;
    date: string;
    entries: Entry[];
  };
  await assertProjectAccess(user, projectId);

  // Site geofence config (if the project has saved coordinates).
  const projectDoc = await (await import('../models/Project')).Project
    .findById(projectId)
    .select('latitude longitude siteRadiusMeters');
  const siteGeo = projectDoc?.latitude != null && projectDoc?.longitude != null
    ? {
        latitude: projectDoc.latitude as number,
        longitude: projectDoc.longitude as number,
        radius: projectDoc.siteRadiusMeters ?? 100,
      }
    : null;

  let updated = 0;
  let created = 0;
  for (const entry of entries) {
    const r = await upsertEntry(user, projectId, date, entry, siteGeo);
    r.created ? created++ : updated++;
  }

  // Attendance issue notification when many workers are absent.
  const absentees = entries.filter((e) => e.status === 'absent').length;
  const totalWorkers = await Worker.countDocuments({
    projectId,
    status: 'active',
  });
  if (totalWorkers >= 3 && absentees / Math.max(totalWorkers, entries.length) > 0.3) {
    const project = await (await import('../models/Project')).Project.findById(projectId).select(
      'name projectManagerId companyId',
    );
    const company = await (
      await import('../models/Company')
    ).Company.findById(project?.companyId).select('ownerId');
    await notifyProjectStakeholders({
      ownerId: company?.ownerId,
      managerId: project?.projectManagerId,
      projectId,
      title: `${absentees} workers absent at ${project?.name}`,
      message: `${absentees} of ${entries.length} marked workers are absent today. Check if it affects today's schedule.`,
      type: 'attendance',
    });
  }

  sendSuccess(res, { created, updated }, `Attendance saved for ${created + updated} workers.`);
}

export async function markSingleAttendance(req: Request, res: Response) {
  req.body.entries = [
    {
      workerId: req.body.workerId,
      status: req.body.status,
      checkIn: req.body.checkIn,
      checkOut: req.body.checkOut,
      overtimeHours: req.body.overtimeHours,
      remarks: req.body.remarks,
      geo: req.body.geo,
    },
  ];
  req.body.projectId = req.body.projectId;
  return bulkMarkAttendance(req, res);
}

/** PUT /api/attendance/:id — update an existing record. */
export async function updateAttendance(req: Request, res: Response) {
  const user = req.user! as AuthUser;
  if (!canManageOperations(user)) throw ApiError.forbidden();
  const record = await Attendance.findById(req.params.id);
  if (!record || !record.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Attendance record not found.');
  }
  const allowed = ['status', 'checkIn', 'checkOut', 'overtimeHours', 'remarks'] as const;
  for (const key of allowed) {
    if (req.body[key] !== undefined) (record as any)[key] = req.body[key];
  }
  record.markedBy = user._id as any;
  await record.save();
  sendSuccess(res, record, 'Attendance record updated.');
}
