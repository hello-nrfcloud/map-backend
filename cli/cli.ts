import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { ECRClient } from '@aws-sdk/client-ecr'
import { SSMClient } from '@aws-sdk/client-ssm'
import { STSClient } from '@aws-sdk/client-sts'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import chalk from 'chalk'
import { program } from 'commander'
import { env } from '../aws/env.js'
import type { StackOutputs } from '../cdk/BackendStack.js'
import { STACK_NAME } from '../cdk/stackConfig.js'
import psjon from '../package.json'
import type { CommandDefinition } from './commands/CommandDefinition.js'
import { buildContainersCommand } from './commands/build-container.js'
import { configureHelloCommand } from './commands/configure-hello.js'
import { configureNrfCloudAccountCommand } from './commands/configure-nrfcloud-account.js'
import { generateJWTKeypairCommand } from './commands/generate-jwt-keypair.js'
import { listDevicesCommand } from './commands/listDevices.js'
import { logsCommand } from './commands/logs.js'
import { registerDeviceCommand } from './commands/register-device.js'
import { removeDeviceCommand } from './commands/remove-device.js'
import { shareDeviceCommand } from './commands/share-device.js'

const ssm = new SSMClient({})
const db = new DynamoDBClient({})
const cf = new CloudFormationClient({})
const ecr = new ECRClient({})
const sts = new STSClient({})
const logs = new CloudWatchLogsClient({})

const accountEnv = await env({ sts })

const die = (err: Error, origin: any) => {
	console.error(`An unhandled exception occurred!`)
	console.error(`Exception origin: ${JSON.stringify(origin)}`)
	console.error(err)
	process.exit(1)
}

process.on('uncaughtException', die)
process.on('unhandledRejection', die)

console.error('')

const CLI = async ({ isCI }: { isCI: boolean }) => {
	program.name('./cli.sh')
	program.description(
		`hello.nrfcloud.com backend ${psjon.version} Command Line Interface`,
	)
	program.version(psjon.version)

	const commands: CommandDefinition[] = [
		buildContainersCommand({
			ecr,
		}),
		configureHelloCommand({ ssm }),
		configureNrfCloudAccountCommand({ ssm }),
		logsCommand({
			stackName: STACK_NAME,
			cf,
			logs,
		}),
		generateJWTKeypairCommand({ ssm }),
	]

	if (isCI) {
		console.error('Running on CI...')
	} else {
		try {
			const backendOutputs = await stackOutput(cf)<StackOutputs>(STACK_NAME)
			commands.push(
				registerDeviceCommand({
					db,
					publicDevicesTableName: backendOutputs.publicDevicesTableName,
					idIndex: backendOutputs.publicDevicesTableIdIndexName,
					ssm,
					env: accountEnv,
					stackName: STACK_NAME,
				}),
				removeDeviceCommand({
					db,
					publicDevicesTableName: backendOutputs.publicDevicesTableName,
					idIndex: backendOutputs.publicDevicesTableIdIndexName,
					ssm,
					stackName: STACK_NAME,
				}),
				shareDeviceCommand({
					db,
					publicDevicesTableName: backendOutputs.publicDevicesTableName,
					idIndex: backendOutputs.publicDevicesTableIdIndexName,
				}),
				listDevicesCommand({
					db,
					publicDevicesTableName: backendOutputs.publicDevicesTableName,
				}),
			)
		} catch (error) {
			console.warn(chalk.yellow('⚠️'), chalk.yellow((error as Error).message))
		}
	}

	let ran = false
	commands.forEach(({ command, action, help, options }) => {
		const cmd = program.command(command)
		cmd
			.action(async (...args) => {
				try {
					ran = true
					await action(...args)
				} catch (error) {
					console.error(
						chalk.red.inverse(' ERROR '),
						chalk.red(`${command} failed!`),
					)
					console.error(chalk.red.inverse(' ERROR '), chalk.red(error))
					process.exit(1)
				}
			})
			.on('--help', () => {
				console.log('')
				console.log(chalk.yellow(help))
				console.log('')
			})
		if (options) {
			options.forEach(({ flags, description, defaultValue }) =>
				cmd.option(flags, description, defaultValue),
			)
		}
	})

	program.parse(process.argv)

	if (!ran) {
		program.outputHelp()
		throw new Error('No command selected!')
	}
}

CLI({
	isCI: process.env.CI === '1',
}).catch((err) => {
	console.error(chalk.red(err))
	process.exit(1)
})
