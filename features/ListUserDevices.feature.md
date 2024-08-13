---
exampleContext:
  API: https://api.nordicsemi.world/2024-04-15
  jwt: eyJhbGciOiJFUzUxMiIsInR5cCI6IkpXVCIsImtpZCI6Ijg1NDdiNWIyLTdiNDctNDFlNC1iZjJkLTdjZGZmNDhiM2VhNCJ9.eyJAY29udGV4dCI6Imh0dHBzOi8vZ2l0aHViLmNvbS9oZWxsby1ucmZjbG91ZC9wcm90by1tYXAvdXNlci1qd3QiLCJlbWFpbCI6ImVkYjJiZDM3QGV4YW1wbGUuY29tIiwiaWF0IjoxNzIyODcxNTYyLCJleHAiOjE3MjI5NTc5NjIsImF1ZCI6ImhlbGxvLm5yZmNsb3VkLmNvbSJ9.ALiHjxR7HIjuYQBvPVh5-GMs-2f-pMGs_FTz-x0HGzQ4amLASeUGEZ7X_y-_mgZpYu8VKGm6be0LtIIx9DgYBff1ASfmQH327rub0a2-DjXW-JUJQn_6t6H6_JhvPZ9jWBSzy3Tbpp9NmTUNmHgEwzyoctnmgp0oo26VEwc4r6YGQWkZ
needs:
  - Add Device
---

# List devices

> Users can list their devices.

## List devices

Given the `Authorization` header of the next request is `Bearer ${jwt}`

When I `GET` `${API}/user/devices`

Then the status code of the last response should be `200`

And I should receive a
`https://github.com/hello-nrfcloud/proto-map/user-devices` response

And `{"len": $count($.devices)}` of the last response should match

```json
{ "len": 1 }
```

And `$.devices[0]` of the last response should match

```json
{
  "model": "thingy91x"
}
```
