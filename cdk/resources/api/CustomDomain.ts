import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import {
	CustomResource,
	aws_apigatewayv2 as HttpApi,
	aws_iam as IAM,
	ResolutionTypeHint,
	type aws_lambda as Lambda,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../../packBackendLambdas.js'
import type { API } from './API.js'

export type CustomDomainDetails = {
	domainName: string
	certificateArn: string
	// This is the ARN of the role to assume to update the CNAME record
	roleArn: string
}

export class CustomDomain extends Construct {
	public readonly URL: string

	constructor(
		parent: Construct,
		{
			api,
			apiDomain,
			lambdaSources,
			cdkLayerVersion,
		}: {
			api: API
			apiDomain: CustomDomainDetails
			lambdaSources: Pick<BackendLambdas, 'createCNAMERecord'>
			cdkLayerVersion: Lambda.ILayerVersion
		},
	) {
		super(parent, 'apiDomain')

		const domain = new HttpApi.CfnDomainName(this, 'apiDomain', {
			domainName: apiDomain.domainName,
			domainNameConfigurations: [
				{
					certificateArn: apiDomain.certificateArn,
				},
			],
		})
		new HttpApi.CfnApiMapping(this, 'apiDomainMapping', {
			apiId: api.api.ref,
			domainName: apiDomain.domainName,
			stage: api.stage.ref,
			apiMappingKey: api.stage.stageName, // so the api is accessed via the same resource, e.g. https://api.nordicsemi.world/2024-04-15/
		}).node.addDependency(domain)

		this.URL = `https://${apiDomain.domainName}/${api.stage.stageName}/`

		const createCNAMERecordFn = new PackedLambdaFn(
			this,
			'createCNAMERecordFn',
			lambdaSources.createCNAMERecord,
			{
				layers: [cdkLayerVersion],
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: ['sts:AssumeRole'],
						resources: [apiDomain.roleArn],
					}),
				],
			},
		)

		new CustomResource(this, 'apiDomainCNAMERecord', {
			serviceToken: createCNAMERecordFn.fn.functionArn,
			// ServiceTimeout is not yet available: https://github.com/aws/aws-cdk/issues/30517
			properties: {
				roleArn: apiDomain.roleArn,
				domainName: apiDomain.domainName,
				cnameValue: domain.getAtt(
					'RegionalDomainName',
					ResolutionTypeHint.STRING,
				),
			},
		})
	}
}
