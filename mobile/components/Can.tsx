import React from 'react';
import { useRbac } from '@/lib/rbac';
import type { PermissionKey } from '@/types';

/** Conditionally renders children when the user holds the permission. */
export function Can({
  perm,
  anyOf,
  fallback = null,
  children,
}: {
  perm?: PermissionKey;
  anyOf?: PermissionKey[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { can, canAny, role } = useRbac();
  const allowed =
    role === 'super_admin' ||
    (perm ? can(perm) : false) ||
    (anyOf ? canAny(anyOf) : false);
  return <>{allowed ? children : fallback}</>;
}
