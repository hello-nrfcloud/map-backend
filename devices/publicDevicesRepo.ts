import {
	DeleteItemCommand,
	type DynamoDBClient,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
import { randomWords } from '@bifravst/random-words'
import { normalizeEmail } from '../users/normalizeEmail.js'
import { consentDurationSeconds } from './consentDuration.js'
import { getByDeviceId } from './getByDeviceId.js'
import { getById } from './getById.js'
import type { PublicDeviceRecord } from './PublicDeviceRecord.js'
import type { PublicDeviceRecordError } from './PublicDeviceRecordError.js'

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
	return {
		getByDeviceId: getByDeviceId({db, TableName}),
		getById: getById({ db, TableName, idIndex }),
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
