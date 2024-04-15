import {
	CloudWatchLogsClient,
	GetQueryResultsCommand,
	QueryStatus,
	StartQueryCommand,
	type ResultField,
} from '@aws-sdk/client-cloudwatch-logs'
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
import pRetry from 'p-retry'

const { importLogGroupName, version } = fromEnv({
	importLogGroupName: 'IMPORT_LOGGROUP_NAME',
	version: 'VERSION',
})(process.env)

const logs = new CloudWatchLogsClient({})

const validateInput = validateWithTypeBox(
	Type.Object({
		id: DeviceId,
	}),
)

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

	const queryString = `filter @logStream LIKE '${maybeValidQuery.value.id}-'
    | fields @timestamp, @message  
    | sort @timestamp desc 
    | limit 100`
	const { queryId } = await logs.send(
		new StartQueryCommand({
			logGroupName: importLogGroupName,
			queryString,
			startTime: Date.now() - 24 * 60 * 60 * 1000,
			endTime: Date.now(),
		}),
	)
	console.debug({ queryId, queryString })

	const results = await pRetry(
		async () => {
			const result = await logs.send(
				new GetQueryResultsCommand({
					queryId,
				}),
			)
			switch (result.status) {
				case QueryStatus.Cancelled:
					return []
				case QueryStatus.Complete:
					return result.results
				case QueryStatus.Failed:
					console.error(`Query failed!`)
					return []
				case QueryStatus.Timeout:
					console.error(`Query timed out!`)
					return []
				case QueryStatus.Running:
				case QueryStatus.Scheduled:
					throw new Error(`Running!`)
				case QueryStatus.Unknown:
				default:
					console.debug('Unknown query status.')
					return []
			}
		},
		{
			factor: 1,
			minTimeout: 1000,
			retries: 10,
		},
	)

	return aResponse(
		200,
		{
			'@context': Context.named('senml-import-logs'),
			results: (results ?? []).map((fields) => {
				const result = JSON.parse((fields[1] as ResultField).value as string)
				return {
					...result,
					ts: new Date(
						(fields[0] as ResultField).value as string,
					).toISOString(),
				}
			}),
		},
		60,
	)
}

export const handler = middy()
	.use(addVersionHeader(version))
	.use(corsOPTIONS('GET'))
	.handler(h)
