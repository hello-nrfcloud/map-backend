import path from 'node:path'
import {
	type ImageBuilder,
	type ImageChecker,
} from '@bifravst/aws-cdk-ecr-helpers/image'
import { hashFolder } from '@bifravst/aws-cdk-ecr-helpers/hashFolder'
import { hashFile } from '@bifravst/aws-cdk-ecr-helpers/hashFile'
import fs from 'node:fs/promises'
import run from '@bifravst/run'
import os from 'node:os'
import { packLambdaFromPath } from '@bifravst/aws-cdk-lambda-helpers'
import { checkSumOfStrings } from '@bifravst/aws-cdk-lambda-helpers/util'
import type { logFn } from '../../../cli/log.js'
import { ContainerRepositoryId } from '../../../aws/ecr.js'
import { fileURLToPath } from 'node:url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import pJSON from '../../../package.json'

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

	const tag = checkSumOfStrings([
		await hashFolder(dockerFilePath),
		hash,
		await hashFile(path.join(__dirname, '..', '..', '..', 'package.json')),
		await hashFile(__filename),
	])

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

	await run({
		command: 'npm',
		args: [
			'i',
			`@hello.nrfcloud.com/certificate-helpers@${pJSON.dependencies['@hello.nrfcloud.com/certificate-helpers']}`,
			`@bifravst/run@${pJSON.devDependencies['@bifravst/run']}`,
		],
		log: { debug, stderr: debug, stdout: debug },
		cwd: path.join(distDir, 'lambda'),
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
