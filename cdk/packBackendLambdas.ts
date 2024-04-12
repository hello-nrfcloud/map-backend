import type { BackendLambdas } from './BackendLambdas.js'
import { packLambdaFromPath } from '@bifravst/aws-cdk-lambda-helpers'

const pack = async (id: string) => packLambdaFromPath(id, `lambda/${id}.ts`)

export const packBackendLambdas = async (): Promise<BackendLambdas> => ({
	updatesToLwM2M: await pack('updatesToLwM2M'),
	shareDevice: await pack('shareDevice'),
	sharingStatus: await pack('sharingStatus'),
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
})
