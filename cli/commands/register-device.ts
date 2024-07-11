import type { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import type { SSMClient } from '@aws-sdk/client-ssm'
import { models } from '@hello.nrfcloud.com/proto-map/models'
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

export const registerDeviceCommand = ({
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
	command: 'register-device <model> <email>',
	options: [
		{
			flags: '-i, --deviceId <deviceId>',
			description: `The device ID to use. If not provided, a random device ID will be generated.`,
		},
		{
			flags: '-c, --cert <cert>',
			description:
				'The location of the certificate to use for the device. If not provided, a new certificate will be generated.',
		},
	],
	action: async (
		model,
		email,
		{ deviceId: maybeDeviceId, cert: maybeCertificate },
	) => {
		if (!modelIDs.includes(model))
			throw new Error(
				`Unknown model ${model}. Known models are ${modelIDs.join(', ')}.`,
			)
		if (!/.+@.+/.test(email)) {
			throw new Error(`Must provide valid email.`)
		}
		const deviceId = maybeDeviceId ?? `map-${randomUUID()}`
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
			throw new Error(`Failed to register device.`)
		}

		const certificate =
			maybeCertificate === undefined
				? (await generateCert({ deviceId, env, email })).certificate
				: await fs.readFile(maybeCertificate, 'utf-8')

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
				subType: 'map',
				tags: ['map'],
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
	},
	help: 'Registers a device to be shown on the map',
})

const generateCert = async ({
	deviceId,
	env,
	email,
}: {
	email: string
	deviceId: string
	env: Environment
}): Promise<{ certificate: string }> => {
	const certDir = path.join(
		process.cwd(),
		'certificates',
		`${env.account}@${env.region}`,
		email,
	)
	try {
		await fs.stat(certDir)
	} catch {
		await fs.mkdir(certDir, { recursive: true })
	}
	const caCertificates = await createCA(certDir, 'Device', email)
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

	const credJSON = path.join(certDir, `${deviceId}.json`)
	await fs.writeFile(
		credJSON,
		JSON.stringify({ deviceId, privateKey, certificate }),
		'utf-8',
	)

	console.log(chalk.green(`Credentials written to`), chalk.cyan(credJSON))

	return { certificate }
}
