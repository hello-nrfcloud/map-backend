import {
	DeleteItemCommand,
	type DynamoDBClient,
	GetItemCommand,
	PutItemCommand,
	QueryCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { randomWords } from '@bifravst/random-words'
import { models } from '@hello.nrfcloud.com/proto-map/models'
import { normalizeEmail } from '../users/normalizeEmail.js'
import { consentDurationSeconds } from './consentDuration.js'

export type PublicDeviceRecord = {
	/**
	 * This is the public ID of the device, a UUIDv4.
	 * Only the public ID should be shown.
	 *
	 * @example "fbb18b8e-c2f9-41fe-8cfa-4107e4e54d72"
	 */
	id: string
	/**
	 * This is the ID the device uses to connect to nRF Cloud
	 *
	 * @example "oob-352656108602296"
	 */
	deviceId: string
	model: keyof typeof models
	ownerEmail: string
	ttl: number
}

const modelNames = Object.keys(models)

type PublicDeviceRecordError = {
	error:
		| 'not_found'
		| 'not_confirmed'
		| 'confirmation_expired'
		| 'unsupported_model'
}

export const publicDevicesRepo = ({
	db,
	TableName,
	now,
	idIndex,
}: {
	db: DynamoDBClient
	TableName: string
	now?: Date
	idIndex: string
}): {
	/**
	 * Contains all data, not intended to be shared publically.
	 */
	getByDeviceId: (
		deviceId: string,
	) => Promise<{ device: PublicDeviceRecord } | PublicDeviceRecordError>
	getById: (
		id: string,
	) => Promise<{ device: PublicDeviceRecord } | PublicDeviceRecordError>
	share: (args: { deviceId: string; model: string; email: string }) => Promise<
		| {
				error: Error
		  }
		| {
				device: {
					id: string
				}
		  }
	>
	remove: (id: string) => Promise<
		| {
				error: Error
		  }
		| {
				success: true
		  }
	>
} => {
	const getByDeviceId = async (
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
	return {
		getByDeviceId,
		getById: async (id) => {
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
			return await getByDeviceId(unmarshall(device).deviceId)
		},
		// TODO: limit the amount of devices that can be created by a user
		share: async ({ deviceId, model, email }) => {
			const id = randomWords({ numWords: 3 }).join('-')

			try {
				await db.send(
					new PutItemCommand({
						TableName,
						Item: marshall(
							{
								deviceId: deviceId.toLowerCase(),
								id,
								ttl:
									Math.round((now ?? new Date()).getTime() / 1000) +
									consentDurationSeconds,
								model,
								ownerEmail: normalizeEmail(email),
							},
							{
								removeUndefinedValues: true,
							},
						),
						ConditionExpression: 'attribute_not_exists(deviceId)',
					}),
				)
			} catch (err) {
				return {
					error: err as Error,
				}
			}

			return {
				device: {
					id,
				},
			}
		},
		remove: async (deviceId) => {
			try {
				await db.send(
					new DeleteItemCommand({
						TableName,
						Key: marshall({
							deviceId,
						}),
					}),
				)
				return {
					success: true,
				}
			} catch (err) {
				return { error: err as Error }
			}
		},
	}
}

export const toPublic = (
	device: PublicDeviceRecord,
): Pick<PublicDeviceRecord, 'id' | 'deviceId' | 'model'> => ({
	id: device.id,
	deviceId: device.deviceId,
	model: device.model,
})
