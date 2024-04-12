import { IAMClient } from '@aws-sdk/client-iam'
import { fromEnv } from '@nordicsemiconductor/from-env'
import pJSON from '../package.json'
import { BackendApp } from './BackendApp.js'
import { pack as packBaseLayer } from './baseLayer.js'
import { ensureGitHubOIDCProvider } from '@bifravst/ci'
import { packBackendLambdas } from './packBackendLambdas.js'

const repoUrl = new URL(pJSON.repository.url)
const repository = {
	owner: repoUrl.pathname.split('/')[1] ?? 'hello-nrfcloud',
	repo: repoUrl.pathname.split('/')[2]?.replace(/\.git$/, '') ?? 'backend',
}

const iam = new IAMClient({})

// Ensure needed container images exist
const { openSSLLambdaContainerTag } = fromEnv({
	openSSLLambdaContainerTag: 'OPENSSL_LAMBDA_CONTAINER_TAG',
})(process.env)

new BackendApp({
	lambdaSources: await packBackendLambdas(),
	layer: await packBaseLayer(),
	repository,
	gitHubOICDProviderArn: await ensureGitHubOIDCProvider({
		iam,
	}),
	isTest: process.env.IS_TEST === '1',
	openSSLLambdaContainerTag,
	domain: 'hello.nrfcloud.com',
	version: (() => {
		const v = process.env.VERSION
		const defaultVersion = '0.0.0-development'
		if (v === undefined)
			console.warn(`VERSION is not defined, using ${defaultVersion}!`)
		return v ?? defaultVersion
	})(),
})
