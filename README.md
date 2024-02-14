# Index.js

1. Function lambda that recieves a Stripe WebHook: checkout.session.completed
2. Extracts info from the WebHook  and creates an Item in the database with user details
3. And also sends an email to the user and the company if the transacion was successuf
4. If there was any problem , it will send an email to the company informing about the error

## Usage

Run the following command:

### `run zip -r stripeLambda.zip . -x "routes/*"`

And upload the .zip file to Lambda

# validateAndStoreEmail && sendEmailContactForm

Copy the code of this functions into a different Lambas.
The files should be called .mjs
