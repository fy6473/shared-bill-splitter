import { Hono } from 'hono'

const app = new Hono<{ Bindings: Env }>()

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({ status: 'ok' })
})

// Create a new home
app.post('/api/homes', async (c) => {
  try {
    const body: unknown = await c.req.json()

    if (
      body === null ||
      typeof body !== 'object' ||
      !('name' in body) ||
      typeof body.name !== 'string' ||
      body.name.trim().length === 0
    ) {
      return c.json({ error: 'Home name is required' }, 400)
    }

    const name = body.name.trim()
    const id = crypto.randomUUID()

    await c.env.DB.prepare('INSERT INTO homes (id, name) VALUES (?, ?)').bind(id, name).run()

    return c.json({ id, name }, 201)
  } catch (error) {
    console.error('Failed to create home:', error)
    return c.json({ error: 'Failed to create home' }, 500)
  }
})

// Add a member to a home
app.post('/api/homes/:homeId/members', async (c) => {
  try {
    const homeId = c.req.param('homeId')
    const body: unknown = await c.req.json()

    if (
      body === null ||
      typeof body !== 'object' ||
      !('name' in body) ||
      typeof body.name !== 'string' ||
      body.name.trim().length === 0
    ) {
      return c.json({ error: 'Member name is required' }, 400)
    }

    const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()

    if (!home) {
      return c.json({ error: 'Home not found' }, 404)
    }

    const name = body.name.trim()
    const id = crypto.randomUUID()

    await c.env.DB.prepare('INSERT INTO members (id, home_id, name) VALUES (?, ?, ?)')
      .bind(id, homeId, name)
      .run()

    return c.json({ id, homeId, name }, 201)
  } catch (error) {
    console.error('Failed to add member:', error)
    return c.json({ error: 'Failed to add member' }, 500)
  }
})

// Get all homes
app.get('/api/homes', async (c) => {
  try {
    const { results: homes } = await c.env.DB.prepare(
      'SELECT id, name FROM homes ORDER BY rowid DESC',
    ).all<{ id: string; name: string }>()

    return c.json({ homes })
  } catch (error) {
    console.error('Failed to get homes:', error)
    return c.json({ error: 'Failed to get homes' }, 500)
  }
})

// Get all members of a home
app.get('/api/homes/:homeId/members', async (c) => {
  try {
    const homeId = c.req.param('homeId')

    const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()

    if (!home) {
      return c.json({ error: 'Home not found' }, 404)
    }

    const { results: members } = await c.env.DB.prepare(
      'SELECT id, home_id AS homeId, name FROM members WHERE home_id = ? ORDER BY rowid ASC',
    )
      .bind(homeId)
      .all<{ id: string; homeId: string; name: string }>()

    return c.json({ members })
  } catch (error) {
    console.error('Failed to get members:', error)
    return c.json({ error: 'Failed to get members' }, 500)
  }
})

// Get all bills and their shares for a home
app.get('/api/homes/:homeId/bills', async (c) => {
  try {
    const homeId = c.req.param('homeId')

    const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()

    if (!home) {
      return c.json({ error: 'Home not found' }, 404)
    }

    const { results: bills } = await c.env.DB.prepare(
      `SELECT id, home_id AS homeId, title, total_cents AS totalCents
       FROM bills
       WHERE home_id = ?
       ORDER BY rowid DESC`,
    )
      .bind(homeId)
      .all<{
        id: string
        homeId: string
        title: string
        totalCents: number
      }>()

    const { results: shares } = await c.env.DB.prepare(
      `SELECT
         s.id,
         s.bill_id AS billId,
         s.member_id AS memberId,
         m.name AS memberName,
         s.amount_cents AS amountCents,
         s.paid_at AS paidAt
       FROM shares s
       JOIN members m ON m.id = s.member_id
       WHERE s.home_id = ?
       ORDER BY s.rowid ASC`,
    )
      .bind(homeId)
      .all<{
        id: string
        billId: string
        memberId: string
        memberName: string
        amountCents: number
        paidAt: string | null
      }>()

    const billsWithShares = bills.map((bill) => ({
      ...bill,
      shares: shares
        .filter((share) => share.billId === bill.id)
        .map(({ billId: _billId, ...share }) => share),
    }))

    return c.json({ bills: billsWithShares })
  } catch (error) {
    console.error('Failed to get bills:', error)
    return c.json({ error: 'Failed to get bills' }, 500)
  }
})

