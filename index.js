// Importing necessary AWS SDK and Stripe modules
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const Stripe = require("stripe");

// Initialize Stripe with the secret key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
// Initialize SES client for the specific AWS region
const sesClient = new SESClient({ region: "us-east-1" });

// Initialize DynamoDB clients
const dynamoDbClient = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

// Retrieve endpoint secret and table name from environment variables
const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET;
const tableName = process.env.TABLE_NAME || "users";
const companyEmail = process.env.COMPANY_EMAIL;

exports.handler = async (event) => {
  console.log("Received event:", event); // Debugging: log the received event
  const sig = event.headers["Stripe-Signature"];

  try {
    // Assume the body is already in the correct format
    const stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      endpointSecret
    );
    console.log("Processed Stripe event:", stripeEvent.type); // Debugging: log the processed Stripe event

    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;

      // Process custom fields
      const customFields = session.custom_fields
        ? session.custom_fields.reduce((acc, field) => {
            acc[field.key] = field[field.type].value;
            return acc;
          }, {})
        : {};

      // Extract user data
      const userData = {
        email: session.customer_details.email,
        telefono: customFields.telfono,
        ciudad: customFields.ciudad,
        nombreDelAlumno: customFields.nombredelalumno,
      };

      console.log("User data to save:", userData); // Debugging: log user data

      // Save to DynamoDB
      await saveUserData(userData);
    }

    return { statusCode: 200, body: "Event received correctly." };
  } catch (err) {
    console.error(`Error processing webhook event: ${err.message}`);

    const now = new Date();
    const dateString = now.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    // Send an email to yourself
    await sendEmail({
      to: companyEmail, // Use the company email from environment variables
      subject: "Error Stripe WebHook",
      body: `Check CloudWatch log group: /aws/lambda/addUsersSendEmail for what happened on: ${dateString}.\nThe error says: ${err.message}`,
    });

    return {
      statusCode: err.statusCode || 400,
      body: `Webhook Error: ${err.message}`,
    };
  }
};

async function saveUserData(userData) {
  // Create a PutCommand instance with necessary parameters
  const command = new PutCommand({
    TableName: tableName,
    Item: userData,
  });

  try {
    await docClient.send(command);
    console.log("User data saved successfully.");

    // Send an email to the user
    await sendEmail({
      to: userData.email,
      subject:
        "Enhorabuena, te has inscrito en el curso de IA Aplicada a las Artes Ecénicas",
      body: `¡Hola ${userData.nombreDelAlumno}! Te has inscrito con éxito.`,
    });

    // Send an email to yourself
    await sendEmail({
      to: companyEmail, // Use the company email from environment variables
      subject: "Tenemos un nuevo alumno",
      body: `Nombre del alumno: ${userData.nombreDelAlumno} con el email: ${userData.email}`,
    });
  } catch (error) {
    console.error("Error saving user data in DynamoDB:", error);

    // Send an email to yourself
    await sendEmail({
      to: companyEmail, // Use the company email from environment variables
      subject: "Error Nuevo Alumno",
      body: `El alumno: ${userData.nombreDelAlumno} \ncon el email: ${userData.email}, \nteléfono: ${userData.telefono} \ny que vive en: ${userData.ciudad}. \n Ha realizado el pago en Stripe pero sus datos no se han guardado en la base de datos.`,
    });

    throw new Error("Error saving user data.");
  }
}

async function sendEmail({ to, subject, body }) {
  const params = {
    Destination: { ToAddresses: [to] },
    Message: {
      Body: { Text: { Data: body } },
      Subject: { Data: subject },
    },
    Source: companyEmail,
  };

  // Create the command with the email parameters
  const command = new SendEmailCommand(params);

  try {
    // Send the email using the SES client
    const result = await sesClient.send(command);
    console.log("Email sent successfully", result);
  } catch (error) {
    console.log("Failed to send email:", error);
  }
}
