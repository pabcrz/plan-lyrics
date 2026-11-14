import { createClerkClient } from '@clerk/backend'

/**
 * Port to the authentication provider. The application owns users and permissions; the provider only
 * creates the login account and sends the invitation e-mail. There is no public sign-up path.
 */
export interface IdentityProvider {
  /** Ensures a provider account exists for the e-mail (idempotent) and e-mails the invitation. */
  inviteByEmail(email: string): Promise<{ subject: string }>
}

/** The slice of the Clerk Backend API the adapter uses, so tests can fake it without the network. */
export type ClerkLike = {
  users: {
    getUserList(params: { emailAddress: string[] }): Promise<{ data: Array<{ id: string }> }>
    createUser(params: { emailAddress: string[]; skipPasswordRequirement: boolean }): Promise<{ id: string }>
  }
  invitations: {
    createInvitation(params: { emailAddress: string; ignoreExisting: boolean; notify: boolean }): Promise<{ id: string }>
  }
}

export const IDENTITY_UNAVAILABLE = 'Identity provider unavailable'

export function clerkIdentityProvider(client: ClerkLike): IdentityProvider {
  return {
    async inviteByEmail(email) {
      try {
        // Find first so a retry after a partial failure never creates a second provider account.
        const found = await client.users.getUserList({ emailAddress: [email] })
        const subject = found.data[0]?.id ?? (await client.users.createUser({ emailAddress: [email], skipPasswordRequirement: true })).id
        await client.invitations.createInvitation({ emailAddress: email, ignoreExisting: true, notify: true })
        return { subject }
      } catch {
        // Never forward provider messages: they can echo keys, addresses or request details.
        throw new Error(IDENTITY_UNAVAILABLE)
      }
    },
  }
}

/** Real adapter from `CLERK_SECRET_KEY`; undefined when the key is absent so the routes answer 503. */
export function identityProviderFromEnv(secretKey: string | undefined): IdentityProvider | undefined {
  const key = secretKey?.trim()
  return key ? clerkIdentityProvider(createClerkClient({ secretKey: key })) : undefined
}
