# `hello.nrfcloud.com/map` backend

[![GitHub Actions](https://github.com/hello-nrfcloud/map-backend/workflows/Test%20and%20Release/badge.svg)](https://github.com/hello-nrfcloud/map-backend/actions/workflows/test-and-release.yaml)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Renovate](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)
[![@commitlint/config-conventional](https://img.shields.io/badge/%40commitlint-config--conventional-brightgreen)](https://github.com/conventional-changelog/commitlint/tree/master/@commitlint/config-conventional)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier/)
[![ESLint: TypeScript](https://img.shields.io/badge/ESLint-TypeScript-blue.svg)](https://github.com/typescript-eslint/typescript-eslint)

Cloud backend for
[`hello.nrfcloud.com/map`](https://github.com/hello-nrfcloud/map) developed
using [AWS CDK](https://aws.amazon.com/cdk) in
[TypeScript](https://www.typescriptlang.org/).

## Installation in your AWS account

### Setup

[Provide your AWS credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-authentication.html).

Install the dependencies:

```bash
npm ci
```

#### nRF Cloud Location Services Service Key

The single-cell geo-location features uses the nRF Cloud
[Ground Fix API](https://api.nrfcloud.com/v1#tag/Ground-Fix) which requires the
service to be enabled in the account's plan. Manage the account at
<https://nrfcloud.com/#/manage-plan>.

Provide your nRF Cloud API key:

```bash
./cli.sh configure-nrfcloud-account apiKey <API key>
```

#### Keypair for signing history request

The history is persisted in the
[`backend`](https://github.com/hello-nrfcloud/backend), and the frontend
requests device history using the same API as the
[web application](https://github.com/hello-nrfcloud/web), however since public
devices don't have a fingerprint, a JWT is created for public devices by the map
backend, which is then used by the backend to authenticate history requests for
devices. The following command installs a JWT keypair, and the public key is
published at <https://api.nordicsemi.world/.well-known/jwks.json>.

```bash
./cli.sh generate-jwt-keypair
```

### Build the docker images

Some of the feature are run from docker containers, ensure they have been built
and published before deploying the solutions.

```bash
export OPENSSL_LAMBDA_CONTAINER_TAG=$(./cli.sh build-container openssl-lambda)

# You can add these outputs to your .env file
echo "export OPENSSL_LAMBDA_CONTAINER_TAG=$OPENSSL_LAMBDA_CONTAINER_TAG" >> .envrc
direnv allow
```

### Deploy

```bash
npx cdk bootstrap # if this is the first time you use CDK in this account
npx cdk deploy
```

## Custom domain name

You can specify a custom domain name for the deployed API using the environment
variable `API_DOMAIN_NAME`.

If you do so, make sure to create a certificate in the region for this domain
name.

Create a role in the account that manages the domain name, to allow the the
production account to update the CNAME for the API domain with these permissions
(make sure to replace `<Hosted Zone ID>`, `<api domain name>`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "route53:ChangeResourceRecordSets",
      "Resource": "arn:aws:route53:::hostedzone/<Hosted Zone ID>",
      "Condition": {
        "ForAllValues:StringEquals": {
          "route53:ChangeResourceRecordSetsNormalizedRecordNames": [
            "<api domain name>"
          ],
          "route53:ChangeResourceRecordSetsRecordTypes": ["CNAME"],
          "route53:ChangeResourceRecordSetsActions": ["UPSERT"]
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": "route53:ListHostedZonesByName",
      "Resource": "*"
    }
  ]
}
```

Then, for continuous deployment:

- create the variable `API_DOMAIN_NAME` with the name of the api domain, e.g.
  `api.nordicsemi.world`
- create the secret `API_DOMAIN_ROUTE_53_ROLE_ARN` with the role ARN of the role
  that allows the production account to update the CNAME for the API domain.

```bash
gh variable set API_DOMAIN_NAME --env production --body api.nordicsemi.world
gh secret set API_DOMAIN_ROUTE_53_ROLE_ARN --env production --body arn:aws:iam::<account ID>:role/<role name>
```

## Continuous Deployment using GitHub Actions

After deploying the stack manually once,

- configure a GitHub Actions environment named `production`
- create the secret `AWS_ROLE` with the value
  `arn:aws:iam::<account ID>:role/<stack name>-cd` and a variable (use the
  `cdRoleArn` stack output)
- create the variable `AWS_REGION` with the value `<region>` (your region)
- create the variable `STACK_NAME` with the value `<stack name>` (your stack
  name)

to enable continuous deployment.
