import { MetricUnit } from '@aws-lambda-powertools/metrics'
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { IoTDataPlaneClient } from '@aws-sdk/client-iot-data-plane'
import { metricsForComponent } from '@hello.nrfcloud.com/lambda-helpers/metrics'
import { validateWithTypeBox } from '@hello.nrfcloud.com/proto'
import { SenML, senMLtoLwM2M } from '@hello.nrfcloud.com/proto-map'
import middy from '@middy/core'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { importLogs } from '../senml/import-logs.js'
import {
	publicDevicesRepo,
	type PublicDeviceRecord,
} from '../devices/publicDevicesRepo.js'
import { updateLwM2MShadow } from './updateLwM2MShadow.js'

const { TableName, importLogsTableName, idIndex } = fromEnv({
	TableName: 'PUBLIC_DEVICES_TABLE_NAME',
	idIndex: 'PUBLIC_DEVICES_ID_INDEX_NAME',
	importLogsTableName: 'IMPORT_LOGS_TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const updateShadow = updateLwM2MShadow(new IoTDataPlaneClient({}))

const devicesRepo = publicDevicesRepo({
	db: new DynamoDBClient({}),
	TableName,
	idIndex,
})
const devicesInfoCache = new Map<string, { id: string; model: string } | null>()

const isValid = validateWithTypeBox(SenML)

const { track, metrics } = metricsForComponent(
	'deviceMessage',
	'hello-nrfcloud-map',
)

const logDb = importLogs(db, importLogsTableName)

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
			devicesInfoCache.set(deviceId, maybeDevice.device)
		}
	}
	const deviceInfo = devicesInfoCache.get(deviceId) as PublicDeviceRecord | null
	if (deviceInfo === null) {
		console.debug(`[${deviceId}]`, 'unknown device')
		return
	}

	// TODO: Limit number of messages per day

	const maybeValidSenML = isValid(message)
	if ('errors' in maybeValidSenML) {
		// TODO: persist errors so users can debug their payloads
		console.error(JSON.stringify(maybeValidSenML.errors))
		console.error(`Invalid SenML message`)
		track('error', MetricUnit.Count, 1)
		await logDb.recordError(deviceInfo.id, message, maybeValidSenML.errors)
		return
	}

	const objects = senMLtoLwM2M(maybeValidSenML.value)

	track('success', MetricUnit.Count, 1)

	console.debug(`[${deviceId}]`, deviceInfo.model, objects)

	await logDb.recordSuccess(deviceInfo, message, objects)

	await updateShadow(deviceInfo.id, objects)
}

export const handler = middy().use(logMetrics(metrics)).handler(h)
