import { packLambdaFromPath } from '@bifravst/aws-cdk-lambda-helpers'
import type { PackedLambda } from '@bifravst/aws-cdk-lambda-helpers'

export type BackendLambdas = {
	shareDevice: PackedLambda
	sharingStatus: PackedLambda
	sharingStatusFingerprint: PackedLambda
	confirmOwnership: PackedLambda
	devicesData: PackedLambda
	createCredentials: PackedLambda
	openSSL: PackedLambda
	apiHealthCheck: PackedLambda
}

const pack = async (id: string) => packLambdaFromPath(id, `lambda/${id}.ts`)

export const packBackendLambdas = async (): Promise<BackendLambdas> => ({
	shareDevice: await pack('shareDevice'),
	sharingStatus: await pack('sharingStatus'),
	sharingStatusFingerprint: await pack('sharingStatusFingerprint'),
	confirmOwnership: await pack('confirmOwnership'),
	devicesData: await pack('devicesData'),
	createCredentials: await pack('createCredentials'),
	openSSL: await pack('openSSL'),
	apiHealthCheck: await pack('apiHealthCheck'),
})
