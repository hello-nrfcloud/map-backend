import { SSMClient } from '@aws-sdk/client-ssm'
import chalk from 'chalk'
import { STACK_NAME } from '../../cdk/stacks/stackConfig.js'
import type { CommandDefinition } from './CommandDefinition.js'
import {
	deleteSettings,
	putSetting,
	type Settings,
} from '../../settings/hello.js'

export const configureHello = ({
	ssm,
}: {
	ssm: SSMClient
}): CommandDefinition => ({
	command: 'configure-hello <property> [value]',
	options: [
		{
			flags: '-d, --deleteBeforeUpdate',
			description: `Useful when depending on the parameter having version 1, e.g. for use in CloudFormation`,
		},
		{
			flags: '-X, --deleteParameter',
			description: 'Deletes the parameter.',
		},
	],
	action: async (
		property: keyof Settings,
		value: string | undefined,
		{ deleteBeforeUpdate, deleteParameter },
	) => {
		if (deleteParameter !== undefined) {
			// Delete
			const { name } = await deleteSettings({
				ssm,
				stackName: STACK_NAME,
			})(property)
			console.log()
			console.log(
				chalk.green('Deleted the parameters from'),
				chalk.blueBright(name),
			)
			return
		}

		if (value === undefined || value.length === 0) {
			throw new Error(`Must provide value!`)
		}

		const { name } = await putSetting({
			ssm,
			stackName: STACK_NAME,
		})(property as keyof Settings, new URL(value), deleteBeforeUpdate)

		console.log()
		console.log(
			chalk.green('Updated the configuration'),
			chalk.blueBright(name),
			chalk.green('to'),
			chalk.yellow(value),
		)
	},
	help: 'Configure the system.',
})
