import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { aProblem } from '@hello.nrfcloud.com/lambda-helpers/aProblem'
import { aResponse } from '@hello.nrfcloud.com/lambda-helpers/aResponse'
import { addVersionHeader } from '@hello.nrfcloud.com/lambda-helpers/addVersionHeader'
import { corsOPTIONS } from '@hello.nrfcloud.com/lambda-helpers/corsOPTIONS'
import {
	formatTypeBoxErrors,
	validateWithTypeBox,
} from '@hello.nrfcloud.com/proto'
import { Context, DeviceId } from '@hello.nrfcloud.com/proto-map/api'
import middy from '@middy/core'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { importLogs } from '../senml/import-logs.js'
import type { models } from '@hello.nrfcloud.com/proto-map'
import { publicDevicesRepo } from '../devices/publicDevicesRepo.js'

const { TableName, importLogsTableName, version, idIndex } = fromEnv({
	TableName: 'PUBLIC_DEVICES_TABLE_NAME',
	idIndex: 'PUBLIC_DEVICES_ID_INDEX_NAME',
	importLogsTableName: 'IMPORT_LOGS_TABLE_NAME',
	version: 'VERSION',
})(process.env)

const db = new DynamoDBClient({})

const validateInput = validateWithTypeBox(
	Type.Object({
		id: DeviceId,
	}),
)

const logDb = importLogs(db, importLogsTableName)

const devicesRepo = publicDevicesRepo({ db, TableName, idIndex })
const deviceModelCache = new Map<string, keyof typeof models>()

const h = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	const maybeValidQuery = validateInput(event.pathParameters)

	if ('errors' in maybeValidQuery) {
		return aProblem({
			title: 'Validation failed',
			status: 400,
			detail: formatTypeBoxErrors(maybeValidQuery.errors),
		})
	}

	const id = maybeValidQuery.value.id

	if (!deviceModelCache.has(id)) {
		const maybeDevice = await devicesRepo.getById(id)
		if ('error' in maybeDevice) {
			return aProblem({
				title: `Device ${maybeValidQuery.value.id} not shared: ${maybeDevice.error}`,
				status: 404,
			})
		}
		deviceModelCache.set(id, maybeDevice.device.model)
	}
	const model = deviceModelCache.get(id) as keyof typeof models

	return aResponse(
		200,
		{
			'@context': Context.named('senml-imports'),
			id,
			model,
			imports: await logDb.findLogs(maybeValidQuery.value.id),
		},
		60,
	)
}

export const handler = middy()
	.use(addVersionHeader(version))
	.use(corsOPTIONS('GET'))
	.handler(h)
