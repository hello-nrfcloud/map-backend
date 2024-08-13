import { GetItemCommand, type DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { models } from '@hello.nrfcloud.com/proto-map/models'
import type { PublicDeviceRecord } from './PublicDeviceRecord.js'
import type { PublicDeviceRecordError } from './PublicDeviceRecordError.js'

const modelNames = Object.keys(models)

export const getDevicebyDeviceId =
	({ db, TableName }: { db: DynamoDBClient; TableName: string }) =>
	async (
		deviceId: string,
	): Promise<{ device: PublicDeviceRecord } | PublicDeviceRecordError> => {
		const { Item } = await db.send(
			new GetItemCommand({
				TableName,
				Key: marshall({
					deviceId: deviceId.toLowerCase(),
				}),
			}),
		)
		if (Item === undefined) return { error: 'not_found' }
		const device = unmarshall(Item) as PublicDeviceRecord
		if (device.ttl * 1000 < Date.now()) return { error: 'confirmation_expired' }
		if (!modelNames.includes(device.model))
			return { error: 'unsupported_model' }
		return {
			device,
		}
	}
