import { packLambdaFromPath } from '@bifravst/aws-cdk-lambda-helpers'
import type { PackedLambda } from '@bifravst/aws-cdk-lambda-helpers'

export type BackendLambdas = {
	updatesToLwM2M: PackedLambda
	shareDevice: PackedLambda
	sharingStatus: PackedLambda
	sharingStatusFingerprint: PackedLambda
	confirmOwnership: PackedLambda
	connectionInformationGeoLocation: PackedLambda
	devicesData: PackedLambda
	storeObjectsInTimestream: PackedLambda
	queryHistory: PackedLambda
	createCredentials: PackedLambda
	openSSL: PackedLambda
	senMLToLwM2M: PackedLambda
	senMLImportLogs: PackedLambda
	apiHealthCheck: PackedLambda
}

const pack = async (id: string) => packLambdaFromPath(id, `lambda/${id}.ts`)

export const packBackendLambdas = async (): Promise<BackendLambdas> => ({
	updatesToLwM2M: await pack('updatesToLwM2M'),
	shareDevice: await pack('shareDevice'),
	sharingStatus: await pack('sharingStatus'),
	sharingStatusFingerprint: await pack('sharingStatusFingerprint'),
	confirmOwnership: await pack('confirmOwnership'),
	connectionInformationGeoLocation: await pack(
		'connectionInformationGeoLocation',
	),
	devicesData: await pack('devicesData'),
	storeObjectsInTimestream: await pack('storeObjectsInTimestream'),
	queryHistory: await pack('queryHistory'),
	createCredentials: await pack('createCredentials'),
	openSSL: await pack('openSSL'),
	senMLToLwM2M: await pack('senMLToLwM2M'),
	senMLImportLogs: await pack('senMLImportLogs'),
	apiHealthCheck: await pack('apiHealthCheck'),
})