import { hashFile } from '@bifravst/aws-cdk-ecr-helpers/hashFile'
import { hashFolder } from '@bifravst/aws-cdk-ecr-helpers/hashFolder'
import {
	type ImageBuilder,
	type ImageChecker,
} from '@bifravst/aws-cdk-ecr-helpers/image'
import { packLambdaFromPath } from '@bifravst/aws-cdk-lambda-helpers'
import { checkSumOfStrings } from '@bifravst/aws-cdk-lambda-helpers/util'
import run from '@bifravst/run'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ContainerRepositoryId } from '../../../aws/ecr.js'
import type { logFn } from '../../../cli/log.js'
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

	const deps = new Map<string, string>()
	for (const dep of [
		'@bifravst/run',
		'@hello.nrfcloud.com/certificate-helpers',
		'@hello.nrfcloud.com/lambda-helpers',
		'@middy/core',
	]) {
		const version =
			pJSON.dependencies[dep as keyof typeof pJSON.dependencies] ??
			pJSON.devDependencies[dep as keyof typeof pJSON.devDependencies]
		if (version === undefined)
			throw new Error(`[OpenSSLImage] Failed to determine version for ${dep}!`)
		deps.set(dep, version)
	}

	await run({
		command: 'npm',
		args: ['i', ...[...deps.entries()].map(([dep, v]) => `${dep}@${v}`)],
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
