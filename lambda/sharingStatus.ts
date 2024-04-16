import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
	formatTypeBoxErrors,
	validateWithTypeBox,
} from '@hello.nrfcloud.com/proto'
import { Context } from '@hello.nrfcloud.com/proto-map/api'
import { DeviceId } from '@hello.nrfcloud.com/proto-map/api'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { publicDevicesRepo, toPublic } from '../devices/publicDevicesRepo.js'
import middy from '@middy/core'
import { corsOPTIONS } from '@hello.nrfcloud.com/lambda-helpers/corsOPTIONS'
import { aResponse } from '@hello.nrfcloud.com/lambda-helpers/aResponse'
import { aProblem } from '@hello.nrfcloud.com/lambda-helpers/aProblem'
import { addVersionHeader } from '@hello.nrfcloud.com/lambda-helpers/addVersionHeader'

const { TableName, version, idIndex } = fromEnv({
	version: 'VERSION',
	TableName: 'PUBLIC_DEVICES_TABLE_NAME',
	idIndex: 'PUBLIC_DEVICES_ID_INDEX_NAME',
})(process.env)

const db = new DynamoDBClient({})

const validateInput = validateWithTypeBox(
	Type.Object({
		id: DeviceId,
	}),
)

const devicesRepo = publicDevicesRepo({ db, TableName, idIndex })

const h = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event }))

	const maybeValidQuery = validateInput(event.pathParameters)

	if ('errors' in maybeValidQuery) {
		return aProblem({
			title: 'Validation failed',
			status: 400,
			detail: formatTypeBoxErrors(maybeValidQuery.errors),
		})
	}

	const maybeDevice = await devicesRepo.getById(maybeValidQuery.value.id)

	console.log(JSON.stringify(maybeDevice))

	if ('error' in maybeDevice) {
		return aProblem({
			title: `Device ${maybeValidQuery.value.id} not shared: ${maybeDevice.error}`,
			status: 404,
		})
	}

	return aResponse(
		200,
		{
			'@context': Context.device,
			...toPublic(maybeDevice.device),
		},
		60 * 60 * 24,
	)
}

export const handler = middy()
	.use(addVersionHeader(version))
	.use(corsOPTIONS('GET'))
	.handler(h)
