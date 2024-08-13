---
exampleContext:
  API: https://api.nordicsemi.world/2024-04-15
  jwt: eyJhbGciOiJFUzUxMiIsInR5cCI6IkpXVCIsImtpZCI6Ijg1NDdiNWIyLTdiNDctNDFlNC1iZjJkLTdjZGZmNDhiM2VhNCJ9.eyJAY29udGV4dCI6Imh0dHBzOi8vZ2l0aHViLmNvbS9oZWxsby1ucmZjbG91ZC9wcm90by1tYXAvdXNlci1qd3QiLCJlbWFpbCI6ImVkYjJiZDM3QGV4YW1wbGUuY29tIiwiaWF0IjoxNzIyODcxNTYyLCJleHAiOjE3MjI5NTc5NjIsImF1ZCI6ImhlbGxvLm5yZmNsb3VkLmNvbSJ9.ALiHjxR7HIjuYQBvPVh5-GMs-2f-pMGs_FTz-x0HGzQ4amLASeUGEZ7X_y-_mgZpYu8VKGm6be0LtIIx9DgYBff1ASfmQH327rub0a2-DjXW-JUJQn_6t6H6_JhvPZ9jWBSzy3Tbpp9NmTUNmHgEwzyoctnmgp0oo26VEwc4r6YGQWkZ
  publicDeviceId: outfling-swanherd-attaghan
  oldExpiry: "2024-08-13T08:56:51.280Z"
needs:
  - Add Device
---

# Extend sharing

> Users can extend the time until their device is visible on the map for 30
> days.

## List devices

Given the `Authorization` header of the next request is `Bearer ${jwt}`

When I `GET` `${API}/user/devices`

Then I store `$.devices[0].id` of the last response as `publicDeviceId`

And I store `$.devices[0].expires` of the last response as `oldExpiry`

## Extend sharing

Given the `Authorization` header of the next request is `Bearer ${jwt}`

When I `PUT` to `${API}/user/device/${publicDeviceId}/sharing`

Then the status code of the last response should be `200`

## List devices again

> The expires timestamp should have been updated

Given the `Authorization` header of the next request is `Bearer ${jwt}`

When I `GET` `${API}/user/device/${publicDeviceId}`

Then `{"gt": expires > "${oldExpiry}"}` of the last response should match

```json
{ "gt": true }
```
