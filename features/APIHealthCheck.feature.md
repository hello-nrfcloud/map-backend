---
exampleContext:
  API: "https://api.nordicsemi.world/2024-04-15"
---

# API health check

## The API should have a health-check

> This can be used to determine the deployed version.

When I `GET` `${API}/health`

Then I should receive a `https://github.com/hello-nrfcloud/proto-map/api/health`
response

And the last response should match

```json
{
  "version": "0.0.0-development"
}
```
