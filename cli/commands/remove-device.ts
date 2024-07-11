import type { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import type { SSMClient } from '@aws-sdk/client-ssm'
import { devices as devicesApi } from '@hello.nrfcloud.com/nrfcloud-api-helpers/api'
import { getAPISettings } from '@hello.nrfcloud.com/nrfcloud-api-helpers/settings'
import chalk from 'chalk'
import { publicDevicesRepo } from '../../devices/publicDevicesRepo.js'
import { NRF_CLOUD_ACCOUNT } from '../../settings/account.js'
import type { CommandDefinition } from './CommandDefinition.js'

export const removeDeviceCommand = ({
	ssm,
	stackName,
	db,
	publicDevicesTableName,
	idIndex,
}: {
	ssm: SSMClient
	stackName: string
	db: DynamoDBClient
	publicDevicesTableName: string
	idIndex: string
}): CommandDefinition => ({
	command: 'remove-device <id>',
	action: async (deviceId) => {
		console.debug(chalk.yellow('Device ID:'), chalk.blue(deviceId))
		const publicDevice = publicDevicesRepo({
			db,
			TableName: publicDevicesTableName,
			idIndex,
		})
		const maybePublished = await publicDevice.remove(deviceId)
		if ('error' in maybePublished) {
			console.error(maybePublished.error)
			throw new Error(`Failed to remove device.`)
		}

		const { apiKey, apiEndpoint } = await getAPISettings({
			ssm,
			stackName,
			account: NRF_CLOUD_ACCOUNT,
		})()

		const client = devicesApi({
			endpoint: apiEndpoint,
			apiKey,
		})

		const registration = await client.remove(deviceId)
		if ('error' in registration) {
			console.error(registration.error)
			throw new Error(`Failed to remove device from nRF Cloud.`)
		}
	},
	help: 'Removes a device',
})
