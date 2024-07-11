import type { App } from 'aws-cdk-lib'
import {
	CfnOutput,
	aws_lambda as Lambda,
	Stack,
	aws_ecr as ECR,
} from 'aws-cdk-lib'
import type { BackendLambdas } from './packBackendLambdas.js'
import type { PackedLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'
import { LambdaSource } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import { PublicDevices } from './resources/PublicDevices.js'
import { ShareAPI } from './resources/ShareAPI.js'
import { STACK_NAME } from './stackConfig.js'
import { DevicesAPI } from './resources/DevicesAPI.js'
import { CredentialsAPI } from './resources/CredentialsAPI.js'
import { ContainerRepositoryId } from '../aws/ecr.js'
import { repositoryName } from '@bifravst/aws-cdk-ecr-helpers/repository'
import { ContinuousDeployment } from '@bifravst/ci'
import { API } from './resources/api/API.js'
import type { DomainCert } from '../aws/acm.js'
import { ApiHealthCheck } from './resources/api/HealthCheck.js'
import { CustomDomain } from './resources/api/CustomDomain.js'

/**
 * Provides resources for the backend serving data to hello.nrfcloud.com/map
 */
export class BackendStack extends Stack {
	constructor(
		parent: App,
		{
			domain,
			apiDomain,
			layer,
			lambdaSources,
			openSSLLambdaContainerTag,
			repository,
			gitHubOICDProviderArn,
		}: {
			domain: string
			apiDomain?: DomainCert
			layer: PackedLayer
			lambdaSources: BackendLambdas
			openSSLLambdaContainerTag: string
			repository: {
				owner: string
				repo: string
			}
			gitHubOICDProviderArn: string
		},
	) {
		super(parent, STACK_NAME)

		const baseLayer = new Lambda.LayerVersion(this, 'baseLayer', {
			layerVersionName: `${Stack.of(this).stackName}-baseLayer`,
			code: new LambdaSource(this, {
				id: 'baseLayer',
				zipFile: layer.layerZipFile,
				hash: layer.hash,
			}).code,
			compatibleArchitectures: [Lambda.Architecture.ARM_64],
			compatibleRuntimes: [Lambda.Runtime.NODEJS_20_X],
		})

		const publicDevices = new PublicDevices(this)
		new CfnOutput(this, 'publicDevicesTableName', {
			exportName: `${this.stackName}:publicDevicesTableName`,
			description: 'name of the public devices table',
			value: publicDevices.publicDevicesTable.tableName,
		})
		new CfnOutput(this, 'publicDevicesTableIdIndexName', {
			exportName: `${this.stackName}:publicDevicesTableIdIndexName`,
			description: 'name of the public devices table id index',
			value: publicDevices.idIndex,
		})

		const api = new API(this)
		api.addRoute(
			'GET /health',
			new ApiHealthCheck(this, { baseLayer, lambdaSources }).fn,
		)

		if (apiDomain === undefined) {
			new CfnOutput(this, 'APIURL', {
				exportName: `${this.stackName}:APIURL`,
				description: 'API endpoint',
				value: api.URL,
			})
		} else {
			const domain = new CustomDomain(this, {
				api,
				apiDomain,
			})
			new CfnOutput(this, 'gatewayDomainName', {
				exportName: `${this.stackName}:gatewayDomainName`,
				description:
					'The domain name associated with the regional endpoint for the custom domain name. Use this as the target for the CNAME record for your custom domain name.',
				value: domain.gatewayDomainName.toString(),
			})
			new CfnOutput(this, 'APIURL', {
				exportName: `${this.stackName}:APIURL`,
				description: 'API endpoint',
				value: domain.URL,
			})
		}

		const shareAPI = new ShareAPI(this, {
			domain,
			baseLayer,
			lambdaSources,
			publicDevices,
		})
		api.addRoute('POST /share', shareAPI.shareFn)
		api.addRoute('POST /share/confirm', shareAPI.confirmOwnershipFn)
		api.addRoute('GET /share/status', shareAPI.sharingStatusFingerprintFn)
		api.addRoute('GET /device/{id}', shareAPI.sharingStatusFn)

		const devicesAPI = new DevicesAPI(this, {
			baseLayer,
			lambdaSources,
			publicDevices,
		})
		api.addRoute('GET /devices', devicesAPI.devicesFn)

		const credentialsAPI = new CredentialsAPI(this, {
			baseLayer,
			lambdaSources,
			openSSLContainerImage: {
				repo: ECR.Repository.fromRepositoryName(
					this,
					'openssl-lambda-ecr',
					repositoryName({
						stackName: Stack.of(this).stackName,
						id: ContainerRepositoryId.OpenSSLLambda,
					}),
				),
				tag: openSSLLambdaContainerTag,
			},
			publicDevices,
		})

		api.addRoute('POST /credentials', credentialsAPI.createCredentials)

		// CD

		const cd = new ContinuousDeployment(this, {
			repository,
			gitHubOICDProviderArn,
		})
		new CfnOutput(this, 'cdRoleArn', {
			exportName: `${this.stackName}:cdRoleArn`,
			description: 'Role ARN to use in the deploy GitHub Actions Workflow',
			value: cd.role.roleArn,
		})
	}
}

export type StackOutputs = {
	/**
	 * The URL of the deployed API
	 * @example https://api.nordicsemi.world/2024-04-15/
	 * @example https://9gsm5gind2.execute-api.eu-west-1.amazonaws.com/2024-04-15
	 */
	APIURL: string
	/**
	 * The domain name associated with the regional endpoint for the custom domain name. Use this as the target for the CNAME record for your custom domain name.
	 *
	 * Only present if custom domain is used
	 *
	 * @example d-nygno3o155.execute-api.eu-west-1.amazonaws.com
	 */
	gatewayDomainName?: string
	publicDevicesTableName: string
	publicDevicesTableIdIndexName: string
	/**
	 * Role ARN to use in the deploy GitHub Actions Workflow
	 */
	cdRoleArn: string
}
