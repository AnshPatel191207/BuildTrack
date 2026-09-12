import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { ProjectNode, refreshAncestorProgress } from '../models/ProjectNode';
import { Unit } from '../models/Unit';
import { assertProjectAccess } from '../utils/accessControl';
import { hasPermission } from '../utils/permissions';
import { logAudit } from '../utils/audit';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

type Req = Request & { validatedBody?: any; validatedQuery?: any };

export async function listNodes(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};
  if (!q.projectId) throw ApiError.badRequest('projectId is required.');
  await assertProjectAccess(user, q.projectId);

  const filter: Record<string, unknown> = { projectId: q.projectId };
  if ('parentId' in q && q.parentId !== undefined) filter.parentId = q.parentId || null;
  if (q.nodeType) filter.nodeType = q.nodeType;

  const page = q.page ?? 1;
  const limit = Math.min(q.limit ?? 500, 500);
  const [items, total] = await Promise.all([
    ProjectNode.find(filter)
      .sort({ order: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('projectId', 'name'),
    ProjectNode.countDocuments(filter),
  ]);
  sendSuccess(res, items, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

/** Full nested tree for a project — powers the visual structure screen. */
export async function getTree(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const projectId = req.validatedQuery?.projectId;
  await assertProjectAccess(user, projectId);

  const [nodes, units] = await Promise.all([
    ProjectNode.find({ projectId }).sort({ order: 1, createdAt: 1 }).lean(),
    Unit.find({ projectId })
      .select('floorId blockId phaseId unitNumber unitType totalValue status areaSqft')
      .lean(),
  ]);

  interface TreeUnit {
    kind: 'unit';
    _id: string;
    unitNumber: string;
    unitType: string;
    totalValue: number;
    status: string;
    areaSqft: number;
  }
  interface TreeNode {
    kind: 'node';
    _id: string;
    nodeType: string;
    customType?: string | null;
    name: string;
    order: number;
    description?: string;
    progressPercentage: number;
    children: (TreeNode | TreeUnit)[];
  }

  const nodeMap = new Map<string, TreeNode>();
  for (const n of nodes) {
    nodeMap.set(String(n._id), {
      kind: 'node',
      _id: String(n._id),
      nodeType: n.nodeType,
      customType: n.customType,
      name: n.name,
      order: n.order,
      description: n.description,
      progressPercentage: n.progressPercentage ?? 0,
      children: [],
    });
  }
  const roots: (TreeNode | TreeUnit)[] = [];
  for (const n of nodes) {
    const node = nodeMap.get(String(n._id))!;
    if (n.parentId && nodeMap.has(String(n.parentId))) {
      nodeMap.get(String(n.parentId))!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Units attach to their deepest mapped ancestor (floor → block → phase).
  for (const u of units) {
    const leaf: TreeUnit = {
      kind: 'unit',
      _id: String(u._id),
      unitNumber: u.unitNumber,
      unitType: u.unitType,
      totalValue: u.totalValue,
      status: u.status,
      areaSqft: u.areaSqft ?? 0,
    };
    const anchor =
      (u.floorId && nodeMap.get(String(u.floorId))) ??
      (u.blockId && nodeMap.get(String(u.blockId))) ??
      (u.phaseId && nodeMap.get(String(u.phaseId)));
    if (anchor) anchor.children.push(leaf);
  }
  sendSuccess(res, { projectId, tree: roots });
}

export async function createNode(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageStructure')) {
    throw ApiError.forbidden('You cannot modify the project structure.');
  }
  const body = req.validatedBody;
  const project = await assertProjectAccess(user, body.projectId);
  void project;

  let parent: any = null;
  if (body.parentId) {
    parent = await ProjectNode.findOne({ _id: body.parentId, projectId: body.projectId });
    if (!parent) throw ApiError.badRequest('Parent level was not found in this project.');
  }

  const node = await ProjectNode.create({
    companyId: user.companyId,
    projectId: body.projectId,
    parentId: body.parentId ?? null,
    nodeType: body.nodeType,
    customType: body.customType ?? null,
    name: body.name,
    order: body.order ?? 0,
    description: body.description,
    createdBy: user._id,
  });

  await logAudit(req, {
    action: 'create',
    module: 'structure',
    entityType: 'project_node',
    entityId: node._id,
    description: `${user.name} added ${body.nodeType} "${body.name}"`,
    meta: { projectId: body.projectId },
  });

  sendCreated(res, node, `${labelFor(body.nodeType)} "${body.name}" added.`);
}

function labelFor(nodeType: string): string {
  return nodeType === 'custom' ? 'Level' : nodeType.charAt(0).toUpperCase() + nodeType.slice(1);
}

export async function updateNode(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageStructure')) {
    throw ApiError.forbidden('You cannot modify the project structure.');
  }
  const node = await ProjectNode.findById(req.params.id);
  if (!node || !node.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Structure level not found.');
  }
  const body = req.validatedBody;
  if (body.parentId !== undefined) {
    if (body.parentId === String(node._id)) {
      throw ApiError.badRequest('A level cannot be its own parent.');
    }
    if (body.parentId && (await wouldCreateCycle(node._id, body.parentId))) {
      throw ApiError.badRequest('That would create a circular hierarchy.');
    }
  }
  Object.assign(node, {
    ...body,
    parentId: body.parentId === undefined ? node.parentId : body.parentId || null,
  });
  await node.save();

  await logAudit(req, {
    action: 'update',
    module: 'structure',
    entityType: 'project_node',
    entityId: node._id,
    description: `${user.name} updated structure level "${node.name}"`,
  });
  sendSuccess(res, node, 'Level updated.');
}

async function wouldCreateCycle(nodeId: unknown, newParentId: unknown): Promise<boolean> {
  let current: unknown = newParentId;
  let guard = 0;
  while (current && guard < 20) {
    if (String(current) === String(nodeId)) return true;
    const parent: any = await ProjectNode.findById(current).select('parentId');
    current = parent?.parentId ?? null;
    guard += 1;
  }
  return false;
}

export async function deleteNode(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageStructure')) {
    throw ApiError.forbidden('You cannot modify the project structure.');
  }
  const node = await ProjectNode.findById(req.params.id);
  if (!node || !node.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Structure level not found.');
  }

  const descendantIds = await collectDescendants(node._id);
  await Promise.all([
    Unit.updateMany(
      { $or: [{ floorId: node._id }, { blockId: node._id }, { phaseId: node._id }] },
      { $set: { floorId: null, blockId: null, phaseId: null } },
    ),
    ProjectNode.deleteMany({ _id: { $in: [...descendantIds, node._id] } }),
  ]);

  await logAudit(req, {
    action: 'delete',
    module: 'structure',
    entityType: 'project_node',
    entityId: node._id,
    description: `${user.name} deleted structure level "${node.name}" and its sub-levels`,
  });
  sendSuccess(res, { id: node._id }, `"${node.name}" was removed.`);
}

async function collectDescendants(nodeId: unknown): Promise<Set<string>> {
  const all = await ProjectNode.find({}).select('_id parentId').lean();
  const childMap = new Map<string, string[]>();
  for (const n of all) {
    const key = n.parentId ? String(n.parentId) : '';
    if (!childMap.has(key)) childMap.set(key, []);
    childMap.get(key)!.push(String(n._id));
  }
  const result = new Set<string>();
  const stack = [String(nodeId)];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const child of childMap.get(current) ?? []) {
      if (!result.has(child)) {
        result.add(child);
        stack.push(child);
      }
    }
  }
  return result;
}
