import run from '@bifravst/run'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

export const generateJWTKeyPair = async (): Promise<{
	privateKey: string
	publicKey: string
	keyId: string
}> => {
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jwt-'))
	const privateKeyFile = path.join(tempDir, 'private.pem')
	const publicKeyFile = path.join(tempDir, 'public.pem')

	await run({
		command: 'openssl',
		args: ['ecparam', '-out', privateKeyFile, '-name', 'secp521r1', '-genkey'],
	})

	await run({
		command: 'openssl',
		args: ['ec', '-out', publicKeyFile, '-in', privateKeyFile, '-pubout'],
	})

	const [privateKey, publicKey] = await Promise.all([
		fs.readFile(privateKeyFile, 'utf-8'),
		fs.readFile(publicKeyFile, 'utf-8'),
	])
	const keyId = crypto.randomUUID()

	await Promise.all([fs.rm(privateKeyFile), fs.rm(publicKeyFile)])

	return { privateKey, publicKey, keyId }
}
