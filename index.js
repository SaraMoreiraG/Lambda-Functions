// Import AWS SDK, Stripe and SendGrid modules
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const Stripe = require("stripe");
const sgMail = require("@sendgrid/mail");

// Initialize Stripe with the secret key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize SendGrid with API key from environment variables
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Initialize DynamoDB clients for the specified AWS region
const dynamoDbClient = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

// Retrieve Stripe endpoint secret, table name, and company email from environment variables
const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET;
const tableName = process.env.TABLE_NAME || "users";
const companyEmail = process.env.COMPANY_EMAIL;

exports.handler = async (event) => {
  let stripeEvent;

  try {
    // Verify Stripe signature to construct the event
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      event.headers["Stripe-Signature"],
      endpointSecret
    );

    console.log("Processed Stripe event:", stripeEvent.type);

    // Handle specific Stripe event types
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

      console.log("User data to save:", userData);

      // Save user data to DynamoDB
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

    // Send an email to yourself with error details
    await sendEmail({
      to: companyEmail,
      templateId: "d-58b12e8a1b6e47419f6b282c63360b6b",
      dynamicData: {
        errorDate: dateString,
        errorMessage: err.message,
      },
    });

    return {
      statusCode: err.statusCode || 400,
      body: `Webhook Error: ${err.message}`,
    };
  }
};

// Function to save user data to DynamoDB
async function saveUserData(userData) {
  const command = new PutCommand({
    TableName: tableName,
    Item: userData,
  });

  try {
    await docClient.send(command);
    console.log("User data saved successfully.");

    // Send an email to User
    await sendEmail({
      to: userData.email,
      templateId: "d-d5482eab7c304461af455d8456e8521d",
      dynamicData: {
        userName: userData.nombreDelAlumno,
        userEmail: userData.email,
      },
    });

    // Send an email to yourself
    await sendEmail({
      to: companyEmail,
      templateId: "d-03d6e5f6f39f443ea1e4c51766896f05",
      dynamicData: {
        userName: userData.nombreDelAlumno,
        userEmail: userData.email,
      },
    });
  } catch (error) {
    console.error("Error saving user data in DynamoDB:", error);

    // Send an email to yourself
    await sendEmail({
      to: companyEmail,
      templateId: "d-d9e9e50b811e4970a74f91c446058f85",
      dynamicData: {
        userName: userData.nombreDelAlumno,
        userEmail: userData.email,
      },
    });

    throw new Error("Error saving user data.");
  }
}

// Function to send email with Send Grip
async function sendEmail({ to, templateId, dynamicData }) {
  const msg = {
    to: to,
    from: companyEmail,
    templateId: templateId,
    dynamic_template_data: dynamicData,
  };

  try {
    console.log("Attempting to send email", msg);
    await sgMail.send(msg);
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}
