import { ScanCommand, type DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { hasItems } from './hasItems.js'
import type { PublicDeviceRecord } from './PublicDeviceRecord.js'

export const listExpiringDevices =
	({ db, TableName }: { db: DynamoDBClient; TableName: string }) =>
	async (expiresUntil: Date): Promise<Array<PublicDeviceRecord>> => {
		const res = await db.send(
			new ScanCommand({
				TableName,
				FilterExpression: '#ttl < :expiresUntil',
				ExpressionAttributeNames: {
					'#ttl': 'ttl',
				},
				ExpressionAttributeValues: {
					':expiresUntil': {
						N: (expiresUntil.getTime() / 1000).toString(),
					},
				},
			}),
		)
		if (!hasItems(res)) return []
		return res.Items.map((i) => unmarshall(i) as PublicDeviceRecord)
	}
