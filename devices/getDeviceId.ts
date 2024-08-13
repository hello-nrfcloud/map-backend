import { QueryCommand, type DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { PublicDeviceRecord } from './PublicDeviceRecord.js'
import type { PublicDeviceRecordError } from './PublicDeviceRecordError.js'

export const getDeviceId =
	({
		db,
		TableName,
		idIndex,
	}: {
		db: DynamoDBClient
		TableName: string
		idIndex: string
	}): ((
		id: string,
	) => Promise<
		{ deviceId: PublicDeviceRecord['deviceId'] } | PublicDeviceRecordError
	>) =>
	async (id: string) => {
		const { Items } = await db.send(
			new QueryCommand({
				TableName,
				IndexName: idIndex,
				KeyConditionExpression: '#id = :id',
				ExpressionAttributeNames: {
					'#id': 'id',
					'#deviceId': 'deviceId',
				},
				ExpressionAttributeValues: {
					':id': {
						S: id,
					},
				},
				ProjectionExpression: '#id, #deviceId',
			}),
		)
		const device = (Items ?? [])[0]
		if (device === undefined) return { error: 'not_found' }
		return {
			deviceId: unmarshall(device).deviceId,
		}
	}
