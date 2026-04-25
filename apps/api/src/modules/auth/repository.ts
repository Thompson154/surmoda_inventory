import type { Database } from '../../infrastructure/database';

export interface RefreshTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  parentTokenId: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface CreateRefreshTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  parentTokenId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface RefreshTokenRepository {
  create(input: CreateRefreshTokenInput): Promise<RefreshTokenRow>;
  findActiveByHash(tokenHash: string): Promise<RefreshTokenRow | null>;
  findAnyByHash(tokenHash: string): Promise<RefreshTokenRow | null>;
  rotate(parent: RefreshTokenRow, child: CreateRefreshTokenInput): Promise<RefreshTokenRow>;
  revokeFamily(rootTokenId: string): Promise<number>;
  revokeAllForUser(userId: string): Promise<number>;
  revokeOne(id: string): Promise<void>;
}

export function buildRefreshTokenRepository(db: Database): RefreshTokenRepository {
  return {
    async create(input) {
      const row = await db.refreshToken.create({
        data: {
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          parentTokenId: input.parentTokenId ?? null,
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
      return toRow(row);
    },

    async findActiveByHash(tokenHash) {
      const row = await db.refreshToken.findUnique({ where: { tokenHash } });
      if (!row) return null;
      if (row.revokedAt) return null;
      if (row.expiresAt.getTime() < Date.now()) return null;
      return toRow(row);
    },

    async findAnyByHash(tokenHash) {
      const row = await db.refreshToken.findUnique({ where: { tokenHash } });
      return row ? toRow(row) : null;
    },

    async rotate(parent, child) {
      const [, created] = await db.$transaction([
        db.refreshToken.update({
          where: { id: parent.id },
          data: { revokedAt: new Date() },
        }),
        db.refreshToken.create({
          data: {
            userId: child.userId,
            tokenHash: child.tokenHash,
            expiresAt: child.expiresAt,
            parentTokenId: parent.id,
            ip: child.ip ?? null,
            userAgent: child.userAgent ?? null,
          },
        }),
      ]);
      return toRow(created);
    },

    async revokeFamily(rootTokenId) {
      const ids = await collectFamilyIds(db, rootTokenId);
      if (ids.length === 0) return 0;
      const result = await db.refreshToken.updateMany({
        where: { id: { in: ids }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return result.count;
    },

    async revokeAllForUser(userId) {
      const result = await db.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return result.count;
    },

    async revokeOne(id) {
      await db.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
    },
  };
}

async function collectFamilyIds(db: Database, startId: string): Promise<string[]> {
  const ids = new Set<string>();
  // walk to root
  let cursor: string | null | undefined = startId;
  while (cursor) {
    if (ids.has(cursor)) break;
    ids.add(cursor);
    const parentLookup: { parentTokenId: string | null } | null = await db.refreshToken.findUnique({
      where: { id: cursor },
      select: { parentTokenId: true },
    });
    cursor = parentLookup?.parentTokenId ?? null;
  }
  // walk every descendant breadth-first
  const queue = [...ids];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) break;
    const children = await db.refreshToken.findMany({
      where: { parentTokenId: id },
      select: { id: true },
    });
    for (const c of children) {
      if (!ids.has(c.id)) {
        ids.add(c.id);
        queue.push(c.id);
      }
    }
  }
  return Array.from(ids);
}

function toRow(row: {
  id: string;
  userId: string;
  tokenHash: string;
  parentTokenId: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}): RefreshTokenRow {
  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    parentTokenId: row.parentTokenId,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}
