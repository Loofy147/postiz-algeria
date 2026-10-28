export type PostOwnershipResult =
  | { ok: true; ids: string[] }
  | {
      ok: false;
      reason: 'DUPLICATE_POST_ID' | 'POST_NOT_FOUND' | 'GROUP_NOT_FOUND';
    };

export type PostOwnershipLookup = {
  findOwnedPostIds: (
    organizationId: string,
    ids: string[]
  ) => Promise<string[]>;
  findOwnedGroup: (
    organizationId: string,
    group: string
  ) => Promise<boolean>;
};

export function ownedPostIdsWhere(
  organizationId: string,
  ids: string[]
): { id: { in: string[] }; organizationId: string; deletedAt: null } {
  return { id: { in: ids }, organizationId, deletedAt: null };
}

export function ownedPostIdWhere(
  organizationId: string,
  id: string
): { id: string; organizationId: string; deletedAt: null } {
  return { id, organizationId, deletedAt: null };
}

export function ownedPostGroupWhere(
  organizationId: string,
  group: string
): { group: string; organizationId: string; deletedAt: null } {
  return { group, organizationId, deletedAt: null };
}

/**
 * Checks every client-supplied post/group target against the current tenant.
 * Query execution is injected so the ownership contract can be tested without
 * a database; production callbacks must use the scoped where-builders above.
 */
export async function validatePostOwnership(
  organizationId: string,
  suppliedPostIds: Array<string | null | undefined>,
  group: string | null | undefined,
  lookup: PostOwnershipLookup
): Promise<PostOwnershipResult> {
  const ids = suppliedPostIds.filter(
    (id): id is string => typeof id === 'string' && id.length > 0
  );

  if (new Set(ids).size !== ids.length) {
    return { ok: false, reason: 'DUPLICATE_POST_ID' };
  }

  if (ids.length) {
    const ownedIds = await lookup.findOwnedPostIds(organizationId, ids);
    if (
      ownedIds.length !== ids.length ||
      ids.some((id) => !ownedIds.includes(id))
    ) {
      return { ok: false, reason: 'POST_NOT_FOUND' };
    }
  }

  if (group && !(await lookup.findOwnedGroup(organizationId, group))) {
    return { ok: false, reason: 'GROUP_NOT_FOUND' };
  }

  return { ok: true, ids };
}
