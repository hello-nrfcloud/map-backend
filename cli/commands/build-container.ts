import type { ECRClient } from '@aws-sdk/client-ecr'
import {
	buildAndPublishImage,
	checkIfImageExists,
} from '@bifravst/aws-cdk-ecr-helpers/image'
import { getOrCreateRepository } from '@bifravst/aws-cdk-ecr-helpers/repository'
import { ContainerRepositoryId } from '../../aws/ecr.js'
import { buildOpenSSLLambdaImage } from '../../cdk/resources/containers/buildOpenSSLLambdaImage.js'
import { STACK_NAME } from '../../cdk/stackConfig.js'
import { debug as debugFn } from '../log.js'
import type { CommandDefinition } from './CommandDefinition.js'

export const buildContainersCommand = ({
	ecr,
}: {
	ecr: ECRClient
}): CommandDefinition => ({
	command: 'build-container <id>',
	options: [
		{
			flags: '-d, --debug',
		},
		{
			flags: '-p, --pull',
		},
	],
	action: async (id, { debug: debugEnabled, pull }) => {
		const ensureRepo = getOrCreateRepository({ ecr })
		const debug = (debugEnabled as boolean) ? debugFn : undefined
		if (id === ContainerRepositoryId.OpenSSLLambda) {
			const openSSLLayerRepo = await ensureRepo({
				stackName: STACK_NAME,
				id: ContainerRepositoryId.OpenSSLLambda,
				debug,
			})
			process.stdout.write(
				await buildOpenSSLLambdaImage(
					buildAndPublishImage({
						ecr,
						repo: openSSLLayerRepo,
					}),
					checkIfImageExists({
						ecr,
						repo: openSSLLayerRepo,
					}),
					debugFn('OpenSSL lambda image'),
					pull as undefined | boolean,
				),
			)
		} else {
			throw new Error(`Unknown container ID: ${id}`)
		}
	},
	help: `Build the container needed to run the backend. <id> can be only be ${ContainerRepositoryId.OpenSSLLambda}`,
})
