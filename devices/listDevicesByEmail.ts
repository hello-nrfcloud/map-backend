import { QueryCommand, type DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { normalizeEmail } from '../users/normalizeEmail.ts'
import { hasItems } from './hasItems.ts'
import type { PublicDeviceRecord } from './PublicDeviceRecord.ts'

export const listDevicesByEmail =
	({
		db,
		TableName,
		emailIndexName,
	}: {
		db: DynamoDBClient
		TableName: string
		emailIndexName: string
	}) =>
	async (email: string): Promise<Array<PublicDeviceRecord>> => {
		const res = await db.send(
			new QueryCommand({
				TableName,
				IndexName: emailIndexName,
				KeyConditionExpression: '#ownerEmail = :email',
				ExpressionAttributeNames: {
					'#ownerEmail': 'ownerEmail',
				},
				ExpressionAttributeValues: {
					':email': {
						S: normalizeEmail(email),
					},
				},
			}),
		)
		if (!hasItems(res)) return []
		return res.Items.map((i) => unmarshall(i) as PublicDeviceRecord)
	}
