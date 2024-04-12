import {
	App,
	CfnOutput,
	aws_lambda as Lambda,
	Stack,
	aws_ecr as ECR,
} from 'aws-cdk-lib'
import type { BackendLambdas } from '../BackendLambdas.js'
import type { PackedLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'
import { LambdaSource } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import { ConnectionInformationGeoLocation } from '../resources/ConnectionInformationGeoLocation.js'
import { LwM2MShadow } from '../resources/LwM2MShadow.js'
import { PublicDevices } from '../resources/PublicDevices.js'
import { ShareAPI } from '../resources/ShareAPI.js'
import { STACK_NAME } from './stackConfig.js'
import { DevicesAPI } from '../resources/DevicesAPI.js'
import { LwM2MObjectsHistory } from '../resources/LwM2MObjectsHistory.js'
import { CustomDevicesAPI } from '../resources/CustomDevicesAPI.js'
import { SenMLMessages } from '../resources/SenMLMessage.js'
import { ContainerRepositoryId } from '../../aws/ecr.js'
import { repositoryName } from '@bifravst/aws-cdk-ecr-helpers/repository'
import { ContinuousDeployment } from '@bifravst/ci'
import { API } from '../resources/api/API.js'

/**
 * Provides resources for the backend serving data to hello.nrfcloud.com/map
 */
export class BackendStack extends Stack {
	constructor(
		parent: App,
		{
			layer,
			lambdaSources,
			openSSLLambdaContainerTag,
			repository,
			gitHubOICDProviderArn,
		}: {
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

		new LwM2MShadow(this, {
			baseLayer,
			lambdaSources,
			publicDevices,
		})

		new SenMLMessages(this, {
			baseLayer,
			lambdaSources,
			publicDevices,
		})

		new ConnectionInformationGeoLocation(this, {
			baseLayer,
			lambdaSources,
		})

		const api = new API(this)

		const shareAPI = new ShareAPI(this, {
			baseLayer,
			lambdaSources,
			publicDevices,
		})
		api.addRoute('POST /share', shareAPI.shareFn)
		api.addRoute('POST /share/confirm', shareAPI.confirmOwnershipFn)
		api.addRoute('GET /device/{id}', shareAPI.sharingStatusFn)

		const devicesAPI = new DevicesAPI(this, {
			baseLayer,
			lambdaSources,
			publicDevices,
		})
		api.addRoute('GET /devices', devicesAPI.devicesFn)

		const lwm2mObjectHistory = new LwM2MObjectsHistory(this, {
			baseLayer,
			lambdaSources,
		})
		api.addRoute('GET /history', lwm2mObjectHistory.historyFn)

		const customDevicesAPI = new CustomDevicesAPI(this, {
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

		api.addRoute('PUT /credentials', customDevicesAPI.createCredentials)

		const cd = new ContinuousDeployment(this, {
			repository,
			gitHubOICDProviderArn,
		})

		// Outputs
		new CfnOutput(this, 'APIURL', {
			exportName: `${this.stackName}:APIURL`,
			description: 'API endpoint',
			value: api.URL,
		})
		new CfnOutput(this, 'publicDevicesTableName', {
			exportName: `${this.stackName}:publicDevicesTableName`,
			description: 'name of the public devices table',
			value: publicDevices.publicDevicesTable.tableName,
		})
		new CfnOutput(this, 'cdRoleArn', {
			exportName: `${this.stackName}:cdRoleArn`,
			description: 'Role ARN to use in the deploy GitHub Actions Workflow',
			value: cd.role.roleArn,
		})
	}
}

export type StackOutputs = {
	APIURL: string // e.g. 'https://iiet67bnlmbtuhiblik4wcy4ni0oujot.execute-api.eu-west-1.amazonaws.com/2024-04-12/'
	publicDevicesTableName: string
	/**
	 * Role ARN to use in the deploy GitHub Actions Workflow
	 */
	cdRoleArn: string
}