// Create a bill and split it equally among home members
app.post('/api/homes/:homeId/bills', async (c) => {
  try {
    const homeId = c.req.param('homeId')
    const body: unknown = await c.req.json()

    if (
      body === null ||
      typeof body !== 'object' ||
      !('title' in body) ||
      typeof body.title !== 'string' ||
      body.title.trim().length === 0
    ) {
      return c.json({ error: 'Bill title is required' }, 400)
    }

    if (
      !('totalCents' in body) ||
      typeof body.totalCents !== 'number' ||
      !Number.isInteger(body.totalCents) ||
      body.totalCents <= 0
    ) {
      return c.json({ error: 'totalCents must be a positive whole number' }, 422)
    }

    const title = body.title.trim()
    const totalCents = body.totalCents

    const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()

    if (!home) {
      return c.json({ error: 'Home not found' }, 404)
    }

    const { results: members } = await c.env.DB.prepare(
      'SELECT id FROM members WHERE home_id = ? ORDER BY rowid ASC',
    )
      .bind(homeId)
      .all<{ id: string }>()

    if (members.length === 0) {
      return c.json({ error: 'Cannot create a bill without members' }, 422)
    }

    const billId = crypto.randomUUID()

    const baseAmount = Math.floor(totalCents / members.length)
    const remainder = totalCents % members.length

    const shares = members.map((member, index) => ({
      id: crypto.randomUUID(),
      memberId: member.id,
      amountCents: baseAmount + (index < remainder ? 1 : 0),
      paidAt: null,
    }))

    const statements = [
      c.env.DB.prepare(
        'INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)',
      ).bind(billId, homeId, title, totalCents),

      ...shares.map((share) =>
        c.env.DB.prepare(
          'INSERT INTO shares (id, bill_id, member_id, home_id, amount_cents) VALUES (?, ?, ?, ?, ?)',
        ).bind(share.id, billId, share.memberId, homeId, share.amountCents),
      ),
    ]

    await c.env.DB.batch(statements)

    return c.json(
      {
        id: billId,
        homeId,
        title,
        totalCents,
        shares,
      },
      201,
    )
  } catch (error) {
    console.error('Failed to create bill:', error)
    return c.json({ error: 'Failed to create bill' }, 500)
  }
})

// Pay a share
app.post('/api/bills/:billId/shares/:shareId/pay', async (c) => {
  try {
    const billId = c.req.param('billId')
    const shareId = c.req.param('shareId')
    const idempotencyKey = c.req.header('Idempotency-Key')

    // An idempotency key is required
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      return c.json({ error: 'Idempotency-Key header is required' }, 400)
    }

    // Check whether the bill exists
    const bill = await c.env.DB.prepare('SELECT id FROM bills WHERE id = ?').bind(billId).first()

    if (!bill) {
      return c.json({ error: 'Bill not found' }, 404)
    }

    // Find the share belonging to this bill
    const share = await c.env.DB.prepare(
      `SELECT id, member_id, amount_cents, paid_at, idempotency_key
       FROM shares
       WHERE id = ? AND bill_id = ?`,
    )
      .bind(shareId, billId)
      .first<{
        id: string
        member_id: string
        amount_cents: number
        paid_at: string | null
        idempotency_key: string | null
      }>()

    if (!share) {
      return c.json({ error: 'Share not found' }, 404)
    }

    // If already paid, check whether this is a retry
    if (share.paid_at !== null) {
      if (share.idempotency_key === idempotencyKey) {
        return c.json({
          id: share.id,
          memberId: share.member_id,
          amountCents: share.amount_cents,
          paidAt: share.paid_at,
        })
      }

      return c.json({ error: 'Share has already been paid' }, 409)
    }

    const paidAt = new Date().toISOString()

    // Only one request can change an unpaid share into a paid share
    const result = await c.env.DB.prepare(
      `UPDATE shares
       SET paid_at = ?, idempotency_key = ?
       WHERE id = ? AND bill_id = ?
       AND paid_at IS NULL`,
    )
      .bind(paidAt, idempotencyKey, shareId, billId)
      .run()

    // The update succeeded
    if (result.meta.changes > 0) {
      return c.json({
        id: share.id,
        memberId: share.member_id,
        amountCents: share.amount_cents,
        paidAt,
      })
    }

    // Another request may have paid the share at the same time.
    // Read the latest state to handle that safely.
    const latestShare = await c.env.DB.prepare(
      `SELECT id, member_id, amount_cents, paid_at, idempotency_key
       FROM shares
       WHERE id = ? AND bill_id = ?`,
    )
      .bind(shareId, billId)
      .first<{
        id: string
        member_id: string
        amount_cents: number
        paid_at: string | null
        idempotency_key: string | null
      }>()

    if (
      latestShare?.paid_at !== null &&
      latestShare?.paid_at !== undefined &&
      latestShare.idempotency_key === idempotencyKey
    ) {
      return c.json({
        id: latestShare.id,
        memberId: latestShare.member_id,
        amountCents: latestShare.amount_cents,
        paidAt: latestShare.paid_at,
      })
    }

    return c.json({ error: 'Share has already been paid' }, 409)
  } catch (error) {
    console.error('Failed to pay share:', error)
    return c.json({ error: 'Failed to pay share' }, 500)
  }
})

// Get outstanding balances for all members of a home
app.get('/api/homes/:homeId/balances', async (c) => {
  try {
    const homeId = c.req.param('homeId')

    // Check whether the home exists
    const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()

    if (!home) {
      return c.json({ error: 'Home not found' }, 404)
    }

    // Calculate each member's unpaid shares
    const { results: balances } = await c.env.DB.prepare(
      `SELECT
        m.id AS memberId,
        m.name AS name,
        COALESCE(
          SUM(
            CASE
              WHEN s.paid_at IS NULL THEN s.amount_cents
              ELSE 0
            END
          ),
          0
        ) AS outstandingCents
      FROM members m
      LEFT JOIN shares s
        ON s.member_id = m.id
        AND s.home_id = m.home_id
      WHERE m.home_id = ?
      GROUP BY m.id, m.name
      ORDER BY m.rowid ASC`,
    )
      .bind(homeId)
      .all<{
        memberId: string
        name: string
        outstandingCents: number
      }>()

    return c.json({ balances })
  } catch (error) {
    console.error('Failed to get balances:', error)
    return c.json({ error: 'Failed to get balances' }, 500)
  }
})

export default app
