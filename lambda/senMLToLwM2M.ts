import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { IoTDataPlaneClient } from '@aws-sdk/client-iot-data-plane'
import { SenML, senMLtoLwM2M } from '@hello.nrfcloud.com/proto-map'
import { fromEnv } from '@nordicsemiconductor/from-env'
import {
	publicDevicesRepo,
	type PublicDevice,
} from '../sharing/publicDevicesRepo.js'
import { updateLwM2MShadow } from './updateLwM2MShadow.js'
import { validateWithTypeBox } from '@hello.nrfcloud.com/proto'
import { metricsForComponent } from '@hello.nrfcloud.com/lambda-helpers/metrics'
import { MetricUnit } from '@aws-lambda-powertools/metrics'
import middy from '@middy/core'
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware'
import {
	CloudWatchLogsClient,
	PutLogEventsCommand,
	CreateLogStreamCommand,
} from '@aws-sdk/client-cloudwatch-logs'
import id128 from 'id128'

const { TableName, importLogGroupName } = fromEnv({
	TableName: 'PUBLIC_DEVICES_TABLE_NAME',
	importLogGroupName: 'IMPORT_LOGGROUP_NAME',
})(process.env)

const logs = new CloudWatchLogsClient({})

const updateShadow = updateLwM2MShadow(new IoTDataPlaneClient({}))

const devicesRepo = publicDevicesRepo({
	db: new DynamoDBClient({}),
	TableName,
})
const devicesInfoCache = new Map<string, { id: string; model: string } | null>()

const isValid = validateWithTypeBox(SenML)

const { track, metrics } = metricsForComponent(
	'deviceMessage',
	'hello-nrfcloud-map',
)

/**
 * Store SenML messages as LwM2M objects in a named shadow.
 */
const h = async (event: {
	message: Record<string, unknown>
	deviceId: string
}): Promise<void> => {
	console.debug(JSON.stringify({ event }))
	const { deviceId, message } = event

	track('message', MetricUnit.Count, 1)

	if (!devicesInfoCache.has(deviceId)) {
		const maybeDevice = await devicesRepo.getByDeviceId(deviceId)
		if ('error' in maybeDevice) {
			console.debug(`[${deviceId}]`, `Error: ${maybeDevice.error}`)
			devicesInfoCache.set(deviceId, null)
		} else {
			devicesInfoCache.set(deviceId, maybeDevice.publicDevice)
		}
	}
	const deviceInfo = devicesInfoCache.get(deviceId) as PublicDevice | null
	if (deviceInfo === null) {
		console.debug(`[${deviceId}]`, 'unknown device')
		return
	}

	const logStreamName = `${deviceInfo.id}-${id128.Ulid.generate().toCanonical()}`

	await logs.send(
		new CreateLogStreamCommand({
			logGroupName: importLogGroupName,
			logStreamName,
		}),
	)

	// TODO: Limit number of messages per day

	const maybeValidSenML = isValid(message)
	if ('errors' in maybeValidSenML) {
		// TODO: persist errors so users can debug their payloads
		console.error(JSON.stringify(maybeValidSenML.errors))
		console.error(`Invalid SenML message`)
		await logs.send(
			new PutLogEventsCommand({
				logGroupName: importLogGroupName,
				logStreamName,
				logEvents: [
					{
						timestamp: Date.now(),
						message: JSON.stringify({
							success: false,
							id: deviceInfo.id,
							error: 'Invalid SenML message',
							detail: maybeValidSenML.errors,
							senML: message,
						}),
					},
				],
			}),
		)
		return
	}

	const objects = senMLtoLwM2M(maybeValidSenML.value)

	console.debug(`[${deviceId}]`, deviceInfo.model, objects)

	await logs.send(
		new PutLogEventsCommand({
			logGroupName: importLogGroupName,
			logStreamName,
			logEvents: [
				{
					timestamp: Date.now(),
					message: JSON.stringify({
						success: true,
						id: deviceInfo.id,
						model: deviceInfo.model,
						senML: message,
						lwm2m: objects,
					}),
				},
			],
		}),
	)

	await updateShadow(deviceInfo.id, objects)
}

export const handler = middy().use(logMetrics(metrics)).handler(h)
