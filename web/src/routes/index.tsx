import { createFileRoute } from '@tanstack/react-router'
import type { FormEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Balance, Bill, Home, Member } from '../lib/types'
import '../styles/global.css'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function formatMoney(cents: number) {
  return `₹${(cents / 100).toFixed(2)}`
}

function HomePage() {
  const [homes, setHomes] = useState<Home[]>([])
  const [selectedHomeId, setSelectedHomeId] = useState('')

  const [members, setMembers] = useState<Member[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [balances, setBalances] = useState<Balance[]>([])

  const [homeName, setHomeName] = useState('')
  const [memberName, setMemberName] = useState('')
  const [billTitle, setBillTitle] = useState('')
  const [billAmount, setBillAmount] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [payingShareId, setPayingShareId] = useState('')

  const [error, setError] = useState('')

  const selectedHome = homes.find((home) => home.id === selectedHomeId)

  const loadHomes = useCallback(async () => {
    const result = await api.getHomes()
    setHomes(result.homes)

    const firstHome = result.homes[0]

    if (firstHome) {
      setSelectedHomeId((currentId) => currentId || firstHome.id)
    }
  }, [])

  const loadHomeData = useCallback(async (homeId: string) => {
    const [memberResult, billResult, balanceResult] = await Promise.all([
      api.getMembers(homeId),
      api.getBills(homeId),
      api.getBalances(homeId),
    ])

    setMembers(memberResult.members)
    setBills(billResult.bills)
    setBalances(balanceResult.balances)
  }, [])

  useEffect(() => {
    async function initialize() {
      try {
        setLoading(true)
        setError('')
        await loadHomes()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load homes')
      } finally {
        setLoading(false)
      }
    }

    initialize()
  }, [loadHomes])

  useEffect(() => {
    if (!selectedHomeId) {
      setMembers([])
      setBills([])
      setBalances([])
      return
    }

    let cancelled = false

    async function loadSelectedHome() {
      try {
        setLoading(true)
        setError('')

        setMembers([])
        setBills([])
        setBalances([])

        const [memberResult, billResult, balanceResult] = await Promise.all([
          api.getMembers(selectedHomeId),
          api.getBills(selectedHomeId),
          api.getBalances(selectedHomeId),
        ])

        if (!cancelled) {
          setMembers(memberResult.members)
          setBills(billResult.bills)
          setBalances(balanceResult.balances)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load home data')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadSelectedHome()

    return () => {
      cancelled = true
    }
  }, [selectedHomeId])

  async function refreshHomeData() {
    if (selectedHomeId) {
      await loadHomeData(selectedHomeId)
    }
  }

  async function handleCreateHome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!homeName.trim()) return

    try {
      setSaving(true)
      setError('')

      const newHome = await api.createHome(homeName.trim())
      const result = await api.getHomes()

      setHomes(result.homes)
      setSelectedHomeId(newHome.id)
      setHomeName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create home')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedHomeId || !memberName.trim()) return

    try {
      setSaving(true)
      setError('')

      await api.addMember(selectedHomeId, memberName.trim())
      setMemberName('')
      await refreshHomeData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add member')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const amount = Number(billAmount)

    if (!selectedHomeId || !billTitle.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid bill title and amount.')
      return
    }

    const totalCents = Math.round(amount * 100)

    if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
      setError('Enter a valid bill amount.')
      return
    }

    try {
      setSaving(true)
      setError('')

      await api.createBill(selectedHomeId, billTitle.trim(), totalCents)

      setBillTitle('')
      setBillAmount('')
      await refreshHomeData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create bill')
    } finally {
      setSaving(false)
    }
  }

  async function handlePayShare(billId: string, shareId: string) {
    try {
      setPayingShareId(shareId)
      setError('')

      await api.payShare(billId, shareId)
      await refreshHomeData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process payment')
    } finally {
      setPayingShareId('')
    }
  }

  const totalBills = bills.reduce((total, bill) => total + bill.totalCents, 0)

  const totalOutstanding = balances.reduce((total, balance) => total + balance.outstandingCents, 0)

  const totalPaid = totalBills - totalOutstanding

  if (loading && homes.length === 0) {
    return <div className="empty-state">Loading your Bill Splitter...</div>
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">SplitWise</div>

        <div className="nav-label">Workspace</div>
        <div className="nav-item active">▦ Dashboard</div>

        <div className="nav-label">Your homes</div>

        {homes.map((home) => (
          <button
            type="button"
            key={home.id}
            className={`nav-item home-select ${selectedHomeId === home.id ? 'active' : ''}`}
            onClick={() => setSelectedHomeId(home.id)}
          >
            ◈ {home.name}
          </button>
        ))}

        {homes.length === 0 && <p className="small-text">No homes created yet.</p>}
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>Dashboard</h1>
            <p className="subtitle">Manage shared expenses and keep track of payments.</p>
          </div>

          {selectedHome && (
            <div className="small-text">
              Current home: <strong>{selectedHome.name}</strong>
            </div>
          )}
        </header>

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        <section className="card" style={{ marginBottom: 22 }}>
          <div className="card-heading">
            <h2>Create a home</h2>
          </div>

          <form onSubmit={handleCreateHome} className="form-row">
            <input
              className="input"
              placeholder="Enter home name"
              value={homeName}
              onChange={(event) => setHomeName(event.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={saving || !homeName.trim()}>
              Create Home
            </button>
          </form>
        </section>

        {loading ? (
          <section className="card empty-state">Loading home data...</section>
        ) : selectedHomeId ? (
          <>
            <section className="stats-grid">
              <div className="card">
                <div className="stat-label">Total bills</div>
                <div className="stat-value">{formatMoney(totalBills)}</div>
                <div className="small-text">{bills.length} bills recorded</div>
              </div>

              <div className="card">
                <div className="stat-label">Total paid</div>
                <div className="stat-value">{formatMoney(totalPaid)}</div>
                <div className="small-text">Payments completed</div>
              </div>

              <div className="card">
                <div className="stat-label">Outstanding</div>
                <div className="stat-value">{formatMoney(totalOutstanding)}</div>
                <div className="small-text">Remaining unpaid amount</div>
              </div>
            </section>

            <section className="content-grid">
              <div className="card">
                <div className="card-heading">
                  <h2>Members</h2>
                  <span className="small-text">{members.length} members</span>
                </div>

                <form onSubmit={handleAddMember} className="form-row">
                  <input
                    className="input"
                    placeholder="Member name"
                    value={memberName}
                    onChange={(event) => setMemberName(event.target.value)}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving || !memberName.trim()}
                  >
                    Add
                  </button>
                </form>

                {members.length === 0 ? (
                  <div className="empty-state">No members yet. Add members to get started.</div>
                ) : (
                  members.map((member) => (
                    <div className="member-row" key={member.id}>
                      <div className="member-info">
                        <div className="avatar">{member.name.charAt(0).toUpperCase()}</div>
                        <strong>{member.name}</strong>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="card">
                <div className="card-heading">
                  <h2>Outstanding balances</h2>
                </div>

                {balances.length === 0 ? (
                  <div className="empty-state">Balances will appear here.</div>
                ) : (
                  balances.map((balance) => (
                    <div className="balance-row" key={balance.memberId}>
                      <span>{balance.name}</span>
                      <strong>{formatMoney(balance.outstandingCents)}</strong>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="card" style={{ marginBottom: 22 }}>
              <div className="card-heading">
                <h2>Create a bill</h2>
              </div>

              <form onSubmit={handleCreateBill}>
                <div className="form-row">
                  <input
                    className="input"
                    placeholder="Bill title (e.g. Electricity)"
                    value={billTitle}
                    onChange={(event) => setBillTitle(event.target.value)}
                  />

                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Total amount (₹)"
                    value={billAmount}
                    onChange={(event) => setBillAmount(event.target.value)}
                  />

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving || members.length === 0 || !billTitle.trim() || !billAmount}
                  >
                    Split Bill
                  </button>
                </div>

                {members.length === 0 && (
                  <p className="small-text">Add at least one member before creating a bill.</p>
                )}
              </form>
            </section>

            <section className="card">
              <div className="card-heading">
                <h2>Recent bills</h2>
                <span className="small-text">{bills.length} total</span>
              </div>

              {bills.length === 0 ? (
                <div className="empty-state">No bills yet. Create your first shared bill.</div>
              ) : (
                bills.map((bill) => (
                  <div className="bill-row" key={bill.id}>
                    <div>
                      <strong>{bill.title}</strong>
                      <div className="small-text">{bill.shares.length} member shares</div>

                      <div className="share-list">
                        {bill.shares.map((share) => (
                          <div className="share-item" key={share.id}>
                            <div>
                              <strong>{share.memberName ?? 'Member'}</strong>
                              <div className="small-text">{formatMoney(share.amountCents)}</div>
                            </div>

                            <div>
                              {share.paidAt ? (
                                <span className="status status-paid">Paid</span>
                              ) : (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                  }}
                                >
                                  <span className="status status-unpaid">Unpaid</span>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    disabled={payingShareId === share.id}
                                    onClick={() => handlePayShare(bill.id, share.id)}
                                  >
                                    {payingShareId === share.id ? 'Processing...' : 'Pay'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <strong>{formatMoney(bill.totalCents)}</strong>
                  </div>
                ))
              )}
            </section>
          </>
        ) : (
          <section className="card empty-state">
            <h2>Welcome to SplitWise!</h2>
            <p>Create a home to start managing shared expenses.</p>
          </section>
        )}
      </main>
    </div>
  )
}
