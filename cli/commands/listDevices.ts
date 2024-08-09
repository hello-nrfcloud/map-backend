import { ScanCommand, type DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import chalk from 'chalk'
import { table } from 'table'
import type { CommandDefinition } from './CommandDefinition.js'

export const listDevicesCommand = ({
	db,
	publicDevicesTableName,
}: {
	db: DynamoDBClient
	publicDevicesTableName: string
}): CommandDefinition => ({
	command: 'list-devices',
	options: [
		{
			flags: '-n, --nextKey <key>',
			description: `Pagination key`,
		},
	],
	action: async ({ nextKey }) => {
		const { Items, LastEvaluatedKey } = await db.send(
			new ScanCommand({
				TableName: publicDevicesTableName,
				Limit: 100,
				ExclusiveStartKey:
					nextKey !== undefined
						? JSON.parse(Buffer.from(nextKey, 'base64').toString())
						: undefined,
			}),
		)

		console.log(
			table([
				['Device ID', 'Public ID', 'Model', 'Owner Email', 'Confirmed until'],
				...(Items ?? [])
					.map((i) => unmarshall(i))
					.map(({ deviceId, id, model, ownerEmail, ttl }) => [
						chalk.green(deviceId),
						chalk.blue(id),
						model,
						ownerEmail,
						new Date(ttl * 1000).toISOString(),
					]),
			]),
		)

		console.log(
			LastEvaluatedKey
				? `More devices available: ${Buffer.from(JSON.stringify(LastEvaluatedKey)).toString('base64')}`
				: 'No more devices',
		)
	},
	help: 'List public devices',
})
