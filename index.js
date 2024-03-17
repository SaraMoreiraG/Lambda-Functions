// Import AWS SDK, Stripe and SendGrid modules
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
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
      // const customFields = session.custom_fields
      //   ? session.custom_fields.reduce((acc, field) => {
      //       acc[field.key] = field[field.type].value;
      //       return acc;
      //     }, {})
      //   : {};

      // Extract metadata from the session, which contains course details
      const courseData = {
        courseId: session.metadata.courseId,
        courseTitle: session.metadata.courseTitle,
        courseImage: session.metadata.courseImage
      };

      // Extract user data and include courseData
      const userData = {
        email: session.customer_details.email,
        telefono: session.customer_details.phone,
        direccion: [session.customer_details.address],
        nombreDelAlumno: session.customer_details.name,
        coursesID: [courseData],
        admin: false
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

// Function to save or update user data in DynamoDB
async function saveUserData(userData) {
  try {
    // Check if the user already exists in the database
    const getUserCommand = new GetCommand({
      TableName: tableName,
      Key: { email: userData.email },
    });

    const { Item } = await docClient.send(getUserCommand);

    if (Item) {
      // If the user exists, update their record with the new course information
      const updateCommand = new UpdateCommand({
        TableName: tableName,
        Key: { email: userData.email },
        UpdateExpression: "SET coursesID = list_append(if_not_exists(coursesID, :empty_list), :course)",
        ExpressionAttributeValues: {
          ":course": [userData.coursesID[0]],
          ":empty_list": [],
        },
      });

      await docClient.send(updateCommand);
      console.log("User course data updated successfully.");
    } else {
      // If the user does not exist, create a new record
      const putCommand = new PutCommand({
        TableName: tableName,
        Item: userData,
      });

      await docClient.send(putCommand);
      console.log("New user data saved successfully.");
    }

    // Send confirmation email to the user only if saved successfully
    await sendEmail({
      to: userData.email,
      templateId: "d-d5482eab7c304461af455d8456e8521d", // Your user confirmation template ID
      dynamicData: {
        userName: userData.nombreDelAlumno,
        userEmail: userData.email,
      },
    });

    console.log("Confirmation email sent to user successfully");

    // Send a notification email to the company about the new or updated user
    await sendEmail({
      to: companyEmail,
      templateId: "d-03d6e5f6f39f443ea1e4c51766896f05", // Your company notification template ID
      dynamicData: {
        userName: userData.nombreDelAlumno,
        userEmail: userData.email,
      },
    });

  } catch (error) {
    console.error("Error saving user data in DynamoDB:", error);

    // Send an error email to the company
    await sendEmail({
      to: companyEmail,
      templateId: "d-d9e9e50b811e4970a74f91c446058f85", // Your error notification template ID
      dynamicData: {
        errorDate: new Date().toISOString(),
        errorMessage: error.message,
        userEmail: userData.email,
      },
    });

    console.log("Error notification email sent to company");

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
