import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
	formatTypeBoxErrors,
	validateWithTypeBox,
} from '@hello.nrfcloud.com/proto'
import { Context } from '@hello.nrfcloud.com/proto-map/api'
import { fromEnv } from '@bifravst/from-env'
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
import { fingerprintRegExp } from '@hello.nrfcloud.com/proto/fingerprint'
import { helloApi } from '../hello/api.js'
import { getSettings } from '../settings/hello.js'
import { SSMClient } from '@aws-sdk/client-ssm'

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
		fingerprint: Type.RegExp(fingerprintRegExp),
	}),
)

const devicesRepo = publicDevicesRepo({ db, TableName, idIndex })

const helloSettings = await getSettings({ ssm, stackName })

const hello = helloApi({
	endpoint: helloSettings.apiEndpoint,
})

const h = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event }))

	const maybeValidQuery = validateInput(event.queryStringParameters)

	if ('errors' in maybeValidQuery) {
		return aProblem({
			title: 'Validation failed',
			status: 400,
			detail: formatTypeBoxErrors(maybeValidQuery.errors),
		})
	}

	const maybeDevice = await hello.getDeviceByFingerprint(
		maybeValidQuery.value.fingerprint,
	)
	if ('error' in maybeDevice) {
		return aProblem(maybeDevice.error)
	}
	const { id: deviceId } = maybeDevice.result

	console.log(JSON.stringify(maybeDevice))

	const maybeSharedDevice = await devicesRepo.getByDeviceId(deviceId)

	console.log(JSON.stringify(maybeSharedDevice))

	if ('error' in maybeSharedDevice) {
		return aProblem({
			title: `Device with fingerprint ${maybeValidQuery.value.fingerprint} not shared: ${maybeSharedDevice.error}`,
			status: 404,
		})
	}

	return aResponse(
		200,
		{
			'@context': Context.device,
			...toPublic(maybeSharedDevice.device),
		},
		60 * 60 * 24,
	)
}

export const handler = middy()
	.use(addVersionHeader(version))
	.use(corsOPTIONS('GET'))
	.handler(h)
