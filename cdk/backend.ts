import { IAMClient } from '@aws-sdk/client-iam'
import { fromEnv } from '@nordicsemiconductor/from-env'
import pJSON from '../package.json'
import { BackendApp } from './BackendApp.js'
import { pack as packBaseLayer } from './baseLayer.js'
import { ensureGitHubOIDCProvider } from '@bifravst/ci'
import { packBackendLambdas } from './packBackendLambdas.js'
import { ACMClient } from '@aws-sdk/client-acm'
import { getCertificateForDomain } from '../aws/acm.js'

const repoUrl = new URL(pJSON.repository.url)
const repository = {
	owner: repoUrl.pathname.split('/')[1] ?? 'hello-nrfcloud',
	repo: repoUrl.pathname.split('/')[2]?.replace(/\.git$/, '') ?? 'backend',
}

const iam = new IAMClient({})
const acm = new ACMClient({})

// Ensure needed container images exist
const { openSSLLambdaContainerTag } = fromEnv({
	openSSLLambdaContainerTag: 'OPENSSL_LAMBDA_CONTAINER_TAG',
})(process.env)

const isTest = process.env.IS_TEST === '1'
const apiDomainName = process.env.API_DOMAIN_NAME

new BackendApp({
	lambdaSources: await packBackendLambdas(),
	layer: await packBaseLayer(),
	repository,
	gitHubOICDProviderArn: await ensureGitHubOIDCProvider({
		iam,
	}),
	isTest,
	openSSLLambdaContainerTag,
	domain: 'hello.nrfcloud.com',
	apiDomain:
		apiDomainName !== undefined
			? await getCertificateForDomain(acm)(apiDomainName)
			: undefined,
	version: (() => {
		const v = process.env.VERSION
		const defaultVersion = `0.0.0-development`
		if (v === undefined)
			console.warn(`VERSION is not defined, using ${defaultVersion}!`)
		return v ?? defaultVersion
	})(),
})
