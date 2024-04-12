import { SSMClient } from '@aws-sdk/client-ssm'
import chalk from 'chalk'
import { STACK_NAME } from '../../cdk/stacks/stackConfig.js'
import type { CommandDefinition } from './CommandDefinition.js'
import {
	deleteSettings,
	putSetting,
	type Settings,
} from '@hello.nrfcloud.com/nrfcloud-api-helpers/settings'
import { NRF_CLOUD_ACCOUNT } from '../../settings/account.js'

export const configureNrfCloudAccount = ({
	ssm,
}: {
	ssm: SSMClient
}): CommandDefinition => ({
	command: 'configure-nrfcloud-account <property> [value]',
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
		property: string,
		value: string | undefined,
		{ deleteBeforeUpdate, deleteParameter },
	) => {
		if (deleteParameter !== undefined) {
			// Delete
			const { name } = await deleteSettings({
				ssm,
				stackName: STACK_NAME,
				account: NRF_CLOUD_ACCOUNT,
			})(property)
			console.log()
			console.log(
				chalk.green('Deleted the parameters from'),
				chalk.blueBright(name),
			)
			return
		}

		if (value === undefined || value.length === 0) {
			throw new Error(`Must provide value either as argument or via stdin!`)
		}

		const { name } = await putSetting({
			ssm,
			stackName: STACK_NAME,
			account: NRF_CLOUD_ACCOUNT,
		})(property as keyof Settings, value, deleteBeforeUpdate)

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
