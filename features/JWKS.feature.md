---
exampleContext:
  API: "https://api.nordicsemi.world/2024-04-15"
---

# Serve JWKS

> Users request device history from the hello.nrfcloud.com backend API, and
> since the hello.nrfcloud.com/map backend "knows" about shared devices, it
> creates a JWT that will be passed with history requests to the
> hello.nrfcloud.com backend which then uses the hello.nrfcloud.com/map backend
> public key to verify the authenticity of the request.

## Serve .well-known/jwks.json

When I `GET` to `${API}/.well-known/jwks.json`

Then I should receive a `https://datatracker.ietf.org/doc/html/rfc7517` response

And `keys[0]` of the last response should match

```json
{
  "alg": "ES512",
  "use": "sig"
}
```
