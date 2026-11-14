import { expect, test, vi } from 'vitest'
import { clerkIdentityProvider, type ClerkLike } from './identity-provider.js'

function fakeClerk(existing: Array<{ id: string }> = []) {
  const calls: string[] = []
  const client: ClerkLike = {
    users: {
      getUserList: vi.fn(async () => { calls.push('find'); return { data: existing } }),
      createUser: vi.fn(async () => { calls.push('create'); return { id: 'user_new' } }),
    },
    invitations: { createInvitation: vi.fn(async () => { calls.push('invite'); return { id: 'inv_1' } }) },
  }
  return { client, calls }
}

test('creates the provider account when the email is unknown, then invites it', async () => {
  const { client, calls } = fakeClerk()
  expect(await clerkIdentityProvider(client).inviteByEmail('ana@example.com')).toEqual({ subject: 'user_new' })
  expect(calls).toEqual(['find', 'create', 'invite'])
  expect(client.users.createUser).toHaveBeenCalledWith({ emailAddress: ['ana@example.com'], skipPasswordRequirement: true })
  expect(client.invitations.createInvitation).toHaveBeenCalledWith({ emailAddress: 'ana@example.com', ignoreExisting: true, notify: true })
})

test('reuses an existing provider account so a retry never duplicates it', async () => {
  const { client, calls } = fakeClerk([{ id: 'user_old' }])
  expect(await clerkIdentityProvider(client).inviteByEmail('ana@example.com')).toEqual({ subject: 'user_old' })
  expect(calls).toEqual(['find', 'invite'])
})

test('a provider failure surfaces as one generic error without the original message', async () => {
  const { client } = fakeClerk()
  client.users.getUserList = vi.fn(async () => { throw new Error('secret sk_live_123 leaked') })
  await expect(clerkIdentityProvider(client).inviteByEmail('ana@example.com')).rejects.toThrow(/^Identity provider unavailable$/)
})
