---
exampleContext:
  deviceId: f1394b9a-a7c7-4a4a-ade2-bf2012f92e1f
  publicDeviceId: discloak-classify-nodosity
  ts: 1694503339523
  API: "https://api.nordicsemi.world/2024-04-15"
---

# Devices can publish data using SenML via MQTT

## Background

Given I have the device id for a shared `kartverket-vasstandsdata` device in
`deviceId` and the public device id in `publicDeviceId`

## Publish SenML via MQTT

Given I store `$millis()` into `ts`

And I store `$fromMillis(${ts})` into `tsISO`

And the device `${deviceId}` publishes this message to the topic
`m/senml/${deviceId}`

```json
[
  {
    "bn": "14201/0/",
    "bt": "$number{ts}",
    "n": "0",
    "v": 70.374978
  },
  {
    "n": "1",
    "v": 31.104015
  },
  {
    "n": "3",
    "v": 1
  },
  {
    "n": "6",
    "vs": "Fixed"
  },
  {
    "bn": "14230/0/",
    "bt": "$number{ts}",
    "n": "0",
    "v": 294.3
  },
  {
    "n": "1",
    "vs": "VAW"
  }
]
```

## Fetch the published data

When I `GET` `${API}/devices?ids=${publicDeviceId}`

Then I should receive a `https://github.com/hello-nrfcloud/proto-map/devices`
response

And `$.devices[id="${publicDeviceId}"]` of the last response should match

```json
{
  "@context": "https://github.com/hello-nrfcloud/proto-map/device",
  "id": "${publicDeviceId}",
  "model": "kartverket-vasstandsdata"
}
```

And `$.devices[id="${publicDeviceId}"].state[ObjectID=14230]` of the last
response should match

```json
{
  "ObjectID": 14230,
  "ObjectVersion": "1.0",
  "Resources": {
    "0": 294.3,
    "1": "VAW",
    "99": "${tsISO}"
  }
}
```

And `$.devices[id="${publicDeviceId}"].state[ObjectID=14201]` of the last
response should match

```json
{
  "ObjectID": 14201,
  "ObjectVersion": "1.0",
  "Resources": {
    "0": 70.374978,
    "1": 31.104015,
    "3": 1,
    "6": "Fixed",
    "99": "${tsISO}"
  }
}
```

## Fetch the import logs

> The import logs can be used to debug issues with the sent data

When I `GET` `${API}/device/${publicDeviceId}/senml-imports`

Then I should receive a
`https://github.com/hello-nrfcloud/proto-map/senml-imports` response

And `$` of the last response should match

```json
{
  "id": "${publicDeviceId}",
  "model": "kartverket-vasstandsdata"
}
```

And `$.imports[0]` of the last response should match

```json
{
  "success": true,
  "senML": [
    { "bn": "14201/0/", "bt": "$number{ts}", "n": "0", "v": 70.374978 },
    { "n": "1", "v": 31.104015 },
    { "n": "3", "v": 1 },
    { "n": "6", "vs": "Fixed" },
    { "bn": "14230/0/", "bt": "$number{ts}", "n": "0", "v": 294.3 },
    { "n": "1", "vs": "VAW" }
  ],
  "lwm2m": [
    {
      "ObjectID": 14201,
      "Resources": {
        "0": 70.374978,
        "1": 31.104015,
        "3": 1,
        "6": "Fixed",
        "99": "${tsISO}"
      }
    },
    {
      "ObjectID": 14230,
      "Resources": {
        "0": 294.3,
        "1": "VAW",
        "99": "${tsISO}"
      }
    }
  ]
}
```
