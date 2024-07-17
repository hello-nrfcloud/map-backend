import type { SSMClient } from '@aws-sdk/client-ssm'
import chalk from 'chalk'
import type { CommandDefinition } from './CommandDefinition.js'
import {
	deleteSetting as deleteSetting,
	putSetting as putSetting,
	type Settings,
} from '../../settings/jwt.js'
import { STACK_NAME } from '../../cdk/stackConfig.js'
import run from '@bifravst/run'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

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

		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jwt-'))
		const privateKeyFile = path.join(tempDir, 'private.pem')
		const publicKeyFile = path.join(tempDir, 'public.pem')

		await run({
			command: 'openssl',
			args: [
				'ecparam',
				'-out',
				privateKeyFile,
				'-name',
				'secp521r1',
				'-genkey',
			],
		})

		await run({
			command: 'openssl',
			args: ['ec', '-out', publicKeyFile, '-in', privateKeyFile, '-pubout'],
		})

		const privateKey = await fs.readFile(privateKeyFile, 'utf-8')
		const publicKey = await fs.readFile(publicKeyFile, 'utf-8')
		const keyId = crypto.randomUUID()

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
