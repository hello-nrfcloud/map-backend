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
import { fromEnv } from '@bifravst/from-env'
import { Type } from '@sinclair/typebox'
import {
	type APIGatewayProxyEventV2,
	type APIGatewayProxyResultV2,
} from 'aws-lambda'
import { publicDevicesRepo } from '../devices/publicDevicesRepo.js'

const { publicDevicesTableName, version, idIndex } = fromEnv({
	version: 'VERSION',
	publicDevicesTableName: 'PUBLIC_DEVICES_TABLE_NAME',
	idIndex: 'PUBLIC_DEVICES_ID_INDEX_NAME',
})(process.env)

const db = new DynamoDBClient({})

const publicDevice = publicDevicesRepo({
	db,
	TableName: publicDevicesTableName,
	idIndex,
})

const validateInput = validateWithTypeBox(
	Type.Object({
		deviceId: DeviceId,
		token: Type.RegExp(/^[0-9A-Z]{6}$/, {
			title: 'Ownership Confirmation Token',
			description: 'The 6 character token to confirm the ownership.',
			examples: ['RPGWT2'],
		}),
	}),
)

const h = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify(event))

	const maybeValidInput = validateInput(JSON.parse(event.body ?? '{}'))
	if ('errors' in maybeValidInput) {
		return aProblem({
			title: 'Validation failed',
			status: 400,
			detail: formatTypeBoxErrors(maybeValidInput.errors),
		})
	}

	const { deviceId, token } = maybeValidInput.value

	const maybeConfirmed = await publicDevice.confirmOwnership({
		deviceId,
		ownershipConfirmationToken: token,
	})
	if ('error' in maybeConfirmed) {
		return aProblem({
			title: `Failed to confirm your ownership: ${maybeConfirmed.error.message}`,
			status: 400,
		})
	}

	console.debug(JSON.stringify({ deviceId }))

	return aResponse(200, {
		'@context': Context.shareDevice.ownershipConfirmed,
		id: maybeConfirmed.device.id,
	})
}

export const handler = middy()
	.use(addVersionHeader(version))
	.use(corsOPTIONS('POST'))
	.handler(h)
