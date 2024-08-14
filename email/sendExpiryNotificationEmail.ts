import type { SESClient } from '@aws-sdk/client-ses'
import { SendEmailCommand } from '@aws-sdk/client-ses'

export const sendExpiryNotificationEmail =
	(ses: SESClient, fromEmail: string) =>
	async ({
		email,
		ids,
	}: {
		email: string
		ids: Array<string>
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
								`The following devices will expire soon and no longer be shared on the map:`,
								'',
								...ids.map((id) => `- ${id}`),
								'',
								'Please visit the dashboard to extend the expiration date of your devices.',
							].join('\n'),
						},
					},
					Subject: {
						Data: `[hello.nrfcloud.com] › Action needed: ${ids.length} of your devices will expire soon`,
					},
				},
				Source: fromEmail,
			}),
		)
	}
