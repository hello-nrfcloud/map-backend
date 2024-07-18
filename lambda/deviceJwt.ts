import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@bifravst/from-env'
import { aProblem } from '@hello.nrfcloud.com/lambda-helpers/aProblem'
import { aResponse } from '@hello.nrfcloud.com/lambda-helpers/aResponse'
import { addVersionHeader } from '@hello.nrfcloud.com/lambda-helpers/addVersionHeader'
import { corsOPTIONS } from '@hello.nrfcloud.com/lambda-helpers/corsOPTIONS'
import {
	formatTypeBoxErrors,
	validateWithTypeBox,
} from '@hello.nrfcloud.com/proto'
import { Context, PublicDeviceId } from '@hello.nrfcloud.com/proto-map/api'
import middy from '@middy/core'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { deviceJWT } from '../jwt/deviceJWT.js'
import { publicDevicesRepo } from '../devices/publicDevicesRepo.js'
import { getSettings } from '../settings/jwt.js'

const { TableName, version, idIndex, stackName } = fromEnv({
	version: 'VERSION',
	TableName: 'PUBLIC_DEVICES_TABLE_NAME',
	idIndex: 'PUBLIC_DEVICES_ID_INDEX_NAME',
	stackName: 'STACK_NAME',
})(process.env)

const db = new DynamoDBClient({})
const ssm = new SSMClient({})

const validateInput = validateWithTypeBox(
	Type.Object({
		id: PublicDeviceId,
	}),
)

const devicesRepo = publicDevicesRepo({ db, TableName, idIndex })

const jwtSettings = await getSettings({ ssm, stackName })

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

	const { id } = maybeValidQuery.value

	const maybeSharedDevice = await devicesRepo.getById(id)

	if ('error' in maybeSharedDevice) {
		return aProblem({
			title: `Device with id ${maybeValidQuery.value.id} not shared: ${maybeSharedDevice.error}`,
			status: 404,
		})
	}

	return aResponse(
		200,
		{
			'@context': Context.deviceJWT,
			id: maybeSharedDevice.device.id,
			deviceId: maybeSharedDevice.device.deviceId,
			model: maybeSharedDevice.device.model,
			jwt: deviceJWT(maybeSharedDevice.device, jwtSettings),
		},
		60 * 60 * 1000,
	)
}

export const handler = middy()
	.use(addVersionHeader(version))
	.use(corsOPTIONS('GET'))
	.handler(h)
