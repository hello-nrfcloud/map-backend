import { QueryCommand, type DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { getByDeviceId } from './getByDeviceId.js'
import type { PublicDeviceRecord } from './PublicDeviceRecord.js'
import type { PublicDeviceRecordError } from './PublicDeviceRecordError.js'

export const getById = ({
	db,
	TableName,
	idIndex,
}: {
	db: DynamoDBClient
	TableName: string
	idIndex: string
}): ((
	id: string,
) => Promise<{ device: PublicDeviceRecord } | PublicDeviceRecordError>) => {
	const byDeviceId = getByDeviceId({ db, TableName })
	return async (id: string) => {
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
		return await byDeviceId(unmarshall(device).deviceId)
	}
}
