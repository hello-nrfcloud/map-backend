import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@bifravst/from-env'
import { aResponse } from '@hello.nrfcloud.com/lambda-helpers/aResponse'
import { addVersionHeader } from '@hello.nrfcloud.com/lambda-helpers/addVersionHeader'
import { corsOPTIONS } from '@hello.nrfcloud.com/lambda-helpers/corsOPTIONS'
import {
	ProblemDetailError,
	problemResponse,
} from '@hello.nrfcloud.com/lambda-helpers/problemResponse'
import { requestLogger } from '@hello.nrfcloud.com/lambda-helpers/requestLogger'
import {
	validateInput,
	type ValidInput,
} from '@hello.nrfcloud.com/lambda-helpers/validateInput'
import { Context, Email, type UserJWT } from '@hello.nrfcloud.com/proto-map/api'
import middy from '@middy/core'
import { Type, type Static } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
	Context as LambdaContext,
} from 'aws-lambda'
import { userJWT } from '../jwt/userJWT.js'
import { getSettings } from '../settings/jwt.js'
import { emailConfirmationTokensRepo } from '../users/emailConfirmationTokensRepo.js'

const { TableName, version, stackName } = fromEnv({
	version: 'VERSION',
	TableName: 'EMAIL_CONFIRMATION_TOKENS_TABLE_NAME',
	stackName: 'STACK_NAME',
})(process.env)

const db = new DynamoDBClient({})
const ssm = new SSMClient({})

const InputSchema = Type.Object({
	email: Email,
	token: Type.String({
		minLength: 1,
		title: 'Token',
		description: 'The current email confirmation token',
	}),
})

const tokenRepo = emailConfirmationTokensRepo({ db, TableName })

const jwtSettings = await getSettings({ ssm, stackName })

const h = async (
	event: APIGatewayProxyEventV2,
	context: ValidInput<typeof InputSchema> & LambdaContext,
): Promise<APIGatewayProxyResultV2> => {
	const { email, token } = context.validInput

	const maybeValidToken = await tokenRepo.verifyToken({
		email,
		token,
	})

	if ('error' in maybeValidToken) {
		throw new ProblemDetailError({
			title: maybeValidToken.error.message,
			status: 400,
		})
	}

	const jwt = userJWT(email, jwtSettings)

	const res: Static<typeof UserJWT> = {
		'@context': Context.userJWT.toString(),
		jwt,
		email,
	}

	return aResponse(
		201,
		{
			...res,
			'@context': Context.userJWT,
		},
		60 * 60 * 24, // 24 hours
	)
}

export const handler = middy()
	.use(addVersionHeader(version))
	.use(corsOPTIONS('POST'))
	.use(requestLogger())
	.use(validateInput(InputSchema))
	.use(problemResponse())
	.handler(h)
