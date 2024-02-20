# Index.js

1. Function lambda that recieves a Stripe WebHook: checkout.session.completed
2. Extracts info from the WebHook  and creates an Item in the database with user details
3. And also sends an email to the user and the company if the transacion was successuf
4. If there was any problem , it will send an email to the company informing about the error

## Usage in local

Create a template.yaml

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Resources:
  MyLambdaFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: index.handler
      Runtime: nodejs20.x
      Timeout: 30
      CodeUri: .
      Environment:
        Variables:
          STRIPE_SECRET_KEY: sk_test_...
          STRIPE_ENDPOINT_SECRET: whsec_...
          SENDGRID_API_KEY: SG...
          COMPANY_EMAIL: company@gmail.com
          TABLE_NAME: users
```

And run the following commands:

### `aws configure`
### `sam build`
### `sam local invoke MyLambdaFunction -e event.json`

## Deploy in AWS Lambda Console

Compress the file with the following command:

### `zip -r stripeLambda.zip . -x "routes/*"`

And upload the .zip file to Lambda

# validateAndStoreEmail && sendEmailContactForm

Copy the code of this functions into a different Lambas.
The files should be called .mjs
