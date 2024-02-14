import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

const dynamoDb = DynamoDBDocument.from(new DynamoDB());
const tableName = process.env.TABLE_NAME || 'users';

export const handler = async (event) => {
    console.log('Inicializando Lambda', event)
    let email;
    let body;
    let statusCode = '200';
    const headers = {
        'Content-Type': 'application/json',
    };

    try {
        // Verifica si 'event.body' está presente y es una cadena, si es así, analiza como JSON
        if (typeof event.body === 'string') {
            body = JSON.parse(event.body);
            email = body.email;
        } else if (event.email) {
            // Maneja el caso donde el evento ya está en formato objeto con 'email' directamente
            email = event.email;
        } else {
            throw new Error("Invalid request");
        }

        if (!validateEmail(email)) {
            throw new Error('Invalid email format');
        }

        await dynamoDb.put({
            TableName: tableName,
            Item: { email },
            ConditionExpression: 'attribute_not_exists(email)'
        });

        body = { message: 'Email stored successfully' };
    } catch (err) {
        statusCode = err.name === 'ConditionalCheckFailedException' ? '409' : '400';
        body = { message: err.message };
    } finally {
        body = JSON.stringify(body);
    }

    return {
        statusCode,
        body,
        headers,
    };
};

// Función de validación de correo electrónico
function validateEmail(email) {
    const regex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\\.,;:\s@"]+\.)+[^<>()[\]\\.,;:\s@"]{2,})$/i;
    return regex.test(String(email).toLowerCase());
}
