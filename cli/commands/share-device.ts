import type { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { models } from '@hello.nrfcloud.com/proto-map'
import chalk from 'chalk'
import { publicDevicesRepo } from '../../devices/publicDevicesRepo.js'
import type { CommandDefinition } from './CommandDefinition.js'

const modelIDs = Object.keys(models)

export const shareDevice = ({
	db,
	publicDevicesTableName,
	idIndex,
}: {
	db: DynamoDBClient
	publicDevicesTableName: string
	idIndex: string
}): CommandDefinition => ({
	command: `share-device <deviceId> <model> <email>`,
	action: async (deviceId, model, email) => {
		console.log(publicDevicesTableName)
		if (!modelIDs.includes(model))
			throw new Error(
				`Unknown model ${model}. Known models are ${modelIDs.join(', ')}.`,
			)
		if (!/.+@.+/.test(email)) {
			throw new Error(`Must provide valid email.`)
		}
		console.debug(chalk.yellow('Device ID:'), chalk.blue(deviceId))
		const publicDevice = publicDevicesRepo({
			db,
			TableName: publicDevicesTableName,
			idIndex,
		})
		const maybePublished = await publicDevice.share({
			deviceId,
			model,
			email,
			confirmed: true,
		})
		if ('error' in maybePublished) {
			console.error(maybePublished.error)
			throw new Error(`Failed to share device.`)
		}
	},
	help: 'Shares an existing device to be shown on the map',
})
