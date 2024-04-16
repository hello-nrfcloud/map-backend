import { validateWithTypeBox } from '@hello.nrfcloud.com/proto'
import { ProblemDetail } from '@hello.nrfcloud.com/proto/hello'
import { type Static, type TSchema } from '@sinclair/typebox'

export const typedFetch = <Body, ResponseBodySchemaType extends TSchema>({
	url,
	RequestBodySchema,
	ResponseBodySchema,
	fetchImplementation,
	...init
}: {
	url: URL
	RequestBodySchema: TSchema
	ResponseBodySchema: ResponseBodySchemaType
	fetchImplementation?: typeof fetch
} & RequestInit) => {
	const validateRequestBody = validateWithTypeBox(RequestBodySchema)
	const validateResponseBody = validateWithTypeBox(ResponseBodySchema)

	return async (
		requestBody?: Body,
	): Promise<
		| {
				error: Omit<Static<typeof ProblemDetail>, '@context'>
		  }
		| { result: Static<ResponseBodySchemaType> }
	> => {
		if (requestBody !== undefined) {
			const maybeValidRequestBody = validateRequestBody(requestBody)
			if ('errors' in maybeValidRequestBody) {
				return {
					error: {
						title: 'Request body validation failed',
						detail: JSON.stringify({
							body: requestBody,
							errors: maybeValidRequestBody.errors,
						}),
					},
				}
			}
		}
		const res = await (fetchImplementation ?? fetch)(url, init)
		const hasContent =
			parseInt(res.headers.get('content-length') ?? '0', 10) > 0
		if (!res.ok) {
			return {
				error: {
					title: `Request failed (${res.status})`,
					detail: hasContent ? await res.text() : undefined,
				},
			}
		}
		let responseBody = undefined
		if (hasContent) {
			responseBody = await res.text()
			const isJSON =
				res.headers.get('content-type')?.includes('application/json') ?? false
			if (isJSON) {
				try {
					responseBody = JSON.parse(responseBody)
				} catch {
					return {
						error: {
							title: `Failed to parse response as JSON!`,
							detail: responseBody,
						},
					}
				}
			}
		}
		const maybeValidResponseBody = validateResponseBody(responseBody)
		if ('errors' in maybeValidResponseBody) {
			return {
				error: {
					title: 'Response body validation failed',
					detail: JSON.stringify({
						body: responseBody,
						errors: maybeValidResponseBody.errors,
					}),
				},
			}
		}
		return {
			result: responseBody,
		}
	}
}
