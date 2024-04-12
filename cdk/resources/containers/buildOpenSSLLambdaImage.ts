import path from 'node:path'
import {
	type ImageBuilder,
	type ImageChecker,
} from '@bifravst/aws-cdk-ecr-helpers/image'
import { hashFolder } from '@bifravst/aws-cdk-ecr-helpers/hashFolder'
import fs from 'node:fs/promises'
import run from '@bifravst/run'
import os from 'node:os'
import { packLambdaFromPath } from '@bifravst/aws-cdk-lambda-helpers'
import { checkSumOfStrings } from '@bifravst/aws-cdk-lambda-helpers/util'
import type { logFn } from '../../../cli/log.js'
import { ContainerRepositoryId } from '../../../aws/ecr.js'
import { fileURLToPath } from 'node:url'
const __dirname = fileURLToPath(new URL('.', import.meta.url))

export const buildOpenSSLLambdaImage = async (
	builder: ImageBuilder,
	checker: ImageChecker,
	debug?: logFn,
	pull?: boolean,
): Promise<string> => {
	const dockerFilePath = path.join(__dirname, 'openssl-lambda')

	const { zipFile, hash } = await packLambdaFromPath(
		'openSSL',
		'lambda/openSSL.ts',
	)

	const tag = checkSumOfStrings([await hashFolder(dockerFilePath), hash])

	if (
		await checker({
			tag,
			debug,
			pull,
		})
	) {
		return tag
	}

	const distDir = await fs.mkdtemp(path.join(os.tmpdir(), 'code-'))

	await run({
		command: 'unzip',
		args: ['-o', zipFile, '-d', path.join(distDir, 'lambda')],
		log: { debug, stderr: debug, stdout: debug },
	})

	await builder({
		id: ContainerRepositoryId.OpenSSLLambda,
		tag,
		dockerFilePath,
		debug,
		cwd: distDir,
	})
	return tag
}
