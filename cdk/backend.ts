import { IAMClient } from '@aws-sdk/client-iam'
import { fromEnv } from '@nordicsemiconductor/from-env'
import pJSON from '../package.json'
import { BackendApp } from './BackendApp.js'
import { pack as packBaseLayer } from './baseLayer.js'
import { ensureGitHubOIDCProvider } from '@bifravst/ci'
import { packBackendLambdas } from './packBackendLambdas.js'
import { ACMClient } from '@aws-sdk/client-acm'
import { getCertificateArnForDomain } from '../aws/acm.js'
import { pack as packCDKLayer } from './cdkLayer.js'

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
const apiDomainRoute53RoleArn = process.env.API_DOMAIN_ROUTE_53_ROLE_ARN

new BackendApp({
	lambdaSources: await packBackendLambdas(),
	layer: await packBaseLayer(),
	cdkLayer: await packCDKLayer(),
	repository,
	gitHubOICDProviderArn: await ensureGitHubOIDCProvider({
		iam,
	}),
	isTest,
	openSSLLambdaContainerTag,
	domain: 'hello.nrfcloud.com',
	apiDomain:
		apiDomainName !== undefined && apiDomainRoute53RoleArn !== undefined
			? {
					domainName: apiDomainName,
					certificateArn:
						(await getCertificateArnForDomain(acm)(apiDomainName))
							.certificateArn ?? '',
					roleArn: apiDomainRoute53RoleArn,
				}
			: undefined,
	version: (() => {
		const v = process.env.VERSION
		const defaultVersion = `0.0.0-development`
		if (v === undefined)
			console.warn(`VERSION is not defined, using ${defaultVersion}!`)
		return v ?? defaultVersion
	})(),
})
