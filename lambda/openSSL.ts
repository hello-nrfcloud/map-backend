import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import run from '@bifravst/run'
import { createCA } from '@hello.nrfcloud.com/certificate-helpers/ca'
import { createDeviceCertificate } from '@hello.nrfcloud.com/certificate-helpers/device'
import middy from '@middy/core'
import { requestLogger } from '@hello.nrfcloud.com/lambda-helpers/requestLogger'

/**
 * Allows to use OpenSSL
 */
const h = async (event: {
	id: string
	email: string
}): Promise<{
	privateKey: string
	certificate: string
} | null> => {
	const { id, email } = event
	if (id === undefined || email === undefined) {
		console.debug(`Missing email and id.`)
		return null
	}

	console.log(`Creating certificate for email ${email} and id ${id} ...`)

	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'certs-'))
	const caCertificates = await createCA(tempDir, 'Device', email)
	const deviceCertificates = await createDeviceCertificate({
		dest: tempDir,
		caCertificates,
		deviceId: id,
	})

	console.log(
		await run({
			command: 'openssl',
			args: ['x509', '-in', deviceCertificates.signedCert, '-text', '-noout'],
		}),
	)

	const [privateKey, certificate] = (await Promise.all(
		[deviceCertificates.privateKey, deviceCertificates.signedCert].map(
			async (f) => fs.readFile(f, 'utf-8'),
		),
	)) as [string, string]

	return {
		privateKey,
		certificate,
	}
}

export const handler = middy().use(requestLogger()).handler(h)
