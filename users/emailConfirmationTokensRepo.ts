import {
	type DynamoDBClient,
	GetItemCommand,
	UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
import { generateCode } from '@hello.nrfcloud.com/proto/fingerprint'

export const emailConfirmationTokensRepo = ({
	db,
	TableName,
	now,
}: {
	db: DynamoDBClient
	TableName: string
	now?: Date
}): {
	requestToken: (args: {
		email: string
		generateToken?: () => string
	}) => Promise<
		| {
				error: Error
		  }
		| {
				user: {
					email: string
					confirmationToken: string
				}
		  }
	>
	verifyToken: (args: { email: string; token: string }) => Promise<
		| {
				error: Error
		  }
		| {
				token: {
					expires: Date
				}
		  }
	>
} => {
	return {
		requestToken: async ({ email, generateToken }) => {
			const confirmationToken = (
				generateToken?.() ?? generateCode()
			).toUpperCase()

			// Expires in 5 Minutes
			const expires = new Date(now?.getTime() ?? Date.now() + 5 * 60 * 1000)
			// Rerequest after 1 Minute
			const rerequestAfter = new Date(
				now?.getTime() ?? Date.now() + 1 * 60 * 1000,
			)

			try {
				await db.send(
					new UpdateItemCommand({
						TableName,
						Key: marshall({ email: normalize(email) }),
						UpdateExpression:
							'SET #confirmationToken = :confirmationToken, #ttl = :ttl, #rerequestAfter = :rerequestAfter',
						ConditionExpression:
							'attribute_not_exists(email) OR #ttl < :now OR #rerequestAfter < :now',
						ExpressionAttributeNames: {
							'#confirmationToken': 'confirmationToken',
							'#ttl': 'ttl',
							'#rerequestAfter': 'rerequestAfter',
						},
						ExpressionAttributeValues: {
							':confirmationToken': {
								S: confirmationToken,
							},
							':ttl': {
								N: `${Math.floor(expires.getTime() / 1000)}`,
							},
							':rerequestAfter': {
								N: `${Math.floor(rerequestAfter.getTime() / 1000)}`,
							},
							':now': {
								N: `${Math.floor((now?.getTime() ?? Date.now()) / 1000)}`,
							},
						},
					}),
				)
			} catch (err) {
				return {
					error: err as Error,
				}
			}

			return {
				user: {
					email,
					confirmationToken,
				},
			}
		},
		verifyToken: async ({ email, token }) => {
			try {
				const item = await db.send(
					new GetItemCommand({
						TableName,
						Key: marshall({ email: normalize(email) }),
					}),
				)
				if (item.Item?.confirmationToken?.S !== token) {
					return {
						error: new Error('Token mismatch'),
					}
				}
				return {
					token: {
						expires: new Date(item.Item?.ttl?.N ?? Date.now()),
					},
				}
			} catch (err) {
				return {
					error: err as Error,
				}
			}
		},
	}
}

const normalize = (email: string) => email.trim().toLowerCase()
