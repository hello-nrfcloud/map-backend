import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SSMClient } from '@aws-sdk/client-ssm'
import { STSClient } from '@aws-sdk/client-sts'
import { stackOutput } from '@nordicsemiconductor/cloudformation-helpers'
import chalk from 'chalk'
import { program } from 'commander'
import type { StackOutputs } from '../cdk/stacks/BackendStack.js'
import { STACK_NAME } from '../cdk/stacks/stackConfig.js'
import psjon from '../package.json'
import { ECRClient } from '@aws-sdk/client-ecr'
import { registerCustomMapDevice } from './commands/register-custom-device.js'
import type { CommandDefinition } from './commands/CommandDefinition.js'
import { buildContainersCommand } from './commands/build-container.js'
import { env } from '../aws/env.js'
import { configureNrfCloudAccount } from './commands/configure-nrfcloud-account.js'
import { logsCommand } from './commands/logs.js'
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs'
import { configureHello } from './commands/configure-hello.js'
import { shareDevice } from './commands/share-device.js'

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
		configureHello({ ssm }),
		configureNrfCloudAccount({ ssm }),
		logsCommand({
			stackName: STACK_NAME,
			cf,
			logs,
		}),
	]

	if (isCI) {
		console.error('Running on CI...')
	} else {
		try {
			const mapOutputs = await stackOutput(cf)<StackOutputs>(STACK_NAME)
			commands.push(
				registerCustomMapDevice({
					db,
					publicDevicesTableName: mapOutputs.publicDevicesTableName,
					ssm,
					env: accountEnv,
					stackName: STACK_NAME,
				}),
				shareDevice({
					db,
					publicDevicesTableName: mapOutputs.publicDevicesTableName,
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
