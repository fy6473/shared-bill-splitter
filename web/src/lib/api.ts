import type { Balance, Bill, Home, Member, Share } from './types'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController()

  // Automatically stop requests that take longer than 10 seconds.
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, 10000)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    const responseText = await response.text()

    let data: unknown = null

    try {
      data = responseText ? JSON.parse(responseText) : null
    } catch {
      data = null
    }

    if (!response.ok) {
      const errorMessage =
        typeof data === 'object' &&
        data !== null &&
        'error' in data &&
        typeof data.error === 'string'
          ? data.error
          : `Request failed with status ${response.status}`

      throw new Error(errorMessage)
    }

    if (data === null) {
      throw new Error('Server returned an empty or invalid response.')
    }

    return data as T
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.')
    }

    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

export const api = {
  getHomes: () => request<{ homes: Home[] }>('/api/homes'),

  createHome: (name: string) =>
    request<Home>('/api/homes', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  getMembers: (homeId: string) => request<{ members: Member[] }>(`/api/homes/${homeId}/members`),

  addMember: (homeId: string, name: string) =>
    request<Member>(`/api/homes/${homeId}/members`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  getBills: (homeId: string) => request<{ bills: Bill[] }>(`/api/homes/${homeId}/bills`),

  createBill: (homeId: string, title: string, totalCents: number) =>
    request<Bill>(`/api/homes/${homeId}/bills`, {
      method: 'POST',
      body: JSON.stringify({ title, totalCents }),
    }),

  payShare: (billId: string, shareId: string) =>
    request<Share>(`/api/bills/${billId}/shares/${shareId}/pay`, {
      method: 'POST',
      headers: {
        'Idempotency-Key': crypto.randomUUID(),
      },
    }),

  getBalances: (homeId: string) =>
    request<{ balances: Balance[] }>(`/api/homes/${homeId}/balances`),
}
