import type { PackedLambda } from './helpers/lambdas/packLambda'

type BackendLambdas = {
	updatesToLwM2M: PackedLambda
	shareDevice: PackedLambda
	sharingStatus: PackedLambda
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
