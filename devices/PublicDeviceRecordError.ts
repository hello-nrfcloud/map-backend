export type PublicDeviceRecordError = {
	error:
		| 'not_found'
		| 'not_confirmed'
		| 'confirmation_expired'
		| 'unsupported_model'
}
