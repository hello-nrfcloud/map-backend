export const normalizeEmail = (email: string): string => {
	const normalized = email.trim().toLowerCase()
	const [user, domain] = normalized.split('@') as [string, string]
	return `${user.split('+')[0]}@${domain}`
}
