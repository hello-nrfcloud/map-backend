import type { SESClient } from '@aws-sdk/client-ses'
import { SendEmailCommand } from '@aws-sdk/client-ses'

export const sendEmailVerificationEmail =
	(ses: SESClient, fromEmail: string) =>
	async ({
		email,
		confirmationToken,
	}: {
		email: string
		confirmationToken: string
	}): Promise<void> => {
		await ses.send(
			new SendEmailCommand({
				Destination: {
					ToAddresses: [email],
				},
				Message: {
					Body: {
						Text: {
							Data: [
								`This is your token to verify your email: ${confirmationToken}`,
							].join('\n'),
						},
					},
					Subject: {
						Data: `[hello.nrfcloud.com] › Verify your email: ${confirmationToken}`,
					},
				},
				Source: fromEmail,
			}),
		)
	}
