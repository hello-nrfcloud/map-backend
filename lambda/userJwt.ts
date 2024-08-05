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
import { Context, Email } from '@hello.nrfcloud.com/proto-map/api'
import middy from '@middy/core'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { userJWT } from '../jwt/userJWT.js'
import { getSettings } from '../settings/jwt.js'
import { emailConfirmationTokensRepo } from '../users/emailConfirmationTokensRepo.js'
import { tryAsJSON } from '@hello.nrfcloud.com/lambda-helpers/tryAsJSON'

const { TableName, version, stackName } = fromEnv({
	version: 'VERSION',
	TableName: 'EMAIL_CONFIRMATION_TOKENS_TABLE_NAME',
	stackName: 'STACK_NAME',
})(process.env)

const db = new DynamoDBClient({})
const ssm = new SSMClient({})

const validateInput = validateWithTypeBox(
	Type.Object({
		email: Email,
		token: Type.String({
			minLength: 1,
			title: 'Token',
			description: 'The current email confirmation token',
		}),
	}),
)

const tokenRepo = emailConfirmationTokensRepo({ db, TableName })

const jwtSettings = await getSettings({ ssm, stackName })

const h = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event }))

	const maybeValidQuery = validateInput(tryAsJSON(event.body))

	if ('errors' in maybeValidQuery) {
		return aProblem({
			title: 'Validation failed',
			status: 400,
			detail: formatTypeBoxErrors(maybeValidQuery.errors),
		})
	}

	const { email, token } = maybeValidQuery.value

	const maybeValidToken = await tokenRepo.verifyToken({
		email,
		token,
	})

	if ('error' in maybeValidToken) {
		return aProblem({
			title: maybeValidToken.error.message,
			status: 400,
		})
	}

	return aResponse(
		201,
		{
			'@context': Context.userJWT,
			jwt: userJWT(email, jwtSettings),
		},
		60 * 60 * 24, // 24 hours
	)
}

export const handler = middy()
	.use(addVersionHeader(version))
	.use(corsOPTIONS('POST'))
	.handler(h)
