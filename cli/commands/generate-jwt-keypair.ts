import type { SSMClient } from '@aws-sdk/client-ssm'
import chalk from 'chalk'
import type { CommandDefinition } from './CommandDefinition.js'
import {
	deleteSetting as deleteSetting,
	putSetting as putSetting,
	type Settings,
} from '../../settings/jwt.js'
import { STACK_NAME } from '../../cdk/stackConfig.js'
import { generateJWTKeyPair } from '../../jwt/generateJWTKeyPair.js'

export const generateJWTKeypairCommand = ({
	ssm,
}: {
	ssm: SSMClient
}): CommandDefinition => ({
	command: 'generate-jwt-keypair',
	options: [
		{
			flags: '-d, --deleteBeforeUpdate',
			description: `Useful when depending on the parameter having version 1, e.g. for use in CloudFormation`,
		},
	],
	action: async ({ deleteBeforeUpdate }) => {
		if (deleteBeforeUpdate !== undefined) {
			for (const property of ['privateKey', 'publicKey']) {
				// Delete
				const { name } = await deleteSetting({
					ssm,
					stackName: STACK_NAME,
				})(property as keyof Settings)
				console.log()
				console.log(
					chalk.green('Deleted the parameter'),
					chalk.blueBright(name),
				)
			}
			return
		}

		const { privateKey, publicKey, keyId } = await generateJWTKeyPair()

		const put = putSetting({
			ssm,
			stackName: STACK_NAME,
		})
		await put('privateKey', privateKey)
		await put('publicKey', publicKey)
		await put('keyId', keyId)

		console.log()
		console.log(chalk.green('Key pair generated'), chalk.blueBright(keyId))
	},
	help: "Generate the JWT keypair for authenticating requests to the backend's history API",
})
