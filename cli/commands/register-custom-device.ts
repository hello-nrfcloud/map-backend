import type { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SSMClient } from '@aws-sdk/client-ssm'
import { models } from '@hello.nrfcloud.com/proto-map'
import type { Environment } from 'aws-cdk-lib'
import chalk from 'chalk'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { publicDevicesRepo } from '../../devices/publicDevicesRepo.js'
import { createCA } from '@hello.nrfcloud.com/certificate-helpers/ca'
import { createDeviceCertificate } from '@hello.nrfcloud.com/certificate-helpers/device'
import type { CommandDefinition } from './CommandDefinition.js'
import { getAPISettings } from '@hello.nrfcloud.com/nrfcloud-api-helpers/settings'
import { devices as devicesApi } from '@hello.nrfcloud.com/nrfcloud-api-helpers/api'
import { NRF_CLOUD_ACCOUNT } from '../../settings/account.js'

const modelIDs = Object.keys(models)

export const registerCustomMapDevice = ({
	ssm,
	stackName,
	db,
	publicDevicesTableName,
	idIndex,
	env,
}: {
	ssm: SSMClient
	stackName: string
	db: DynamoDBClient
	publicDevicesTableName: string
	idIndex: string
	env: Required<Environment>
}): CommandDefinition => ({
	command: 'register-custom-map-device <model> <email>',
	action: async (model, email) => {
		if (!modelIDs.includes(model))
			throw new Error(
				`Unknown model ${model}. Known models are ${modelIDs.join(', ')}.`,
			)
		if (!/.+@.+/.test(email)) {
			throw new Error(`Must provide valid email.`)
		}
		const deviceId = `map-${randomUUID()}`
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
			throw new Error(`Failed to register custom device.`)
		}

		const certDir = path.join(
			process.cwd(),
			'certificates',
			`${env.account}@${env.region}`,
			email,
		)
		try {
			await fs.mkdir(certDir)
		} catch {
			// pass
		}
		const caCertificates = await createCA(certDir, 'Custom Device', email)
		const deviceCertificates = await createDeviceCertificate({
			dest: certDir,
			caCertificates,
			deviceId,
		})

		const [privateKey, certificate] = (await Promise.all(
			[deviceCertificates.privateKey, deviceCertificates.signedCert].map(
				async (f) => fs.readFile(f, 'utf-8'),
			),
		)) as [string, string]

		const { apiKey, apiEndpoint } = await getAPISettings({
			ssm,
			stackName,
			account: NRF_CLOUD_ACCOUNT,
		})()

		const client = devicesApi({
			endpoint: apiEndpoint,
			apiKey,
		})

		const registration = await client.register([
			{
				deviceId,
				subType: 'map-custom',
				tags: ['map', 'map-custom'],
				certPem: certificate,
			},
		])

		if ('error' in registration) {
			console.error(registration.error)
			throw new Error(`Failed to register device on nRF Cloud.`)
		}
		console.debug(
			chalk.gray('BulkOps Request ID'),
			chalk.gray(registration.bulkOpsRequestId),
		)

		const credJSON = path.join(certDir, `${deviceId}.json`)
		await fs.writeFile(
			credJSON,
			JSON.stringify({ deviceId, privateKey, certificate }),
			'utf-8',
		)

		console.log(chalk.green(`Credentials written to`), chalk.cyan(credJSON))
	},
	help: 'Registers a custom device to be shown on the map',
})
