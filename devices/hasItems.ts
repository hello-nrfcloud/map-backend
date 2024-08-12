import type { AttributeValue } from '@aws-sdk/client-dynamodb'

export const hasItems = (
	res: unknown,
): res is { Items: Record<string, AttributeValue>[] } =>
	res !== null && typeof res === 'object' && 'Items' in res
