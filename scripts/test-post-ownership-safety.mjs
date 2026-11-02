import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ownedPostGroupWhere,
  ownedPostIdWhere,
  ownedPostIdsWhere,
  validatePostOwnership,
} from '../libraries/nestjs-libraries/src/database/prisma/posts/post.ownership.filters.ts';

test('post ID queries are always scoped to the organization and live rows', () => {
  assert.deepEqual(ownedPostIdsWhere('org-a', ['p-1', 'p-2']), {
    id: { in: ['p-1', 'p-2'] },
    organizationId: 'org-a',
    deletedAt: null,
  });
  assert.deepEqual(ownedPostIdWhere('org-a', 'p-1'), {
    id: 'p-1',
    organizationId: 'org-a',
    deletedAt: null,
  });
});

test('group lookups and cleanup filters are scoped to the organization', () => {
  assert.deepEqual(ownedPostGroupWhere('org-a', 'group-1'), {
    group: 'group-1',
    organizationId: 'org-a',
    deletedAt: null,
  });
  assert.notDeepEqual(
    ownedPostGroupWhere('org-a', 'group-1'),
    ownedPostGroupWhere('org-b', 'group-1')
  );
});

test('rejects a post ID not returned by the current organization lookup', async () => {
  const calls = [];
  const result = await validatePostOwnership('org-a', ['foreign-post'], undefined, {
    findOwnedPostIds: async (orgId, ids) => {
      calls.push({ op: 'posts', orgId, ids });
      return [];
    },
    findOwnedGroup: async () => {
      calls.push({ op: 'group' });
      return true;
    },
  });

  assert.deepEqual(result, { ok: false, reason: 'POST_NOT_FOUND' });
  assert.deepEqual(calls, [{ op: 'posts', orgId: 'org-a', ids: ['foreign-post'] }]);
});

test('rejects a group not found in the current organization', async () => {
  const calls = [];
  const result = await validatePostOwnership('org-a', ['post-a'], 'foreign-group', {
    findOwnedPostIds: async (orgId, ids) => {
      calls.push({ op: 'posts', orgId, ids });
      return ids;
    },
    findOwnedGroup: async (orgId, group) => {
      calls.push({ op: 'group', orgId, group });
      return false;
    },
  });

  assert.deepEqual(result, { ok: false, reason: 'GROUP_NOT_FOUND' });
  assert.deepEqual(calls, [
    { op: 'posts', orgId: 'org-a', ids: ['post-a'] },
    { op: 'group', orgId: 'org-a', group: 'foreign-group' },
  ]);
});

test('rejects duplicate post IDs before performing any lookup', async () => {
  let lookups = 0;
  const result = await validatePostOwnership('org-a', ['post-a', 'post-a'], undefined, {
    findOwnedPostIds: async () => { lookups += 1; return []; },
    findOwnedGroup: async () => { lookups += 1; return false; },
  });

  assert.deepEqual(result, { ok: false, reason: 'DUPLICATE_POST_ID' });
  assert.equal(lookups, 0);
});

test('accepts only IDs and groups explicitly confirmed by the scoped lookup', async () => {
  const result = await validatePostOwnership('org-a', ['post-1', 'post-2'], 'group-1', {
    findOwnedPostIds: async (orgId, ids) => orgId === 'org-a' ? ids : [],
    findOwnedGroup: async (orgId, group) => orgId === 'org-a' && group === 'group-1',
  });

  assert.deepEqual(result, { ok: true, ids: ['post-1', 'post-2'] });
});
