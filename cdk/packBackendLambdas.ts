import { packLambdaFromPath } from '@bifravst/aws-cdk-lambda-helpers'
import type { PackedLambda } from '@bifravst/aws-cdk-lambda-helpers'

export type BackendLambdas = {
	shareDevice: PackedLambda
	sharingStatus: PackedLambda
	sharingStatusFingerprint: PackedLambda
	confirmOwnership: PackedLambda
	devicesData: PackedLambda
	createDevice: PackedLambda
	openSSL: PackedLambda
	apiHealthCheck: PackedLambda
	createCNAMERecord: PackedLambda
	jwks: PackedLambda
	deviceJwt: PackedLambda
	requestToken: PackedLambda
	userJwt: PackedLambda
}

const pack = async (id: string) => packLambdaFromPath(id, `lambda/${id}.ts`)

export const packBackendLambdas = async (): Promise<BackendLambdas> => ({
	shareDevice: await pack('shareDevice'),
	sharingStatus: await pack('sharingStatus'),
	sharingStatusFingerprint: await pack('sharingStatusFingerprint'),
	confirmOwnership: await pack('confirmOwnership'),
	devicesData: await pack('devicesData'),
	createDevice: await pack('createDevice'),
	openSSL: await pack('openSSL'),
	apiHealthCheck: await pack('apiHealthCheck'),
	createCNAMERecord: await packLambdaFromPath(
		'createCNAMERecord',
		'cdk/resources/api/createCNAMERecord.ts',
	),
	jwks: await pack('jwks'),
	deviceJwt: await pack('deviceJwt'),
	requestToken: await pack('requestToken'),
	userJwt: await pack('userJwt'),
})
