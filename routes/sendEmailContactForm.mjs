// Importing necessary classes from AWS SDK v3 for SES
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

// Creating an instance of the SES client
const sesClient = new SESClient({ region: "us-east-1" }); // Ensure the region matches your SES configuration

const companyEmail = process.env.COMPANY_EMAIL; // Email address defined in environment variables

export const handler = async (event) => {
    const { name, phone, email, message } = event;

    // Parameters for the SES sendEmail command
    const params = {
        Destination: {
            ToAddresses: [companyEmail],
        },
        Message: {
            Body: {
                Text: {
                    Charset: "UTF-8",
                    Data: `Nombre: ${name}\nTeléfono: ${phone}\nCorreo electrónico: ${email}\nMensaje: ${message}`,
                },
            },
            Subject: {
                Charset: "UTF-8",
                Data: "Nuevo mensaje de contacto",
            },
        },
        Source: companyEmail,
    };

    // Creating a new SendEmailCommand with the above parameters
    const command = new SendEmailCommand(params);

    try {
        // Sending the email using the SES client and the command
        const response = await sesClient.send(command);
        console.log("Correo enviado correctamente", response);
        // Returning a successful response
        return { statusCode: 200, body: "Correo enviado correctamente" };
    } catch (error) {
        // Logging and returning the error if the email sending fails
        console.error("Error al enviar el correo", error);
        return { statusCode: 500, body: "Error al enviar el correo" };
    }
};
